# BikeCondo UX Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backlog from the 2026-11-23 design-critique pass and the user's two follow-up requests (optional photo, bulk sticker printing), split into the minimum number of PRs that still keeps each PR independently reviewable and shippable.

**Architecture:** Two PRs. **PR A — "UX polish"** (Tasks 1–8): pure UI/content fixes, no schema changes, safe to ship immediately. **PR B — "Sticker pool"** (Tasks 9–13): a genuine feature addition (pre-generated, pre-printed sticker batches) that changes the schema and the `approve_bike` RPC, branched from `main` after PR A merges. This split is the minimum that avoids mixing a risky schema/RPC rewrite with the low-risk UI fixes — merging them would force every UI tweak to wait on the new feature's review, and would force the new feature's review to wade through unrelated CSS diffs.

**Tech Stack:** Same as the existing project — React + Vite + TypeScript + Tailwind + Supabase (`@supabase/supabase-js`, `qrcode.react` — already a dependency, reused for the new bulk-print view). No new dependencies.

**Spec:** The 2026-11-23 design-critique conversation (Nielsen heuristics + UX laws pass) and two explicit follow-up requests from the user in this same conversation: (1) "Foto da bike não precisa ser obrigatória" and (2) bulk-generate a pool of pre-printed stickers so a condo can print a whole sheet at once and assign stickers to bikes later, instead of printing one QR per approval.

## Global Constraints

- Visual language: existing Tailwind conventions only — `emerald-600`/`slate-900` palette, same card/button/modal shapes already used across the app (see `CapacityModal.tsx` for the canonical small-modal shell, `ApprovalsTab.tsx`'s `assignedTag` modal for the canonical QR-display modal). Do not introduce a new modal/dialog library.
- Confirmations for "Dar Baixa" and "Marcar Resolvida" use the browser's native `window.confirm(...)` — no custom dialog component. Keep the confirmation text specific (name the bike's tag/unit), not a generic "Tem certeza?".
- PR A and PR B are separate branches/PRs. PR B branches from `main` **after** PR A is merged (sequential, not parallel) — Task 9's schema migration must be written against the state PR A leaves `supabase/schema.sql` in.
- Any schema/RLS/RPC change ships two ways, exactly like the project's prior security-fix migration: (a) folded into `supabase/schema.sql` for fresh installs, and (b) as a standalone, idempotent `supabase/migration_*.sql` file (`create or replace function`, `drop policy if exists` + `create policy`, etc.) that can be run against the already-live Supabase project without re-running the whole schema.
- `PhotoAttachField` (Task 5) becomes the single shared component for "attach a photo" — both `/cadastro` and `/b/:tag` must visually match after this plan; neither keeps its own bespoke markup for this control.

## Review Focus

- **Fleet's dual mobile/desktop render breaks existing single-match test queries.** `FleetTab.test.tsx` currently does `screen.getByText(...)` for bike data; once Task 2 renders both a mobile card list and a desktop table (both present in the DOM, one hidden via CSS), the same text exists twice and `getByText` throws a "multiple elements" error. The task must update the test to scope queries (e.g. `getAllByText` or query within one container), not just add new assertions.
- **Sticker-pool concurrency.** `approve_bike`'s rewrite (Task 11) must claim one sticker from the pool atomically — two admins approving two different bikes at once must never be handed the same `tag_number`. This is the same class of bug the original `approve_bike` design already had to solve once (see its `UPDATE ... RETURNING` on `condo_settings`); the pool-based version needs the equivalent guarantee (`for update skip locked` or a single atomic `UPDATE ... WHERE status='available' ... RETURNING`).
- **Sticker numbering must not collide with tag numbers already assigned the old way.** Bikes approved before this feature shipped already hold real `tag_number` values via the old `condo_settings.next_tag_number` counter. Task 10's batch-generation must seed new sticker numbers starting after `max(existing tag_number, condo_settings.next_tag_number)`, never restarting at 1.
- **Optional photo must not silently produce a broken admin view.** Task 4 makes `photo_url` nullable in practice (resident can skip it). `ApprovalsTab.tsx` already renders a fallback gray box when `photo_url` is falsy (verified in existing code) — Task 4 must not touch that fallback, and should spot-check it still renders correctly with no photo.
- **AdminPage header rewrite must not break tab switching.** Task 1 restructures the header's JSX (flex direction, visibility classes) but the `activeTab` state and the `onClick` handlers it wires to `TABS` must keep working identically — verify by clicking through all three (then four, after PR B) tabs after the change, not just eyeballing the layout.

---

## File Structure

```
src/
├── components/
│   ├── PhotoAttachField.tsx                 # NEW — shared "attach photo" control (Task 5)
│   └── admin/
│       ├── FleetTab.tsx                     # MODIFY — mobile cards, confirm, Ver QR (Tasks 2, 3, 6)
│       ├── FleetTab.test.tsx                # MODIFY — scope queries, new confirm/QR tests
│       ├── OccurrencesTab.tsx               # MODIFY — confirm before resolving (Task 3)
│       ├── StickersTab.tsx                  # NEW (PR B) — batch generation + printable sheet (Task 12)
│       └── StickersTab.test.tsx             # NEW (PR B)
├── pages/
│   ├── AdminPage.tsx                        # MODIFY — responsive header (Task 1), 4th tab (Task 13)
│   ├── PublicBikePage.tsx                   # MODIFY — closure copy, shared PhotoAttachField (Tasks 4, 5)
│   ├── RegisterPage.tsx                     # MODIFY — optional photo, color select, shared field (Tasks 4, 5, 7)
│   └── RegisterPage.test.tsx                # MODIFY — adapt to optional photo (Task 4)
└── types/
    └── database.ts                          # MODIFY (PR B) — add `Sticker` type (Task 9)

supabase/
├── schema.sql                               # MODIFY (PR B) — stickers table, rewritten approve_bike (Task 9)
└── migration_sticker_pool.sql               # NEW (PR B) — standalone migration for the live project (Task 9)
```

---

### Task 1: Admin header stays one row at every breakpoint

**Files:**
- Modify: `src/pages/AdminPage.tsx`

**Interfaces:**
- No new props/exports — this is a layout-only change to the existing `AdminPage` component. `TABS`, `activeTab`, `onClick` handlers stay exactly as they are.

- [ ] **Step 1: Change the header's root flex direction**

In `AdminPage.tsx`'s `<header>`, change the inner wrapper from `flex flex-col md:flex-row items-center justify-between gap-3` to `flex flex-row items-center justify-between gap-2` (drop the `flex-col`/`md:flex-row` split — one row at every width).

- [ ] **Step 2: Condense the logo block for narrow screens**

Hide the "Painel Administrativo" subtitle below `sm` (wrap it in `className="hidden sm:block text-xs text-slate-400"`), so the logo column shrinks to just the icon + "BikeCondo" on mobile.

- [ ] **Step 3: Condense the tab bar for narrow screens**

On the `nav` wrapping the tab buttons, drop `flex-wrap justify-center ... w-full md:w-auto` in favor of `flex-1 md:flex-none flex items-center justify-center gap-1 overflow-x-auto` so tabs stay in one row and scroll horizontally rather than wrap, if they ever don't fit. On each tab `<button>`'s `<span>{tab.label}</span>`, hide the label below `sm` (`className="hidden sm:inline"`) so only the icon shows on mobile — keep `aria-label={tab.label}` on the `<button>` itself so the icon-only state stays accessible.

- [ ] **Step 4: Condense the sign-out control for narrow screens**

On the "Sair" button, hide the `<span>Sair</span>` text below `sm` the same way, keeping the `LogOut` icon and adding `aria-label="Sair"` to the button.

- [ ] **Step 5: Verify manually across breakpoints**

Run the app locally (`npm run dev`), open `/admin` (logged in), and check the header at 375px, 768px, and desktop width: confirm it is a single row at every width, `sticky top-0` no longer pushes content down by more than one row's height on mobile, and clicking each tab still switches `activeTab` correctly (Review Focus item).

- [ ] **Step 6: Run the full suite and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass, since no test currently covers `AdminPage` directly.

- [ ] **Step 7: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "fix: keep the admin header to one row at every breakpoint"
```

---

### Task 2: Fleet tab renders cards on mobile, table on desktop

**Files:**
- Modify: `src/components/admin/FleetTab.tsx`
- Modify: `src/components/admin/FleetTab.test.tsx`

**Interfaces:**
- No prop/export changes. `filteredBikes`, `handleDeactivate`, `loadBikes` stay as they are — only the render output for the bike list changes shape (two parallel renders of the same `filteredBikes` array, one hidden per breakpoint).

- [ ] **Step 1: Write the failing test for the mobile card view**

```tsx
it('renders bike data in both the mobile card list and the desktop table', async () => {
  render(<FleetTab />);
  await waitFor(() => screen.getByText(/Caloi/));
  // Two renders of the same data (one per breakpoint) — use getAllByText, not getByText.
  expect(screen.getAllByText('Bloco A').length).toBeGreaterThanOrEqual(1);
});
```

(Adapt exact bike fixture names to whatever the existing mock in this file already uses — do not invent new fixture data.)

- [ ] **Step 2: Run test to verify current behavior**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: passes today (single table render) — this step establishes the baseline before the DOM shape changes in Step 4.

- [ ] **Step 3: Fix existing single-match queries in this test file**

Any existing `screen.getByText(...)` call in this file that will match bike data appearing in both the new card list and the table must become `screen.getAllByText(...)[0]` (or be scoped with `within(someContainer)`). Do this before Step 4 lands, so the suite stays green throughout — re-run after Step 4 to confirm.

- [ ] **Step 4: Implement the dual render in `FleetTab.tsx`**

Replace the single `<div className="overflow-x-auto"><table>...</table></div>` block with two sibling blocks rendering the same `filteredBikes`:
- `<div className="md:hidden divide-y divide-slate-100">` — one card per bike: tag badge, `unit_block` + `owner_name`, `brand_model` + `color`, a status badge, and a full-width "Dar Baixa" button (only for active bikes) sized for touch (`py-2.5` minimum, not the old small text link).
- `<div className="hidden md:block overflow-x-auto"><table>...</table></div>` — the existing table markup, unchanged except for the wrapping `hidden md:block`.
Keep the empty-state ("Nenhuma bicicleta encontrada") and loading state shared above both (not duplicated).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: PASS, including the Step 1 test and the Step 3 fixes.

- [ ] **Step 6: Verify manually at 375px**

Confirm the card list renders instead of a horizontally-scrolling table, and "Dar Baixa" is comfortably tappable.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/FleetTab.tsx src/components/admin/FleetTab.test.tsx
git commit -m "feat: responsive card layout for the fleet list on mobile"
```

---

### Task 3: Confirm before "Dar Baixa" and "Marcar Resolvida"

**Files:**
- Modify: `src/components/admin/FleetTab.tsx`
- Modify: `src/components/admin/OccurrencesTab.tsx`
- Test: `src/components/admin/FleetTab.test.tsx`, a new or existing `OccurrencesTab.test.tsx` (create one if none exists yet — check first)

**Interfaces:**
- `handleDeactivate(bikeId: string)` in `FleetTab.tsx` and `handleResolve(id: string)` in `OccurrencesTab.tsx` both gain a leading `window.confirm(...)` guard; their Supabase calls move inside the `if (confirmed)` branch. No signature change.

- [ ] **Step 1: Write the failing tests**

For `FleetTab.test.tsx`:
```tsx
it('does not deactivate the bike when the admin cancels the confirmation', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false);
  // ...render, click "Dar Baixa" for a known bike...
  expect(updateMock).not.toHaveBeenCalled();
});
```
For `OccurrencesTab` (new test file if one doesn't exist): same pattern — mock `window.confirm` to return `false`, click "Marcar Resolvida", assert the Supabase `update` call never fires.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx src/components/admin/OccurrencesTab.test.tsx`
Expected: FAIL (confirm guard doesn't exist yet, so the mutation fires regardless of the mocked `confirm`).

- [ ] **Step 3: Add the guard in `FleetTab.handleDeactivate`**

At the top of `handleDeactivate`, before `setDeactivatingId(bikeId)`, add: `if (!window.confirm(`Dar baixa na bike #${bike.tag_number}? Isso libera a vaga.`)) return;` — the function needs the bike object (tag_number), not just the id, to build this message; adjust the call site/signature to pass the bike's tag_number through if it doesn't already have it in scope.

- [ ] **Step 4: Add the guard in `OccurrencesTab.handleResolve`**

Same pattern: `if (!window.confirm('Marcar esta ocorrência como resolvida?')) return;` before the Supabase update.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx src/components/admin/OccurrencesTab.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/FleetTab.tsx src/components/admin/OccurrencesTab.tsx src/components/admin/FleetTab.test.tsx src/components/admin/OccurrencesTab.test.tsx
git commit -m "feat: confirm before deactivating a bike or resolving an incident"
```

---

### Task 4: Bike photo becomes optional on `/cadastro`

**Files:**
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/RegisterPage.test.tsx`

**Interfaces:**
- `handleSubmit` no longer early-returns when `photoFile` is null; it only calls `compressAndUpload` when a file was actually attached, and inserts `photo_url: null` otherwise.

- [ ] **Step 1: Update the existing "blocks submit" test to its new, opposite behavior**

The current test `'blocks submit with a message when no photo was attached'` must be rewritten to assert the opposite: submitting with no photo attached (but all other required fields filled) succeeds and calls `insertMock` with `photo_url: null`. Keep the upload-failure test (`'shows an inline error and preserves typed fields when the upload fails'`) as-is — that one still attaches a photo on purpose, to test the failure path.

- [ ] **Step 2: Run the suite to verify the rewritten test fails against current code**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: FAIL (current code still blocks submit without a photo).

- [ ] **Step 3: Implement in `RegisterPage.tsx`**

In `handleSubmit`: remove the `if (!photoFile) { setPhotoError(...); return; }` guard. Wrap the `compressAndUpload` call in `if (photoFile) { ... }`, setting a local `photoUrl: string | null` that stays `null` when no file was attached. Pass `photo_url: photoUrl` into the `insert` call. Update the photo field's label from `Foto da Bicicleta (para validação visual) *` to drop the `*` (no longer required), and adjust the placeholder copy from "Clique para anexar..." to something that reads naturally as optional, e.g. "Clique para anexar uma foto lateral da bike (opcional)".

- [ ] **Step 4: Run the suite to verify it passes**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Spot-check the admin side handles a null photo**

Read `ApprovalsTab.tsx`'s pending-bike card render (already has a `bike.photo_url ? <img .../> : <fallback div>` branch) — confirm no change needed there; this step is a read-only check, not a code change, per the Review Focus item on this risk.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RegisterPage.tsx src/pages/RegisterPage.test.tsx
git commit -m "feat: make the bike photo optional on resident registration"
```

---

### Task 5: Shared `PhotoAttachField` used by both public pages

**Files:**
- Create: `src/components/PhotoAttachField.tsx`
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/PublicBikePage.tsx`

**Interfaces:**
- Produces: `<PhotoAttachField id={string} file={File | null} onChange={(file: File | null) => void} label={string} required?: boolean />` — a presentational component with no Supabase/upload logic inside it (upload stays owned by each page, exactly as today).

- [ ] **Step 1: Implement `PhotoAttachField`**

Extract the larger dashed-box-with-icon markup currently in `RegisterPage.tsx` (the `reg-photo` label/input block) into this new component, parameterized by `id`, `file`, `onChange`, and `label` (the helper line under the main text, e.g. "JPG ou PNG • Ajuda a evitar troca indevida de adesivo" for the register page, or a shorter line for the incident page). Keep the same two visual states (empty dashed box vs. "attached" state with filename) and the same `accept="image/*"` hidden input.

- [ ] **Step 2: Swap `RegisterPage.tsx` to use it**

Replace the existing inline markup with `<PhotoAttachField id="reg-photo" file={photoFile} onChange={setPhotoFile} label="JPG ou PNG • Ajuda a evitar troca indevida de adesivo" />` (no `required` prop needed after Task 4 — the field is optional everywhere now). Keep `photoError` rendering outside the component, as today.

- [ ] **Step 3: Swap `PublicBikePage.tsx`'s incident photo control to use it**

Replace the current thin dashed pill (`<label className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-dashed ...">`) with the same `<PhotoAttachField id="incident-photo" file={photoFile} onChange={setPhotoFile} label="Ajuda a confirmar o problema reportado" />`, so both pages now share identical visual weight for "attach a photo".

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: `RegisterPage.test.tsx` still passes (same `id="reg-photo"`/behavior, just relocated markup — if any test queries by class name instead of role/label, adjust it to query by the stable `id` or label text instead).

- [ ] **Step 5: Verify manually**

Confirm both `/cadastro` and `/b/:tag` now show visually matching "attach photo" controls.

- [ ] **Step 6: Commit**

```bash
git add src/components/PhotoAttachField.tsx src/pages/RegisterPage.tsx src/pages/PublicBikePage.tsx
git commit -m "refactor: share one photo-attach control between /cadastro and /b/:tag"
```

---

### Task 6: "Ver QR" lets the admin reprint an active bike's sticker

**Files:**
- Modify: `src/components/admin/FleetTab.tsx`

**Interfaces:**
- Reuses the existing QR-modal visual pattern already in `ApprovalsTab.tsx` (a `fixed inset-0` overlay with a white card and `<QRCodeSVG value={...} size={180} />`) — do not create a new shared component for this; copy the small pattern, since `ApprovalsTab`'s version is tied to its own `assignedTag` state and isn't worth abstracting for one more caller.

- [ ] **Step 1: Add a "Ver QR" action per active bike**

In both the Task 2 card and table renders, add a "Ver QR" button (active bikes only, alongside "Dar Baixa") that sets a local `viewingQrTag: string | null` state to that bike's `tag_number`.

- [ ] **Step 2: Render the QR modal**

When `viewingQrTag` is set, render the same overlay pattern as `ApprovalsTab`'s modal, with `<QRCodeSVG value={`${window.location.origin}${window.location.pathname}#/b/${viewingQrTag}`} size={180} />` and a close button that clears `viewingQrTag`.

- [ ] **Step 3: Verify manually**

Click "Ver QR" on an active bike in the fleet list, confirm the same QR that was shown at approval time renders again, and scanning it (or just comparing the encoded URL) resolves to that same bike.

- [ ] **Step 4: Run the suite and build**

Run: `npx vitest run && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/FleetTab.tsx
git commit -m "feat: let admins reprint an active bike's QR from the fleet list"
```

---

### Task 7: Structured "Cor Predominante" field

**Files:**
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/RegisterPage.test.tsx`

**Interfaces:**
- Mirrors the exact pattern Task-already-shipped brand/model cascading select uses: a `COLOR_OPTIONS` array ending in `'Outra cor'`, with a free-text field revealed when that's selected.

- [ ] **Step 1: Update the existing color-field test**

`RegisterPage.test.tsx`'s tests that do `fireEvent.change(screen.getByLabelText(/cor predominante/i), { target: { value: 'Preta' } })` on a text input must change to select from the new dropdown (`fireEvent.change(..., { target: { value: 'Preta' } })` still works identically against a `<select>` as long as `'Preta'` is one of `COLOR_OPTIONS` — no other test change needed if `'Preta'` is kept as an option).

- [ ] **Step 2: Run the suite to confirm it still passes against old code, then fails once you add the option list without wiring the select (sanity check), then implement**

This field doesn't need a strict RED/GREEN cycle since it's a data/markup change with no new business logic — implement directly and verify by running the existing suite.

- [ ] **Step 3: Implement**

Add `const OTHER_COLOR = 'Outra cor'; const COLOR_OPTIONS = ['Preta', 'Branca', 'Prata', 'Vermelha', 'Azul', 'Verde', 'Amarela', 'Cinza', OTHER_COLOR];` near the brand/model constants. Replace the free-text `Cor Predominante` `<input>` with a `<select>` over `COLOR_OPTIONS`, plus a free-text input revealed when `OTHER_COLOR` is selected (same `isOtherX` pattern already used for brand/model). Compute the final `color` value the same way `brandModel` is computed.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/RegisterPage.tsx src/pages/RegisterPage.test.tsx
git commit -m "feat: structured color selection on /cadastro, matching brand/model"
```

---

### Task 8: Friendlier closure on the public QR page's end states

**Files:**
- Modify: `src/pages/PublicBikePage.tsx`

**Interfaces:**
- No new props/state — copy and a small icon/visual change only, in the existing `loadState === 'not-found'` branch and the `whatsappPreview` (post-submit) branch.

- [ ] **Step 1: Write the failing test (new file if `PublicBikePage.test.tsx` doesn't exist yet — check first)**

```tsx
it('shows a closing message after the notification is sent', async () => {
  // ...render in the found + submitted state (mock the RPC and the insert)...
  expect(screen.getByText(/pode fechar esta página/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Update the not-found and post-submit copy**

Not-found branch: keep the existing message, add a second, softer line, e.g. "Se você acabou de escanear um adesivo físico, confirme o número com a administração." (helps a confused scanner without inventing a feature that doesn't exist). Post-submit (`whatsappPreview`) branch: add a closing line below the confirmation box, e.g. "Pronto! Você já pode fechar esta página." with a check icon, so the interaction has a clear, acknowledged ending (Peak-End Rule) instead of trailing off.

- [ ] **Step 4: Run test to verify it passes**

- [ ] **Step 5: Commit**

```bash
git add src/pages/PublicBikePage.tsx
git commit -m "feat: give the public QR page's end states a clear closing message"
```

---

## PR A ends here — commit range from Task 1 through Task 8 is one pull request.

---

### Task 9: `stickers` table, RLS, and rewritten `approve_bike`

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/migration_sticker_pool.sql`
- Modify: `src/types/database.ts`

**Interfaces:**
- Produces: `Sticker` type `{ tag_number: string; status: 'available' | 'assigned'; bike_id: string | null; created_at: string }` in `src/types/database.ts`, consumed by Task 12's `StickersTab`.
- Produces: SQL RPC `generate_sticker_batch(p_count int) returns int` — inserts `p_count` new rows into `stickers` with sequential `tag_number`s continuing after the current maximum (across both `stickers.tag_number` and any pre-existing `bikes.tag_number`), returns the count actually created. `SECURITY DEFINER`, granted only to `authenticated`.
- Rewrites `approve_bike(p_bike_id uuid) returns text`: no longer touches `condo_settings.next_tag_number`. Instead, atomically claims one row from `stickers` where `status = 'available'` (lowest `tag_number` first, `for update skip locked`), sets it to `status = 'assigned', bike_id = p_bike_id`, and sets the target `bikes` row's `tag_number`/`status = 'active'` to match. If no row is available, `raise exception 'Nenhum adesivo disponível. Gere um novo lote.'`.

- [ ] **Step 1: Design the numbering seed**

In `generate_sticker_batch`, the next tag number to start from is `greatest(coalesce((select max(tag_number::int) from stickers), 0), coalesce((select max(tag_number::int) from bikes where tag_number ~ '^[0-9]+$'), 0)) + 1` — guards against colliding with tag numbers assigned by the old direct-increment flow before this feature shipped (Review Focus item). Write this as a `with` CTE inside the function for clarity.

- [ ] **Step 2: Add the `stickers` table + RLS to `schema.sql`**

```sql
create table stickers (
  tag_number text primary key,
  status text not null default 'available' check (status in ('available', 'assigned')),
  bike_id uuid references bikes(id),
  created_at timestamptz not null default now()
);

alter table stickers enable row level security;
grant select on stickers to authenticated;
-- no insert/update grant to anon or authenticated directly — only the
-- SECURITY DEFINER RPCs below ever write to this table.
create policy "stickers_select_authenticated" on stickers for select to authenticated using (true);
```

- [ ] **Step 3: Add `generate_sticker_batch` to `schema.sql`**

Implement per Step 1's numbering rule and the Interfaces block above. `grant execute ... to authenticated;` only (never `anon`).

- [ ] **Step 4: Rewrite `approve_bike` in `schema.sql`**

Replace its body: keep the existing `auth.role() = 'authenticated'` guard and the `status = 'pending'` guard on the target bike, but replace the `condo_settings` increment with:
```sql
update stickers set status = 'assigned', bike_id = p_bike_id
where tag_number = (
  select tag_number from stickers where status = 'available'
  order by tag_number::int limit 1 for update skip locked
)
returning tag_number into v_tag;

if v_tag is null then
  raise exception 'Nenhum adesivo disponível. Gere um novo lote.';
end if;
```
then proceed with the existing `update bikes set tag_number = v_tag, status = 'active' where id = p_bike_id and status = 'pending'` + not-found guard, unchanged.

- [ ] **Step 5: Write `migration_sticker_pool.sql`**

A standalone file with: the `create table stickers ...` block (Step 2) guarded by `create table if not exists`, its RLS/policy (safe to `drop policy if exists` first), `create or replace function generate_sticker_batch(...)`, and `create or replace function approve_bike(...)` (the full rewritten body from Step 4) plus its `revoke`/`grant` lines repeated (idempotent, matching the project's existing `migration_security_fixes.sql` pattern).

- [ ] **Step 6: Add the `Sticker` type**

In `src/types/database.ts`: `export interface Sticker { tag_number: string; status: 'available' | 'assigned'; bike_id: string | null; created_at: string; }`.

- [ ] **Step 7: Manual verification (no live Postgres in this environment — same caveat as every prior SQL task)**

Read through both SQL files for balanced syntax and correct identifiers. Note explicitly in the implementer's report that execution against a real Postgres instance (the live Supabase project, via the SQL editor, exactly like the prior security migration) is the real verification step and happens outside this repo.

- [ ] **Step 8: Commit**

```bash
git add supabase/schema.sql supabase/migration_sticker_pool.sql src/types/database.ts
git commit -m "feat: sticker pool schema, batch generation RPC, and pool-aware approve_bike"
```

---

### Task 10: Apply the migration to the live Supabase project

**Files:** None (operational task, not a code change)

**Interfaces:** None.

- [ ] **Step 1: Run `migration_sticker_pool.sql` against the live project's SQL editor**

Exactly like the prior `migration_security_fixes.sql` — paste and run in the Supabase dashboard's SQL editor for this project, confirm "Success. No rows returned" (or the function-create equivalent), and spot-check with a `select * from stickers;` (expect 0 rows until Task 12 generates the first batch).

- [ ] **Step 2: Smoke-test `generate_sticker_batch` and the rewritten `approve_bike` directly via SQL**

`select generate_sticker_batch(5);` then `select * from stickers order by tag_number;` — confirm 5 rows, numbered starting after whatever the highest existing `bikes.tag_number` already is. Then, with a real pending test bike (insert one via the anon REST API as done earlier in this project's testing, exactly like the final-review verification pass), call `select approve_bike('<that bike's id>');` and confirm it returns one of the 5 new tag numbers and marks that sticker `assigned`. Clean up the test bike and any test stickers afterward via SQL, the same way prior test data was cleaned up in this project.

---

### Task 11: `ApprovalsTab` surfaces the "no stickers available" case clearly

**Files:**
- Modify: `src/components/admin/ApprovalsTab.tsx`

**Interfaces:**
- No new props. `handleApprove`'s existing error-surfacing (`approveError` state, added in a prior fix round) already renders `error.message` inline — this task only needs to confirm that message reads well for this specific error and, if not, special-case it.

- [ ] **Step 1: Check the rendered message**

`approve_bike`'s new exception text is `'Nenhum adesivo disponível. Gere um novo lote.'` — since `ApprovalsTab` already renders `error?.message` verbatim (from the earlier fix-wave finding), confirm this exact string reads fine to an admin as-is. If the raw Postgres error wrapping makes it unclear (e.g. prefixed with a generic Postgres error code), add a small check: `if (error?.message?.includes('Nenhum adesivo disponível')) { setApproveError({ bikeId, message: 'Nenhum adesivo disponível no lote. Gere mais adesivos na aba Adesivos.' }); }` else fall back to the existing generic handling.

- [ ] **Step 2: Add a test for this path**

```tsx
it('tells the admin to generate more stickers when the pool is empty', async () => {
  rpcMock.mockResolvedValue({ data: null, error: { message: 'Nenhum adesivo disponível. Gere um novo lote.' } });
  // ...render, click approve...
  expect(screen.getByText(/gere mais adesivos/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Run the suite**

Run: `npx vitest run src/components/admin/ApprovalsTab.test.tsx`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ApprovalsTab.tsx src/components/admin/ApprovalsTab.test.tsx
git commit -m "feat: clear guidance when the approvals tab hits an empty sticker pool"
```

---

### Task 12: `StickersTab` — generate a batch and print the sheet

**Files:**
- Create: `src/components/admin/StickersTab.tsx`
- Create: `src/components/admin/StickersTab.test.tsx`

**Interfaces:**
- Produces: `<StickersTab />`, mounted as the 4th admin tab in Task 13. Self-contained: fetches `stickers` (via `supabase.from('stickers').select('*').order('tag_number')`), shows the count of `status = 'available'`, a "Gerar lote" control (number input + button calling `supabase.rpc('generate_sticker_batch', { p_count: n })`, then refetching), and a printable grid of all `available` stickers' QR codes.

- [ ] **Step 1: Write the failing test for batch generation**

```tsx
it('calls generate_sticker_batch with the entered count and refetches', async () => {
  // mock supabase.from('stickers').select... to return an initial empty list,
  // mock supabase.rpc to resolve { data: 5, error: null }
  render(<StickersTab />);
  fireEvent.change(screen.getByLabelText(/quantidade/i), { target: { value: '5' } });
  fireEvent.click(screen.getByRole('button', { name: /gerar lote/i }));
  await waitFor(() => expect(rpcMock).toHaveBeenCalledWith('generate_sticker_batch', { p_count: 5 }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/StickersTab.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the fetch + generate-batch UI**

Follow the existing tab conventions (`ApprovalsTab`/`FleetTab`'s card shell, loading state, error surfacing via `window.confirm`-free inline error text). A small form: "Quantidade" number input (default e.g. `20`, `min={1}`), "Gerar Lote" button, showing "`N` adesivos disponíveis" above it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/StickersTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Implement the printable sheet**

Below the generator, render a grid (`grid grid-cols-2 sm:grid-cols-3 gap-4 print:grid-cols-3`) of all `available` stickers, each a small card reusing the dark sticker-mockup style from the original HTML mockup (`mockup_interativo_bikecondo.html`'s "Modelo do Adesivo Físico" section — dark card, "BIKE #NNN" label, white QR panel) sized close to the mockup's stated "7cm × 3,5cm" at print time via a `@media print` block in `src/index.css` (`.sticker-print-card { width: 7cm; height: 3.5cm; }`, applied only within `print:` or a dedicated print stylesheet scope — keep it from affecting normal screen layout). Add a "Imprimir Lote" button calling `window.print()`.

- [ ] **Step 6: Verify manually**

Generate a batch of 5, confirm the grid shows 5 printable cards, and that the browser's print preview (`window.print()`) renders them at a sensible size without cutting off content.

- [ ] **Step 7: Run the full suite and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/StickersTab.tsx src/components/admin/StickersTab.test.tsx src/index.css
git commit -m "feat: generate and print sticker batches ahead of bike approvals"
```

---

### Task 13: Mount the 4th "Adesivos" tab

**Files:**
- Modify: `src/pages/AdminPage.tsx`

**Interfaces:**
- Adds one entry to `AdminPage.tsx`'s `TABS` array and one `{activeTab === 'stickers' && <StickersTab />}` render branch. `TabId` grows to include `'stickers'`.

- [ ] **Step 1: Add the tab**

Add `{ id: 'stickers', label: 'Adesivos', icon: Tag }` (import `Tag` from `lucide-react`, already used elsewhere in the project) to `TABS`, and `{activeTab === 'stickers' && <StickersTab />}` alongside the other three conditional renders.

- [ ] **Step 2: Verify manually**

Confirm all 4 tabs render and switch correctly at mobile and desktop widths (re-checks Task 1's Review Focus item now that there are 4 tabs instead of 3 — re-verify the header still fits in one row on mobile with 4 icon-only tabs).

- [ ] **Step 3: Run the full suite and build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminPage.tsx
git commit -m "feat: mount the Adesivos tab in the admin panel"
```

---

## PR B ends here — commit range from Task 9 through Task 13 is the second pull request, branched from `main` after PR A merges.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-23-ux-adjustments.md`.
