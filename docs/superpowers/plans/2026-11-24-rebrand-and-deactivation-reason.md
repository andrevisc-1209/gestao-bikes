# Rebranding and Deactivation Reason/History Implementation Plan (PR A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "BikeCondo" placeholder branding with the real building name, and make deactivating a bike ("Dar Baixa") capture a reason and notes, recorded in `bikes_history` the same way an edit is.

**Architecture:** The rebrand is a handful of literal-string replacements plus a data update on the live `condo_settings` row. The deactivation change extends the existing `bikes_history` table with `action`/`reason`/`notes` columns and adds a new `deactivate_bike` RPC that atomically snapshots-then-updates via a single data-modifying CTE, replacing `FleetTab`'s direct `status` update; a new `DeactivateBikeModal` collects the reason (fixed list + "Outro") and free-text notes before calling it.

**Tech Stack:** React + TypeScript + Tailwind, Supabase (Postgres RPC + RLS), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-24-branding-deactivation-public-nav-design.md`

## Global Constraints

- Any new mutating RPC: RLS enabled + a real policy, a base-table GRANT to `authenticated`, EXECUTE revoked from `public` and `anon`, granted only to `authenticated`, and an `auth.role() = 'authenticated'` guard inside the function body.
- `supabase/schema.sql` and a standalone `supabase/migration_deactivation_reason.sql` must define the schema change and RPC identically (same pattern as prior migration files in this repo).
- `deactivate_bike` must use the exact data-modifying-CTE shape from the design doc (update-then-insert as one atomic statement) so a double-fire (two admin tabs, a retried click) can never produce two history rows nor touch an already-inactive bike — this was a real bug a builder-check caught in an earlier draft, do not regress it.
- The notes field on deactivation is always available, not conditional on picking "Outro" as the reason.
- Non-goals (do not build): a UI to browse `bikes_history`, editing a past deactivation's reason/notes, any change to `ApprovalsTab`.

## Review Focus

- An admin deactivates the same bike twice in a row (e.g. a stale second tab, a double-click before the button disables) — the second attempt must not create a second history row or error in a confusing way.
- An admin picks "Outro" as the reason but leaves the free-text reason unspecified — the RPC still only receives `p_reason = 'Outro'` plus whatever notes were typed; this is fine since "Outro" is itself a valid, final reason value, and notes are optional.
- `deactivate_bike` is called by an unauthenticated/anon caller — must be rejected, not silently succeed (this codebase has shipped an anon-callable-RPC incident before).
- `deactivate_bike` is called with a `p_bike_id` that doesn't exist — must raise a clear error and must not insert a `bikes_history` row for a nonexistent bike.
- The rebrand must not leave any of the 3 known occurrences ("BikeCondo" in `AdminPage.tsx`, `index.html`, `manifest.webmanifest`) un-replaced, while not touching `README.md` or the unrelated static mockup file (`mockup_interativo_bikecondo.html`), which aren't app-facing surfaces.

---

## Task 1: Rebrand to "Solar de Laranjeiras"

**Files:**
- Modify: `src/pages/AdminPage.tsx` (header brand text)
- Modify: `index.html` (`<title>`)
- Modify: `public/manifest.webmanifest` (`name`, `short_name`)

**Interfaces:** none — pure text replacement, no new exports.

- [ ] **Step 1: Replace the 3 literal occurrences**

In `AdminPage.tsx`, change `<span className="font-extrabold text-lg tracking-tight">BikeCondo</span>` to `<span className="font-extrabold text-lg tracking-tight">Solar de Laranjeiras</span>`. In `index.html`, change the `<title>` to `Solar de Laranjeiras — Gestão Inteligente de Bikes Elétricas`. In `public/manifest.webmanifest`, change both `"name"` and `"short_name"` values to `"Solar de Laranjeiras"`.

- [ ] **Step 2: Grep to confirm no other app-facing occurrence remains**

Run: `grep -rniE "bikecondo" src/ index.html public/manifest.webmanifest`
Expected: no matches (do not touch `README.md` or `mockup_interativo_bikecondo.html` — out of scope, not user-facing app surfaces).

- [ ] **Step 3: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/pages/AdminPage.tsx index.html public/manifest.webmanifest
git commit -m "feat: rebrand to Solar de Laranjeiras"
```

---

## Task 2: `bikes_history` schema extension and `deactivate_bike` RPC

**Files:**
- Modify: `supabase/schema.sql` (extend `bikes_history`, add the RPC)
- Create: `supabase/migration_deactivation_reason.sql` (standalone mirror)

**Interfaces:**
- Produces: `bikes_history` gains `action text not null default 'edit' check (action in ('edit', 'deactivate'))`, `reason text`, `notes text`. RPC `deactivate_bike(p_bike_id uuid, p_reason text, p_notes text) returns void`.

- [ ] **Step 1: Extend `bikes_history` in `supabase/schema.sql`**

```sql
alter table bikes_history add column action text not null default 'edit' check (action in ('edit', 'deactivate'));
alter table bikes_history add column reason text;
alter table bikes_history add column notes text;
```

(`update_bike_registration`'s existing insert is unchanged — it doesn't set `action`/`reason`/`notes`, so those rows default to `action = 'edit'` with `reason`/`notes` null, exactly as before.)

- [ ] **Step 2: Add the `deactivate_bike` RPC to `supabase/schema.sql`**

```sql
create or replace function deactivate_bike(
  p_bike_id uuid,
  p_reason text,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() != 'authenticated' then
    raise exception 'not authorized';
  end if;

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
end;
$$;

revoke execute on function deactivate_bike(uuid,text,text) from public;
revoke execute on function deactivate_bike(uuid,text,text) from anon;
grant execute on function deactivate_bike(uuid,text,text) to authenticated;
```

- [ ] **Step 3: Create `supabase/migration_deactivation_reason.sql`**

A standalone idempotent migration mirroring Steps 1-2 (same header/comment style as `migration_bike_edit_history.sql`): `alter table ... add column if not exists` for the 3 new columns, `create or replace function` for the RPC, same grants.

- [ ] **Step 4: Self-review**

Confirm: the CTE guarantees the insert only happens when the update actually affected a row (a nonexistent `p_bike_id`, or one already `inactive`, must leave `bikes_history` untouched); the EXECUTE revoke/grant triplet and `auth.role()` check are present; `schema.sql` and the migration define the change identically.

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql supabase/migration_deactivation_reason.sql
git commit -m "feat: add deactivation reason/notes to bikes_history via deactivate_bike RPC"
```

---

## Task 3: Apply the migration to the live Supabase project

**Files:** none (manual operation against the live project)

- [ ] **Step 1: Run `supabase/migration_deactivation_reason.sql` in the live project's SQL editor**

Confirm it completes without error.

- [ ] **Step 2: Verify RPC grants**

Run: `select grantee, privilege_type from information_schema.routine_privileges where routine_name = 'deactivate_bike';`
Expected: only `authenticated` (and the table owner) has `EXECUTE`; no `anon`/`public` row.

- [ ] **Step 3: Update the live `condo_settings.condo_name` row**

Run: `update condo_settings set condo_name = 'Solar de Laranjeiras';`
Expected: 1 row updated.

- [ ] **Step 4: Record completion**

Note in the SDD ledger that the migration and the data update have been applied to the live project.

---

## Task 4: `DEACTIVATION_REASONS` catalog and `DeactivateBikeModal` component

**Files:**
- Modify: `src/lib/bikeOptions.ts` (add the new catalog)
- Create: `src/components/admin/DeactivateBikeModal.tsx`
- Test: `src/components/admin/DeactivateBikeModal.test.tsx`

**Interfaces:**
- Produces: `src/lib/bikeOptions.ts` exports `DEACTIVATION_REASONS: string[]` = `['Mudança de endereço', 'Roubo/Furto', 'Perda', 'Venda da bicicleta', 'Outro']`. `DeactivateBikeModal` component, default export, props `{ bike: { id: string; tag_number: string | null }; onClose: () => void; onDeactivated: () => void }`.

- [ ] **Step 1: Add `DEACTIVATION_REASONS` to `src/lib/bikeOptions.ts`**

```ts
export const DEACTIVATION_REASONS = ['Mudança de endereço', 'Roubo/Furto', 'Perda', 'Venda da bicicleta', 'Outro'];
```

- [ ] **Step 2: Write the failing tests**

```tsx
const rpcMock = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpcMock(...args) } }));

const bike = { id: 'bike-1', tag_number: '005' };

it('defaults to the first reason and calls deactivate_bike with the selected reason and notes', async () => {
  rpcMock.mockResolvedValue({ error: null });
  const onDeactivated = vi.fn();
  render(<DeactivateBikeModal bike={bike} onClose={vi.fn()} onDeactivated={onDeactivated} />);

  fireEvent.change(screen.getByLabelText(/motivo/i), { target: { value: 'Roubo/Furto' } });
  fireEvent.change(screen.getByLabelText(/observações/i), { target: { value: 'Boletim de ocorrência anexado' } });
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

  await waitFor(() => {
    expect(rpcMock).toHaveBeenCalledWith('deactivate_bike', {
      p_bike_id: 'bike-1',
      p_reason: 'Roubo/Furto',
      p_notes: 'Boletim de ocorrência anexado',
    });
    expect(onDeactivated).toHaveBeenCalled();
  });
});

it('shows the RPC error and does not call onDeactivated when the deactivation fails', async () => {
  rpcMock.mockResolvedValue({ error: { message: 'bike not found or already inactive' } });
  const onDeactivated = vi.fn();
  render(<DeactivateBikeModal bike={bike} onClose={vi.fn()} onDeactivated={onDeactivated} />);

  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));

  await waitFor(() => {
    expect(screen.getByText('bike not found or already inactive')).toBeInTheDocument();
  });
  expect(onDeactivated).not.toHaveBeenCalled();
});

it('calls onClose without calling the RPC when Cancelar is clicked', () => {
  const onClose = vi.fn();
  render(<DeactivateBikeModal bike={bike} onClose={onClose} onDeactivated={vi.fn()} />);

  fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));

  expect(onClose).toHaveBeenCalled();
  expect(rpcMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/DeactivateBikeModal.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 4: Implement `DeactivateBikeModal`**

Same visual family as `BikeDetailModal` (fixed overlay, centered white card, close button). Contents: a heading naming the bike's tag (`Dar baixa na bike #${bike.tag_number}`), a `<select>` labeled "Motivo" defaulting to `DEACTIVATION_REASONS[0]`, a `<textarea>` labeled "Observações" (optional, always shown), "Confirmar" and "Cancelar" buttons. "Confirmar" calls `supabase.rpc('deactivate_bike', { p_bike_id: bike.id, p_reason: reason, p_notes: notes })`; on success calls `onDeactivated()`; on error shows `error.message || 'Não foi possível dar baixa na bicicleta. Tente novamente.'` and stays open. "Cancelar" calls `onClose()` without touching the RPC.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/DeactivateBikeModal.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/bikeOptions.ts src/components/admin/DeactivateBikeModal.tsx src/components/admin/DeactivateBikeModal.test.tsx
git commit -m "feat: add DeactivateBikeModal for capturing a deactivation reason"
```

---

## Task 5: Wire `DeactivateBikeModal` into `FleetTab`, replacing the native confirm

**Files:**
- Modify: `src/components/admin/FleetTab.tsx`
- Test: `src/components/admin/FleetTab.test.tsx`

**Interfaces:**
- Consumes: `DeactivateBikeModal` (Task 4), props `{ bike: { id: string; tag_number: string | null }; onClose: () => void; onDeactivated: () => void }`.

- [ ] **Step 1: Write the failing test**

```tsx
it('opens DeactivateBikeModal instead of window.confirm when "Dar Baixa" is clicked, and refreshes the list on success', async () => {
  render(<FleetTab />);
  await screen.findByText('#005');

  fireEvent.click(screen.getAllByRole('button', { name: /dar baixa/i })[0]);
  expect(screen.getByText(/dar baixa na bike #005/i)).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(screen.queryByText(/dar baixa na bike #005/i)).not.toBeInTheDocument();
  });
});
```

Mock `DeactivateBikeModal` in this test file the same way Task 6 of the prior plan mocked `BikeDetailModal` (a minimal fake rendering the heading text and a "Confirmar" button that calls `onDeactivated`), keeping `FleetTab`'s own test scoped to its wiring rather than re-testing `DeactivateBikeModal`'s internals (already covered by its own test file).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: FAIL — `window.confirm` still gates deactivation, no modal to find.

- [ ] **Step 3: Implement in `FleetTab.tsx`**

Replace `handleDeactivate`'s `window.confirm(...)` + direct `supabase.from('bikes').update(...)` with: a new `deactivatingBike` state set on "Dar Baixa" click; render `<DeactivateBikeModal bike={deactivatingBike} onClose={() => setDeactivatingBike(null)} onDeactivated={async () => { setDeactivatingBike(null); onCapacityChanged(); await loadBikes(); }} />` when `deactivatingBike` is truthy. Remove the now-unused `deactivatingId`/`deactivateError` state and the inline error rendering that depended on them (the modal shows its own error).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/FleetTab.tsx src/components/admin/FleetTab.test.tsx
git commit -m "feat: capture a reason and notes when deactivating a bike"
```
