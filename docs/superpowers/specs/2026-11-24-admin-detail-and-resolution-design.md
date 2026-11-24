# Cadastro/Baixa Timestamps, Approval & Occurrence Detail, Resolution Reason, Phone Mask — Design

## Intent and why

Six requests from the user after using the live admin panel (2026-11-24):

1. There's no way to see when a bike was registered or when it was deactivated — both events happen, but neither timestamp is shown anywhere in the UI.
2. "Bikes Emplacadas" (KPI label) uses the wrong word — "emplacada" (license-plated) doesn't fit a sticker/QR system; should read "Bikes Adesivadas".
3. The WhatsApp/phone field on `/cadastro` is free text — no formatting guidance as the resident types.
4. On the Aprovações tab, clicking a pending request should open a detail view with the requester's full information before the admin approves — the user confirmed this can reuse the same card/modal pattern already built for Fleet ("Ver cadastro completo").
5. On the Ocorrências (admin) tab, each reported incident only shows the bike's tag and block/unit — not the resident's contact info or the bike's registration details.
6. Marking an incident "resolved" should capture a resolution reason (a fixed, context-appropriate list) plus a free-text observation — the user confirmed this mirrors the reason+notes pattern just shipped for bike deactivation, but with incident-resolution-appropriate options.

## Goals

- `BikeDetailModal` (the existing "see everything" surface) shows when a bike was registered, and — for inactive bikes — when and why it was deactivated.
- The KPI label reads "Bikes Adesivadas (Ativas)".
- The WhatsApp input formats as `(XX) XXXXX-XXXX` while the resident types, on both `/cadastro` and the admin edit form.
- Clicking a pending request in Aprovações opens `BikeDetailModal` (the same component Fleet already uses) before the admin approves.
- Each incident in Ocorrências shows the resident's name and WhatsApp inline, plus a "Ver cadastro completo" action opening `BikeDetailModal` for the full registration.
- Resolving an incident opens a small modal asking for a resolution reason (a fixed list) and an optional note, recorded on the incident itself.

## Non-goals (this round)

- A dedicated UI to browse the full `bikes_history` timeline (still just the single most-recent deactivation shown inline on the modal, not a list of every past edit).
- Editing a bike's photo from any of these surfaces (already out of scope, unchanged).
- Changing the incident's own `reason`/`notes` (the resident's original complaint text) — only the NEW resolution fields are added.
- Validating the WhatsApp number against any external format/carrier check — the mask is purely a typing aid, not a validator. A number shorter than expected is still accepted (the mask doesn't block submission).

## Constraints

- Any new mutating RPC: RLS enabled + a real policy, a base-table GRANT to `authenticated`, EXECUTE revoked from `public`/`anon`, granted only to `authenticated`, and an `auth.role() = 'authenticated'` guard in the function body — same bar as every prior RPC in this project.
- `owner_whatsapp` is stored as digits only today (e.g. `"21999990000"`) in every existing row — the mask must not change this storage format, to avoid a migration and to keep every existing display/RPC call working unmodified. Masking is display-only: the input shows the formatted value, but the value submitted/stored stays digits-only.
- `ApprovalsTab`'s existing `supabase.from('bikes').select('*')...` query already fetches the FULL row (not just the `PendingBike`-picked fields) — reusing `BikeDetailModal` for pending bikes needs no new fetch, just a type/prop change.
- `incidents` already has `reason` (the resident's complaint, not null) and `notes` (the resident's own note) — the new resolution fields must be named distinctly (e.g. `resolution`, `resolution_notes`) so they don't collide with or overwrite the resident's original complaint data.

## Approaches considered

**Timestamps (1):** one sensible way — show them inside `BikeDetailModal`, the component already built to be the "full detail" surface, rather than adding a new column to `FleetTab`'s table (which would clutter it and duplicate work already solved once). "Cadastrado em" always shows (from `bikes.created_at`, already fetched). The deactivation date/reason/notes are not columns on `bikes` — they live in `bikes_history` (the row inserted by `deactivate_bike`) — so for an inactive bike, the modal additionally queries the most recent `bikes_history` row with `action = 'deactivate'` for that `bike_id` and shows its `edited_at`, `reason`, `notes`. This is the first real use of `bikes_history` as a UI data source, exactly what an earlier whole-branch review flagged as a planned future use.

**KPI label (2):** one sensible way — a literal string change in `KpiCards.tsx`.

**Phone mask (3):** one sensible way given the storage constraint above — a small pure formatter `formatBrazilPhone(digits: string): string` (`src/lib/phone.ts`) that progressively applies `(XX) XXXXX-XXXX` punctuation as digits accumulate, capped at 11 digits (2-digit DDD + 9-digit mobile number, the standard modern Brazilian format). The input's `value` is `formatBrazilPhone(rawDigits)`; `onChange` strips non-digits from the new input, truncates to 11, and that digit-only string is what's kept in state and eventually submitted/stored — identical to today's stored format. Used in both `RegisterPage.tsx` (new registration) and `BikeDetailModal.tsx`'s edit mode (so editing an existing WhatsApp number gets the same typing aid).

**Approval detail (4):** one sensible way, per the user's own answer — reuse `BikeDetailModal` exactly as Fleet already uses it. `ApprovalsTab` already has the full `Bike` row in memory (its query is `select('*')`, just narrowly typed); clicking a pending card opens the same modal, with the same view/edit/save behavior Fleet has. This has a pleasant side effect the user didn't ask for but gets for free: an admin can fix a typo in the registration before approving it, not just view it — acceptable since it's the same component doing the same thing it already does elsewhere, not new scope.

**Occurrence detail (5):**
- **A — inline contact fields + a "Ver cadastro completo" action, chosen.** Extend `OccurrencesTab`'s existing join (`bikes(tag_number, unit_block)`) to also select `owner_name, owner_whatsapp` — shown inline on each incident card (covers "apto, contato" directly, cheaply, no extra query). For "dados do cadastro" (the fuller ask — brand/model, color, photo), add a "Ver cadastro completo" button per incident that fetches the full bike row and opens `BikeDetailModal`, same reused pattern as (4).
- B — show everything inline, no modal. Rejected: an incident card already carries the complaint text, photo badge, and resolve button; cramming the full registration (photo, brand/model, color) into every card as well would overload the open-incidents list, which the admin scans quickly and often. A click-through keeps the common case light.

**Resolution reason (6):**
- **A — add `resolution`/`resolution_notes` columns to `incidents` directly, chosen.** This is purely a property of the incident's own lifecycle (open → resolved), not a historical snapshot of a changing entity the way `bikes_history` is for `bikes` — there's no "prior version" of an incident to preserve, so a dedicated history table would be unnecessary structure. A new RPC `resolve_incident(p_incident_id uuid, p_resolution text, p_resolution_notes text)` sets `status = 'resolved'`, `resolved_at = now()`, and the two new columns, replacing `OccurrencesTab`'s current direct `supabase.from('incidents').update(...)` call — same security pattern as every other mutating RPC in this project.
- B — reuse `bikes_history` with an `action = 'resolve_incident'` row. Rejected: `bikes_history` is keyed by `bike_id` and snapshots bike fields; shoehorning incident-resolution data into it would mean a table about bikes also describing something that happened to an incident, which doesn't fit its own stated purpose and would need nullable bike-snapshot columns that make no sense for this event.
- Resolution reason list (fixed, in `src/lib/bikeOptions.ts` alongside `DEACTIVATION_REASONS`): `INCIDENT_RESOLUTION_REASONS = ['Bike retirada do local', 'Morador contatado e resolveu', 'Reorganizada pela administração', 'Falso alarme / engano', 'Outro']` — context-appropriate for what actually happens when someone reports a bike via the QR sticker (wrong parking spot, flat tire, etc.), distinct from `DEACTIVATION_REASONS` (which are about why a *registration* ends).

## Decided (the how)

- **`BikeDetailModal.tsx`**: read-only view gains a "Cadastrado em: {formatted created_at}" line, always shown. When `bike.status === 'inactive'`, an additional query (`supabase.from('bikes_history').select('edited_at, reason, notes').eq('bike_id', bike.id).eq('action', 'deactivate').order('edited_at', { ascending: false }).limit(1).single()`) runs on mount/open, and if it returns a row, the modal also shows "Baixa em: {edited_at}", "Motivo: {reason}", and the notes if present.
- **`KpiCards.tsx`**: `"Bikes Emplacadas (Ativas)"` → `"Bikes Adesivadas (Ativas)"`.
- **`src/lib/phone.ts`** (new): `formatBrazilPhone(digits: string): string`. Used by a small shared input pattern (either a tiny wrapper component or just inline `value={formatBrazilPhone(raw)}` / `onChange` logic duplicated in the two call sites, implementer's call on which is less awkward given there are only two call sites) in `RegisterPage.tsx` and `BikeDetailModal.tsx`'s edit mode.
- **`ApprovalsTab.tsx`**: the `PendingBike` type widens to the full `Bike` type (the data was always there; only the TS narrowing was artificial). Clicking a pending card opens `BikeDetailModal` with that full row, `onClose` just closes it, `onSaved` closes and calls `loadPendingBikes()` (mirroring Fleet's `onSaved` pattern) — approving still happens via the existing "Atribuir Adesivo" button, unaffected.
- **`OccurrencesTab.tsx`**: the join widens to `bikes(tag_number, unit_block, owner_name, owner_whatsapp)`; each open-incident card shows the owner's name and WhatsApp inline, plus a new "Ver cadastro completo" button that fetches the full bike row (`supabase.from('bikes').select('*').eq('id', incident.bike_id).single()`) and opens `BikeDetailModal`. "Marcar Resolvida" opens a new `ResolveIncidentModal` (same modal-chrome family as `DeactivateBikeModal`) instead of the current `window.confirm`, with a "Motivo da Resolução" select (`INCIDENT_RESOLUTION_REASONS`) and an always-visible "Observações" textarea; confirming calls the new RPC.
- **New RPC `resolve_incident(p_incident_id uuid, p_resolution text, p_resolution_notes text) returns void`**: `auth.role() = 'authenticated'` guard; `update incidents set status = 'resolved', resolved_at = now(), resolution = p_resolution, resolution_notes = p_resolution_notes where id = p_incident_id and status != 'resolved'`; `if not found then raise exception 'incident not found or already resolved';` — same double-fire-safe shape as `deactivate_bike` (a single guarded UPDATE is sufficient here since there's no separate snapshot-insert step, unlike the bike-history case). EXECUTE revoked from `public`/`anon`, granted to `authenticated`.
- **Schema**: `alter table incidents add column resolution text; alter table incidents add column resolution_notes text;` (both nullable — existing resolved rows simply have null resolution data, which is fine, nothing reads it as required).

## What's left to the builder

- Exact Tailwind classes for the new "Cadastrado em"/"Baixa em" lines in `BikeDetailModal`, the "Ver cadastro completo" button placement on incident cards, and `ResolveIncidentModal`'s layout — follow this codebase's existing patterns (the modal-chrome family, the existing inline-detail-line styling already used elsewhere in the same component).
- Whether the phone-mask logic is factored into a tiny shared helper component or duplicated inline at the two call sites — both are small enough that either is fine; pick whichever reads more clearly.
- Test cases per task, following this codebase's existing Vitest + RTL conventions.
- Exact wording/order is not fixed for `INCIDENT_RESOLUTION_REASONS` beyond the 5 values given above — if the builder finds a 6th obviously-missing common case while implementing, adding it is a reasonable call, not a decision that needs to come back for approval.
