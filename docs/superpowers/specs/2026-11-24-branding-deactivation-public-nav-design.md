# Rebranding, Deactivation Reason/History, and Public Nav + QR Scanning — Design

## Intent and why

Three requests from the user after trying the live admin edit/view feature (2026-11-24):

1. The app is hard-coded as "BikeCondo" in a few places, but the real building is **Solar de Laranjeiras**. The user wants the real name shown instead.
2. "Dar Baixa" (deactivating a bike) today just flips `status` to `inactive` with a native `confirm()` — no record of why or when. The user wants a reason captured (a predefined list with an "Outros" escape hatch) plus a free-text observations field, alongside the registration-edit history already shipped.
3. The link to report an incident from `/cadastro` is today a small secondary link at the bottom of the registration form. The user wants it promoted to a first-class tab, sitting alongside a "Cadastro" tab, switchable at the top of both pages — and wants the tag-number entry to also support scanning the physical QR sticker with the camera, not just typing the number, since residents will use the incident-report path far more often than the one-time registration.

## Goals

- Every user-visible occurrence of "BikeCondo" becomes "Solar de Laranjeiras".
- Deactivating a bike requires picking a reason (from a fixed list, with an "Outros" option) and lets the admin add a free-text note; this is recorded with a timestamp, the same way an edit is.
- A shared tab bar ("Cadastro" / "Ocorrência") sits at the top of the public registration page and a new public "report an issue" entry page, letting a visitor switch between them without going back.
- The new "Ocorrência" entry page offers both a camera QR-code scanner and the existing manual tag-number input, either of which lands on `/b/:tagNumber`.

## Non-goals (this round)

- A UI to browse the registration-edit history (`bikes_history`) — still not built; this round only adds deactivation's reason/notes to the same kind of record, it doesn't add a viewer.
- Changing what happens once someone is already on `/b/:tagNumber` (the incident-report page itself) — the new tab bar lives on `/cadastro` and the new entry page, not inside the per-bike incident page.
- Editing or correcting a past deactivation's reason/notes after the fact.
- Any change to how admins authenticate or to resident identity — the QR scanner is just a faster way to provide the same tag number the manual input already accepts.

## Constraints

- `HashRouter` throughout — any new route is a hash route, and the QR scanner must handle the sticker's actual payload: `${origin}${pathname}#/b/<tag>` (a full URL, not a bare number), the same value `FleetTab`'s and `StickersTab`'s printed QR codes already encode.
- This project's established RPC pattern for any new admin mutation: RLS enabled + a real policy, a base-table GRANT to `authenticated`, EXECUTE revoked from `public`/`anon` and granted only to `authenticated`, and an `auth.role() = 'authenticated'` guard in the function body.
- Camera access requires HTTPS (GitHub Pages already serves over HTTPS, so no new constraint there) and requires the user's browser permission — must degrade gracefully (manual input stays available) if denied or unavailable.
- `npm view html5-qrcode version` confirms the package is available (current: 2.3.8) — a plain JS library with bundled TypeScript types, no WASM step, already a precedent-free but low-risk addition to this project's dependency list.

## Approaches considered

**Rebranding (1):** one sensible way — replace the 3 hard-coded occurrences (`AdminPage.tsx`'s header, `index.html`'s `<title>`, `manifest.webmanifest`'s `name`/`short_name`) with "Solar de Laranjeiras", and update the live `condo_settings.condo_name` row to match (currently an unused field defaulting to `'Condomínio'`) so the database reflects reality even though nothing reads it yet.

**Deactivation reason/history (2):**
- **A — extend `bikes_history`, chosen.** Add nullable `action` (`'edit' | 'deactivate'`), `reason`, and `notes` columns to the existing `bikes_history` table; a snapshot row is already being captured on every edit, so extending the same table to also snapshot-on-deactivate (with `action = 'deactivate'`, `reason`, `notes` filled in, and `action = 'edit'` with those three columns null for existing edit rows) keeps one single history record per bike, not two parallel mechanisms.
- B — a separate `bikes_deactivations` table. Rejected: it would duplicate most of `bikes_history`'s columns (tag_number, unit_block, owner_name, etc. — the full snapshot at the moment of the action is just as relevant for a deactivation as for an edit) for no real benefit, and two places to look for "what happened to this bike" is worse than one.
- New RPC `deactivate_bike(p_bike_id uuid, p_reason text, p_notes text)` replaces `FleetTab`'s direct `supabase.from('bikes').update({ status: 'inactive' })` call, following the same snapshot-then-update shape as `update_bike_registration`.
- UI: `FleetTab`'s "Dar Baixa" button opens a small modal (same visual family as `BikeDetailModal`) with a reason `<select>` and a notes `<textarea>`, replacing the current `window.confirm`.

**Public nav + QR scanning (3):**
- **A — a new `src/components/PublicNavTabs.tsx` shared component + a new `/ocorrencia` route, chosen.** `RegisterPage.tsx` keeps being reached at `/cadastro` (the link already shared with residents), and a new `OccurrenceEntryPage.tsx` is reached at `/ocorrencia` — both render `<PublicNavTabs active="cadastro" | "ocorrencia" />` at the top, which navigates between the two routes on click. `OccurrenceEntryPage` replaces today's secondary link block in `RegisterPage` (that block is removed) and contains the camera scanner plus the same zero-pad/trim manual-entry fallback, moved here from `RegisterPage`.
- B — fold both into one single route with internal tab-state (no second route). Rejected: `/cadastro` is already a link shared directly with residents (e.g. via WhatsApp) expecting the registration form; changing what that exact URL shows based on client-side tab state would be a worse fit than two addressable routes with a shared switcher — each tab's URL stays bookmarkable/shareable on its own, which a resident forwarding "use this link to report a problem" benefits from.
- QR payload handling: `html5-qrcode`'s scan-success callback receives the raw decoded string (the sticker's full URL). Parse out the hash fragment (everything after `#`) and `navigate()` to it if it matches `^/b/\d+$/`-shaped content after the hash; otherwise show an inline "QR Code não reconhecido" message and leave the manual input available — a visitor might scan an unrelated code by mistake, and the app must not crash or silently misnavigate on that.

## Decided (the how)

- **Rebranding:** `AdminPage.tsx` header text, `index.html`'s `<title>`, `manifest.webmanifest`'s `name` and `short_name` all become `"Solar de Laranjeiras"`. The live `condo_settings.condo_name` row is updated to `'Solar de Laranjeiras'` via the SQL editor (a data update, not a schema change — no migration file needed).
- **`bikes_history` schema change:** `alter table bikes_history add column action text not null default 'edit' check (action in ('edit', 'deactivate')); alter table bikes_history add column reason text; alter table bikes_history add column notes text;`. `update_bike_registration` (existing RPC) is unchanged — its inserts default `action` to `'edit'` with `reason`/`notes` staying null, since it doesn't set them.
- **New RPC `deactivate_bike(p_bike_id uuid, p_reason text, p_notes text) returns void`**: same auth guard as every other RPC here. A builder-check caught a real ordering bug in an earlier draft of this doc (an unconditional insert before a guarded update would let a double-fire — two admin tabs, a retried click — write two `action='deactivate'` history rows even though the status update itself was a no-op). Fixed by using a single data-modifying CTE so the update and the snapshot insert happen as one atomic, naturally-guarded step — nothing is inserted unless the update actually affected a row:
  ```sql
  with updated as (
    update bikes set status = 'inactive'
    where id = p_bike_id and status != 'inactive'
    returning *
  )
  insert into bikes_history (
    bike_id, tag_number, unit_block, owner_name, owner_whatsapp,
    brand_model, color, photo_url, status, created_at, action, reason, notes, edited_by
  )
  select id, tag_number, unit_block, owner_name, owner_whatsapp,
         brand_model, color, photo_url, status, created_at, 'deactivate', p_reason, p_notes, auth.uid()
  from updated;

  if not found then
    raise exception 'bike not found or already inactive';
  end if;
  ```
  If `p_bike_id` doesn't exist, or the bike is already `inactive`, the UPDATE (and therefore the CTE, and therefore the INSERT...SELECT) affects zero rows; `FOUND` is false and the function raises — nothing is written, and a double-fire can never produce two history rows. EXECUTE revoked from `public`/`anon`, granted to `authenticated`.
- **Deactivation reason list** (fixed catalog + escape hatch, in `src/lib/bikeOptions.ts` alongside the other shared catalogs): `DEACTIVATION_REASONS = ['Mudança de endereço', 'Roubo/Furto', 'Perda', 'Venda da bicicleta', 'Outro']`. The notes field is always available (not just when "Outro" is picked) — the user asked for "um campo para observações" as its own thing, not conditional.
- **`FleetTab.tsx`**: "Dar Baixa" opens a new `DeactivateBikeModal` (reason select + notes textarea + Confirmar/Cancelar), replacing the current `window.confirm`; Confirmar calls the new RPC via `supabase.rpc('deactivate_bike', { p_bike_id, p_reason, p_notes })`.
- **`PublicNavTabs.tsx`**: two buttons, "Cadastro" and "Ocorrência", styled as a segmented control (visually similar to `AdminPage`'s internal tab bar, but public-facing copy/sizing); `active` prop highlights the current one; the inactive one navigates via `useNavigate` to `/cadastro` or `/ocorrencia`.
- **New route `/ocorrencia`** → `OccurrenceEntryPage.tsx`: renders `<PublicNavTabs active="ocorrencia" />`, then a camera-scanner panel (`html5-qrcode`, start/stop tied to the component's mount/unmount, a visible "ativar câmera" affordance rather than auto-starting, since autoplay camera access tends to surprise/annoy and some browsers block it without a user gesture anyway) and, below it, the manual tag-number input + "Ver Ocorrência" button (the same zero-pad/trim logic the removed `RegisterPage` block used). `RegisterPage.tsx` gets `<PublicNavTabs active="cadastro" />` added at its top and has its own secondary report-link block (added in the previous PR) removed, since `/ocorrencia` now owns that job.
- **New dependency:** `html5-qrcode` (`^2.3.8`), added to `package.json`.

## What's left to the builder

- Exact Tailwind classes for `PublicNavTabs`, `DeactivateBikeModal`, and `OccurrenceEntryPage`'s layout, following this codebase's existing component visual language (the admin tab bar, `BikeDetailModal`'s modal chrome).
- `html5-qrcode`'s exact integration API (`Html5Qrcode` class vs. `Html5QrcodeScanner` component) and camera-permission-denied messaging copy — pick whichever integrates more simply with a function component's lifecycle; both are documented, mainstream usages of the library.
- Whether the camera panel auto-selects a rear-facing camera on mobile (`facingMode: 'environment'`) — yes, this is the sensible default for scanning a physical sticker, state it as a one-line decision when implementing rather than treating it as open.
- Test cases per task, following this codebase's existing Vitest + RTL conventions. The camera scanner itself is hard to unit-test meaningfully (real `html5-qrcode` needs a real `<video>` + camera) — tests should cover the surrounding logic (URL/hash parsing from a scanned string, the "not recognized" fallback path, the manual-entry zero-pad/trim path) with the scanner library itself mocked, not exercised end-to-end.
