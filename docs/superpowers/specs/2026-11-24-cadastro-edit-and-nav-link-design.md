# Cadastro editing, change history, and a cadastro↔ocorrência link — Design

## Intent and why

Three deferred requests from the user (recorded 2026-11-23, confirmed 2026-11-24):

1. Admins currently cannot fix a resident's registration after it's approved (a typo'd model, an outdated WhatsApp number, a color change) — the only admin action on an active bike is "Dar Baixa" (deactivate). There is no edit flow and no record of what a registration looked like before an edit.
2. The public `/cadastro` and `/b/:tagNumber` pages have zero navigation between them, even though a resident filling out `/cadastro` again (e.g. to double-check something, or because they lost the physical sticker) has no way to reach the incident-report page without the printed QR code.
3. `FleetTab` (approved/active bikes) only shows a one-line summary per bike. `ApprovalsTab` already shows the full registration (photo + every field) for *pending* bikes. There is no equivalent "see everything" view for an *active* bike in the Fleet list.

The user confirmed, in order: (1) admin-only editing (not resident self-service), (2) the `/cadastro` → `/b/:tag` link sketch as proposed, and (3) that the Fleet "view full registration" banner and the edit action are the same UI — opening the full-detail view is also the entry point for editing.

## Goals

- An admin can open any active bike's full registration from `FleetTab` (photo + every field) and edit its editable fields from that same view.
- Every edit is preserved: the prior version of the row is kept, not overwritten and lost.
- A resident on `/cadastro` can reach `/b/:tagNumber` without the physical sticker.

## Non-goals (this PR)

- Resident self-service editing (confirmed: admin-only).
- A UI to browse/list a bike's edit history — the history is captured and stored now so nothing is lost, but surfacing a "view history" screen is a separate, later piece of work.
- Editing a bike's photo (re-upload) — editing is scoped to the text fields (`unit_block`, `owner_name`, `owner_whatsapp`, `brand_model`, `color`). Photo stays as originally uploaded; re-upload flows are a bigger feature (storage cleanup, re-compression) and weren't asked for.
- Editing from `ApprovalsTab` (pending bikes) — pending registrations are approved or left pending; this PR only adds editing to the Fleet (active-bike) side, matching what was actually asked for.
- Any change to `/b/:tagNumber` itself beyond being a navigation target.

## Anti-goals

- The edit path must not be callable by `anon` or an unauthenticated caller — same bar as every other mutating RPC in this project (`approve_bike`, `generate_sticker_batch`): EXECUTE revoked from `public`/`anon`, granted only to `authenticated`, plus an `auth.role() = 'authenticated'` guard in the function body.
- The brand/model/color/bloco option lists must not be duplicated between `RegisterPage.tsx` and the new edit form — two independently-maintained copies of `BRAND_MODELS` will drift (already a point the user cared enough about to paste a full catalog for). They move to one shared module both import.
- The nav link on `/cadastro` must not visually compete with "Enviar Cadastro e Solicitar Adesivo" — it's a secondary affordance for an edge case, not an alternative primary action.

## Constraints

- Residents have no accounts or sessions anywhere in this app (confirmed by reading the schema and both public pages) — this is why resident self-edit was ruled out rather than built with a token scheme.
- `HashRouter` is used throughout (GitHub Pages has no server-side rewrites); any new in-app navigation must use hash-based paths (`#/b/<tag>`), consistent with every existing link/QR value in the codebase.
- This project's established, twice-audited security pattern for any new mutating RPC: RLS enabled + a real policy, a base-table GRANT (RLS alone does not grant access in Postgres — the exact gap that caused a prior incident here), EXECUTE revoked from `public`/`anon` and granted only to `authenticated`, and an in-body `auth.role()` check as defense in depth.
- Both `supabase/schema.sql` (fresh-install source of truth) and a standalone `supabase/migration_*.sql` file (applied directly to the live project, same pattern as `migration_sticker_pool.sql`) must stay in sync for any schema/RPC change.

## Approaches considered

**For editing (item 1):**
- **A — Admin-only edit, chosen.** A new SECURITY DEFINER RPC updates the `bikes` row and snapshots the pre-edit row into a `bikes_history` table in the same call, atomically. No new identity problem: admins already authenticate via Supabase Auth, and every other mutation in this app already goes through an authenticated-only RPC.
- B — Resident self-service via a mailed/shared edit link. Rejected: residents have no account or channel to receive a secret link through today (no email, no in-app auth); building one is a much bigger feature than what was asked, and widens the attack surface on contact data others could abuse (the stated reason the sticker tag itself was judged too guessable for an edit-by-tag flow).

**For the view/edit entry point (items 1 and 3, now merged):**
- One sensible way, per the user: `FleetTab` gets a "Ver cadastro completo" button per bike (alongside "Ver QR"/"Dar Baixa") that opens a modal showing the full registration (reusing `ApprovalsTab`'s photo+fields layout) with an "Editar" button inside it that turns the read-only fields into the same inputs `RegisterPage` uses, plus "Salvar"/"Cancelar".

**For the nav link (item 2):**
- One sensible way, per the user: a secondary text link below the registration form's submit button — "Já tem uma bike cadastrada? Reporte um problema" — that asks for a tag number and navigates to `#/b/<tag>`.

## Decided (the how)

- **New table `bikes_history`**: mirrors `bikes`' columns (`bike_id` instead of `id`, referencing `bikes(id)`) plus `edited_at timestamptz default now()` and `edited_by uuid references auth.users(id)`. RLS enabled, one `select`-only policy `to authenticated`, base `grant select ... to authenticated`. No insert/update/delete grant to anyone — only the new RPC (as `security definer`) ever writes to it, same pattern as `stickers`.
- **New RPC `update_bike_registration(p_bike_id uuid, p_unit_block text, p_owner_name text, p_owner_whatsapp text, p_brand_model text, p_color text) returns void`**: `auth.role() = 'authenticated'` guard; `insert into bikes_history (...) select <old values>, auth.uid() from bikes where id = p_bike_id` (if the bike doesn't exist, this inserts 0 rows and `FOUND` is false — raise `'bike not found'`, mirroring `approve_bike`'s `if not found` pattern); then `update bikes set unit_block = p_unit_block, owner_name = p_owner_name, owner_whatsapp = p_owner_whatsapp, brand_model = p_brand_model, color = p_color where id = p_bike_id`. EXECUTE revoked from `public`/`anon`, granted to `authenticated`.
- **Shared options module**: extract `BLOCK_OPTIONS`, `BRAND_MODELS`, `BRAND_OPTIONS`, `COLOR_OPTIONS` (and the `OTHER_BRAND`/`OTHER_MODEL`/`OTHER_COLOR` sentinels) out of `RegisterPage.tsx` into `src/lib/bikeOptions.ts`. `RegisterPage.tsx` imports from there instead of defining them locally; the new edit form imports the same module. This is the only way to guarantee the catalogs can't drift apart, which matters given the user hand-curated the brand/model list once already.
- **`FleetTab.tsx`**: add a "Ver cadastro completo" button per bike (desktop table row and mobile card, mirroring where "Ver QR"/"Dar Baixa" already live). On click, fetch the full `Bike` row by id (FleetTab's list query stays lean — it doesn't carry `owner_whatsapp`/`photo_url`/`created_at` today) and open a modal.
- **New component, e.g. `src/components/admin/BikeDetailModal.tsx`**: shows photo + every field read-only (same visual language as `ApprovalsTab`'s pending-bike card, plus a WhatsApp row that card doesn't have — `ApprovalsTab` omits it today, but it's one of the five editable fields, so the new modal adds it; `ApprovalsTab` itself is left untouched). An "Editar" button swaps the fields into inputs, with two different reconstruction strategies depending on the field, decided below, plus "Salvar" (calls the RPC, then re-fetches/updates the row and closes or returns to read-only) and "Cancelar" (discards in-progress edits, back to read-only). Loading/error states follow the pattern already used for `handleDeactivate` in the same file.

  **Reconstructing stored values into edit controls** (flagged by the builder check — `unit_block` and `brand_model` aren't raw field values, they're strings `RegisterPage` derives at submit time, so editing them means reverse-parsing):
  - `unit_block` is stored as `"${block} • Apto ${apartment}"`. Splittable safely on the `•` separator — the edit form reconstructs the `Bloco` select (A/B) and a free-text `Apartamento` field from the two halves. Low risk: the separator is fixed and controlled by this codebase only.
  - `color` is stored as either a `COLOR_OPTIONS` value or custom text (when "Outra cor" was picked at registration). Reconstruction is an exact-match check against `COLOR_OPTIONS`; a match re-selects that option, no match pre-selects "Outra cor" with the stored string as the custom text. Safe — no ambiguity, it's a single value, not a concatenation.
  - `brand_model` is stored as `"${brand} ${model}".trim()` (brand and model space-joined, **no distinguishing separator**) or raw custom text. Reconstructing this reliably would mean testing every `BRAND_MODELS` catalog combination as a prefix match against the stored string, and the catalog can change over time — a legacy or no-longer-matching value would silently get reclassified as "Outra marca" with the admin unable to tell it apart from a value that was genuinely free-typed. That's a real data-integrity risk, not just a UX wrinkle, so: **the edit form's Marca/Modelo field is a single free-text input pre-filled with the current `brand_model` string, not the cascading brand→model selects `RegisterPage` uses at registration time.** This is a deliberate, scoped exception to "reuse RegisterPage's controls" — editing a typo in an existing value needs a text fix, not re-selection from the catalog, and it avoids silently mangling data for any row whose stored string doesn't cleanly decompose. `Bloco`/`Apartamento` and `Cor` keep their select-based controls since those reconstruct safely, as above.

- **`RegisterPage.tsx`**: below the submit button, a small secondary link/button "Já tem uma bike cadastrada? Reporte um problema" that, on click, prompts for a tag number (simplest: a small inline input + "Ir" button, not a full modal — this is a low-stakes convenience, not a flow). Before navigating, the typed value is trimmed and zero-padded to match the stored format (`tag_number` is always 3-digit zero-padded, e.g. `"007"`, and `get_public_bike_by_tag` does an exact match with no server-side normalization — a resident typing `7` instead of `007` would otherwise land on a working-but-wrong "not found" page). Navigates to `${window.location.pathname}#/b/<padded-tag>` using the router (`useNavigate`), consistent with `HashRouter`.

## What's left to the builder

- Exact Tailwind classes/visual polish for `BikeDetailModal` (follow `ApprovalsTab`'s card and `FleetTab`'s existing QR-modal for visual consistency — both already in the codebase as reference).
- Exact placement/copy micro-details for the `/cadastro` nav link's tag-number prompt (inline input vs. a tiny popover) as long as it stays secondary in visual weight and uses `HashRouter`-safe navigation.
- Test cases per task, following this codebase's existing Vitest + RTL conventions (mock `../lib/supabase`, query by label/role/id).
- Whether `BikeDetailModal` is triggered from `ApprovalsTab` too in the future is explicitly out of scope — don't wire it there.
