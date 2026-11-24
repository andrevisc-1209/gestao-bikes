# Cadastro Editing, History, and Nav Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin view and edit any active bike's full registration from the Fleet tab, with every edit preserved in a history table, and add a convenience link from `/cadastro` to `/b/:tagNumber`.

**Architecture:** A new `bikes_history` table plus a `security definer` RPC (`update_bike_registration`) snapshot-and-update the `bikes` row atomically, following this codebase's existing RLS/grant pattern for mutating RPCs. A shared `src/lib/bikeOptions.ts` module (extracted from `RegisterPage.tsx`) backs both the registration form and the new edit form so the brand/model/color catalogs never drift apart. A new `BikeDetailModal` component (view + edit) is wired into `FleetTab.tsx`. `RegisterPage.tsx` gets a small secondary nav link to `/b/:tagNumber`.

**Tech Stack:** React + TypeScript + Tailwind, Supabase (Postgres RPC + RLS), react-router-dom (`useNavigate`, `HashRouter`), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-24-cadastro-edit-and-nav-link-design.md`

## Global Constraints

- Any new mutating RPC: RLS enabled + a real policy, a base-table GRANT to `authenticated` (RLS alone does not grant access), EXECUTE revoked from `public` and `anon`, granted only to `authenticated`, and an `auth.role() = 'authenticated'` guard inside the function body.
- `supabase/schema.sql` and a standalone `supabase/migration_bike_edit_history.sql` must define the new table/RPC identically (same pattern as `migration_sticker_pool.sql`).
- All in-app navigation to `/b/:tagNumber` must be `HashRouter`-safe (`useNavigate('/b/<tag>')`, not a manually built URL).
- `tag_number` is always stored 3-digit zero-padded (e.g. `"007"`); any user-typed tag number must be trimmed and zero-padded before use.
- Editing is admin-only; there is no resident self-service edit path in this PR.
- The edit form's Marca/Modelo field is a single free-text input pre-filled with the stored `brand_model` string — **not** `RegisterPage`'s cascading brand→model selects. (`brand_model` is stored as `"${brand} ${model}".trim()` with no distinguishing separator; reverse-matching it against the catalog risks silently misclassifying a legacy or non-matching value as "Outra marca".) `Bloco`/`Apartamento` and `Cor` keep select-based reconstruction (both split/match safely).
- Non-goals (do not build): resident self-service editing, a UI to browse `bikes_history`, editing a bike's photo, editing from `ApprovalsTab`.

## Review Focus

- A resident types a tag number without leading zeros on the new `/cadastro` link (e.g. `7` instead of `007`) — must still resolve to the right bike, not a false "not found".
- `update_bike_registration` is called by an unauthenticated/anon caller — must be rejected, not silently succeed (this codebase has shipped an anon-callable-RPC incident before; every new RPC is checked for this).
- `update_bike_registration` is called with a `bike_id` that doesn't exist (e.g. already deleted) — must raise a clear error and must not insert a `bikes_history` row for a nonexistent bike.
- A bike's stored `color` doesn't match any `COLOR_OPTIONS` entry (an old custom "Outra cor" value) — the edit form must show it as "Outra cor" with the exact original text preserved, not blank or crash.
- A bike's stored `unit_block` doesn't match the expected `"<bloco> • Apto <apto>"` format (malformed/legacy data) — reconstruction must not crash; it falls back to putting the whole string in the apartment field rather than losing data.

---

## Task 1: Shared bike option catalogs

**Files:**
- Create: `src/lib/bikeOptions.ts`
- Modify: `src/pages/RegisterPage.tsx` (replace local `BLOCK_OPTIONS`/`BRAND_MODELS`/`BRAND_OPTIONS`/`COLOR_OPTIONS`/`OTHER_BRAND`/`OTHER_MODEL`/`OTHER_COLOR` definitions with imports)
- Test: `src/pages/RegisterPage.test.tsx` (no new tests needed — existing tests must still pass unchanged, proving the extraction didn't change behavior)

**Interfaces:**
- Produces: `src/lib/bikeOptions.ts` exports `BLOCK_OPTIONS: string[]`, `OTHER_BRAND: string`, `OTHER_MODEL: string`, `BRAND_MODELS: Record<string, string[]>`, `BRAND_OPTIONS: string[]`, `OTHER_COLOR: string`, `COLOR_OPTIONS: string[]` — identical names, values, and order to the constants currently defined at the top of `RegisterPage.tsx`.

- [ ] **Step 1: Create `src/lib/bikeOptions.ts`**

Move the exact constants currently defined in `RegisterPage.tsx` (`BLOCK_OPTIONS`, `OTHER_MODEL`, `OTHER_BRAND`, `BRAND_MODELS`, `BRAND_OPTIONS`, `OTHER_COLOR`, `COLOR_OPTIONS`) into this new file, each as a named `export`. Copy values verbatim — do not re-curate the catalog.

- [ ] **Step 2: Update `RegisterPage.tsx` to import from the new module**

Replace the local constant definitions with `import { BLOCK_OPTIONS, OTHER_BRAND, OTHER_MODEL, BRAND_MODELS, BRAND_OPTIONS, OTHER_COLOR, COLOR_OPTIONS } from '../lib/bikeOptions';`. No other change to `RegisterPage.tsx` in this task.

- [ ] **Step 3: Run `RegisterPage.test.tsx` to confirm no regression**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: both existing tests still PASS, unchanged.

- [ ] **Step 4: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/bikeOptions.ts src/pages/RegisterPage.tsx
git commit -m "refactor: extract shared bike option catalogs"
```

---

## Task 2: Cadastro → ocorrência nav link

**Files:**
- Modify: `src/pages/RegisterPage.tsx` (add the nav link below the submit button)
- Test: `src/pages/RegisterPage.test.tsx` (add new tests)

**Interfaces:**
- Consumes: `useNavigate` from `react-router-dom` (already used elsewhere in this codebase, e.g. `src/pages/LoginPage.tsx`).

- [ ] **Step 1: Write the failing tests**

```tsx
it('normalizes and navigates to /b/:tag when reporting an existing bike', async () => {
  render(<RegisterPage />);
  fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: /reportar um problema/i }));
  expect(navigateMock).toHaveBeenCalledWith('/b/007');
});

it('trims whitespace before navigating', async () => {
  render(<RegisterPage />);
  fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '  12  ' } });
  fireEvent.click(screen.getByRole('button', { name: /reportar um problema/i }));
  expect(navigateMock).toHaveBeenCalledWith('/b/012');
});
```

Add at the top of the test file: `const navigateMock = vi.fn(); vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigateMock }));`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: FAIL — no such label/button exists yet.

- [ ] **Step 3: Implement the link in `RegisterPage.tsx`**

Below the submit button: a secondary, visually lighter button/link with the text "Já tem uma bike cadastrada? Reporte um problema", an input labeled "Número do adesivo" (so `getByLabelText(/número do adesivo/i)` resolves), and a "Reportar um problema" button. On click: `navigate(`/b/${reportTag.trim().padStart(3, '0')}`)` using `useNavigate()`. Keep this visually secondary — smaller text, no emphasis color — so it doesn't compete with "Enviar Cadastro e Solicitar Adesivo".

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: PASS (4 tests total in the file now).

- [ ] **Step 5: Commit**

```bash
git add src/pages/RegisterPage.tsx src/pages/RegisterPage.test.tsx
git commit -m "feat: add a cadastro to incident-report nav link"
```

---

## Task 3: `bikes_history` table and `update_bike_registration` RPC

**Files:**
- Modify: `supabase/schema.sql` (add table + RPC)
- Create: `supabase/migration_bike_edit_history.sql` (standalone mirror, same pattern as `migration_sticker_pool.sql`)

**Interfaces:**
- Produces: RPC `update_bike_registration(p_bike_id uuid, p_unit_block text, p_owner_name text, p_owner_whatsapp text, p_brand_model text, p_color text) returns void`. Table `bikes_history(id uuid pk, bike_id uuid not null references bikes(id), tag_number text, unit_block text not null, owner_name text not null, owner_whatsapp text not null, brand_model text not null, color text not null, photo_url text, status bike_status not null, created_at timestamptz not null, edited_at timestamptz not null default now(), edited_by uuid references auth.users(id))`.

- [ ] **Step 1: Add the `bikes_history` table to `supabase/schema.sql`**

```sql
create table bikes_history (
  id uuid primary key default gen_random_uuid(),
  bike_id uuid not null references bikes(id),
  tag_number text,
  unit_block text not null,
  owner_name text not null,
  owner_whatsapp text not null,
  brand_model text not null,
  color text not null,
  photo_url text,
  status bike_status not null,
  created_at timestamptz not null,
  edited_at timestamptz not null default now(),
  edited_by uuid references auth.users(id)
);

grant select on bikes_history to authenticated;
alter table bikes_history enable row level security;
create policy "bikes_history_select_authenticated" on bikes_history for select to authenticated using (true);
-- No insert/update/delete grant to anyone — only update_bike_registration (security definer) writes here.
```

- [ ] **Step 2: Add the `update_bike_registration` RPC to `supabase/schema.sql`**

```sql
create or replace function update_bike_registration(
  p_bike_id uuid,
  p_unit_block text,
  p_owner_name text,
  p_owner_whatsapp text,
  p_brand_model text,
  p_color text
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

  insert into bikes_history (
    bike_id, tag_number, unit_block, owner_name, owner_whatsapp,
    brand_model, color, photo_url, status, created_at, edited_by
  )
  select id, tag_number, unit_block, owner_name, owner_whatsapp,
         brand_model, color, photo_url, status, created_at, auth.uid()
  from bikes where id = p_bike_id;

  if not found then
    raise exception 'bike not found';
  end if;

  update bikes set
    unit_block = p_unit_block,
    owner_name = p_owner_name,
    owner_whatsapp = p_owner_whatsapp,
    brand_model = p_brand_model,
    color = p_color
  where id = p_bike_id;
end;
$$;

revoke execute on function update_bike_registration(uuid,text,text,text,text,text) from public;
revoke execute on function update_bike_registration(uuid,text,text,text,text,text) from anon;
grant execute on function update_bike_registration(uuid,text,text,text,text,text) to authenticated;
```

- [ ] **Step 3: Create `supabase/migration_bike_edit_history.sql`**

Byte-identical `bikes_history` table, grants, RLS policy, and `update_bike_registration` function/grants from Steps 1-2, as a standalone idempotent migration file (same header/comment style as `supabase/migration_sticker_pool.sql`): a one-line header comment, `create table if not exists bikes_history (...)` (note: `if not exists`, unlike schema.sql's plain `create table`, exactly as `migration_sticker_pool.sql` does for `stickers`), and `create or replace function` for the RPC.

- [ ] **Step 4: Self-review against Global Constraints and Review Focus**

Confirm: `schema.sql` and the migration file define the table and function identically; the EXECUTE revoke/grant triplet and the `auth.role()` check are both present; the "not found" raise happens before any `bikes` row is touched (so a nonexistent `p_bike_id` leaves both `bikes` and `bikes_history` untouched).

- [ ] **Step 5: Commit**

```bash
git add supabase/schema.sql supabase/migration_bike_edit_history.sql
git commit -m "feat: add bikes_history table and update_bike_registration RPC"
```

---

## Task 4: Apply the migration to the live Supabase project

**Files:** none (manual operation against the live project, mirroring Task 10 of `2026-11-23-ux-adjustments.md`)

- [ ] **Step 1: Run `supabase/migration_bike_edit_history.sql` in the live project's SQL editor**

Paste and run the full migration from Task 3. Confirm it completes without error.

- [ ] **Step 2: Verify table grants from the live project**

Run: `select grantee, privilege_type from information_schema.role_table_grants where table_name = 'bikes_history';`
Expected: only `authenticated` has `SELECT`; no `INSERT`/`UPDATE`/`DELETE` rows for `anon` or `authenticated`.

- [ ] **Step 3: Verify RPC grants from the live project**

Run: `select grantee, privilege_type from information_schema.routine_privileges where routine_name = 'update_bike_registration';`
Expected: only `authenticated` has `EXECUTE`; no row for `anon` or `public`.

- [ ] **Step 4: Record completion**

Note in the SDD ledger (or equivalent) that the migration has been applied to the live project, with the date.

---

## Task 5: `BikeDetailModal` component (view + edit)

**Files:**
- Create: `src/components/admin/BikeDetailModal.tsx`
- Test: `src/components/admin/BikeDetailModal.test.tsx`

**Interfaces:**
- Consumes: `BLOCK_OPTIONS`, `COLOR_OPTIONS`, `OTHER_COLOR` from `src/lib/bikeOptions.ts` (Task 1). RPC `update_bike_registration` (Task 3).
- Produces: `BikeDetailModal` component with props `{ bike: Bike; onClose: () => void; onSaved: (updated: Bike) => void }` (`Bike` from `src/types/database.ts` — the full type, not a `Pick`). Default export.

- [ ] **Step 1: Write the failing tests**

```tsx
const rpcMock = vi.fn();
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...args: unknown[]) => rpcMock(...args) } }));

const bike = {
  id: 'bike-1', tag_number: '005', unit_block: 'Bloco A • Apto 504',
  owner_name: 'Mariana Costa', owner_whatsapp: '21999990000',
  brand_model: 'Caloi E-Vibe City', color: 'Preta', photo_url: null,
  status: 'active', created_at: '2026-01-01T00:00:00Z',
};

it('shows every field read-only by default', () => {
  render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByText('Bloco A • Apto 504')).toBeInTheDocument();
  expect(screen.getByText('21999990000')).toBeInTheDocument();
  expect(screen.getByText('Caloi E-Vibe City')).toBeInTheDocument();
});

it('splits unit_block into Bloco and Apartamento when editing', () => {
  render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(screen.getByLabelText(/^bloco/i)).toHaveValue('Bloco A');
  expect(screen.getByLabelText(/apartamento/i)).toHaveValue('504');
});

it('falls back to putting the whole string in Apartamento when unit_block is malformed', () => {
  render(<BikeDetailModal bike={{ ...bike, unit_block: 'unidade sem formato' }} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(screen.getByLabelText(/apartamento/i)).toHaveValue('unidade sem formato');
});

it('pre-selects Outra cor with the original text when color does not match any option', () => {
  render(<BikeDetailModal bike={{ ...bike, color: 'Roxo Metálico' }} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(screen.getByLabelText(/^cor/i)).toHaveValue('Outra cor');
  expect(screen.getByLabelText(/especifique a cor/i)).toHaveValue('Roxo Metálico');
});

it('keeps Marca/Modelo as a single free-text field pre-filled with the stored value', () => {
  render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  expect(screen.getByLabelText(/marca\s*\/\s*modelo/i)).toHaveValue('Caloi E-Vibe City');
});

it('saves via update_bike_registration and calls onSaved with the updated bike', async () => {
  rpcMock.mockResolvedValue({ error: null });
  const onSaved = vi.fn();
  render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  fireEvent.change(screen.getByLabelText(/marca\s*\/\s*modelo/i), { target: { value: 'Caloi E-Vibe City v2' } });
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => {
    expect(rpcMock).toHaveBeenCalledWith('update_bike_registration', {
      p_bike_id: 'bike-1',
      p_unit_block: 'Bloco A • Apto 504',
      p_owner_name: 'Mariana Costa',
      p_owner_whatsapp: '21999990000',
      p_brand_model: 'Caloi E-Vibe City v2',
      p_color: 'Preta',
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ brand_model: 'Caloi E-Vibe City v2' }));
  });
});

it('shows the RPC error and does not call onSaved when the update fails', async () => {
  rpcMock.mockResolvedValue({ error: { message: 'bike not found' } });
  const onSaved = vi.fn();
  render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={onSaved} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  fireEvent.click(screen.getByRole('button', { name: /salvar/i }));
  await waitFor(() => {
    expect(screen.getByText(/não foi possível salvar/i)).toBeInTheDocument();
  });
  expect(onSaved).not.toHaveBeenCalled();
});

it('discards edits and returns to read-only on Cancelar', () => {
  render(<BikeDetailModal bike={bike} onClose={vi.fn()} onSaved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /editar/i }));
  fireEvent.change(screen.getByLabelText(/marca\s*\/\s*modelo/i), { target: { value: 'rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
  expect(screen.getByText('Caloi E-Vibe City')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/BikeDetailModal.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `BikeDetailModal`**

Read-only view: same visual language as `ApprovalsTab`'s pending-bike card (photo or placeholder, `unit_block`, `owner_name`, `brand_model`, `color`) plus an `owner_whatsapp` row (not present in `ApprovalsTab`'s card). An "Editar" button switches to edit mode:
- `unit_block` splits on the regex `/^(.*) • Apto (.*)$/` into a `Bloco` select (options from `BLOCK_OPTIONS`) and a free-text `Apartamento` input; no match → `Bloco` defaults to `BLOCK_OPTIONS[0]` and the whole original string goes into `Apartamento`.
- `owner_name`, `owner_whatsapp` — plain text inputs, prefilled.
- `brand_model` — single free-text input labeled "Marca / Modelo", prefilled with the raw stored string, no catalog matching.
- `color` — a select from `COLOR_OPTIONS`; if the stored value isn't in `COLOR_OPTIONS`, the select shows `OTHER_COLOR` and a second input labeled "Especifique a cor" appears, prefilled with the stored value.
"Salvar" recomposes `unit_block` as `` `${block} • Apto ${apartment.trim()}` ``, `color` as the custom value when `OTHER_COLOR` is selected else the selected option, then calls `supabase.rpc('update_bike_registration', { p_bike_id: bike.id, p_unit_block, p_owner_name, p_owner_whatsapp, p_brand_model, p_color })`. On success, calls `onSaved` with the bike object merged with the new field values and returns to read-only (or closes, implementer's choice). On error, shows `error.message || 'Não foi possível salvar as alterações. Tente novamente.'` and stays in edit mode. "Cancelar" discards all edit-mode state and returns to read-only with the original values untouched.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/BikeDetailModal.test.tsx`
Expected: PASS (9 tests).

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/BikeDetailModal.tsx src/components/admin/BikeDetailModal.test.tsx
git commit -m "feat: add BikeDetailModal for viewing and editing a bike's registration"
```

---

## Task 6: Mount `BikeDetailModal` in `FleetTab`

**Files:**
- Modify: `src/components/admin/FleetTab.tsx`
- Test: `src/components/admin/FleetTab.test.tsx`

**Interfaces:**
- Consumes: `BikeDetailModal` (Task 5), props `{ bike: Bike; onClose: () => void; onSaved: (updated: Bike) => void }`.

- [ ] **Step 1: Write the failing tests**

```tsx
it('opens BikeDetailModal with the full bike row when "Ver cadastro completo" is clicked', async () => {
  // existing FleetTab mock returns the lean FleetBike projection; this test
  // additionally mocks a second supabase.from('bikes').select('*').eq('id', ...) call
  // returning the full row, and asserts the modal renders bike.owner_whatsapp.
  render(<FleetTab />);
  await screen.findByText('#005');
  fireEvent.click(screen.getAllByRole('button', { name: /ver cadastro completo/i })[0]);
  await waitFor(() => {
    expect(screen.getByText('21999990000')).toBeInTheDocument();
  });
});

it('refreshes the fleet list after a save in the modal', async () => {
  // same setup; after saving (mocked onSaved call path), loadBikes() must be
  // re-invoked — assert the updated brand_model appears in the list.
});
```

Follow this file's existing mock style for `supabase.from('bikes')` (see the existing `loadBikes`/`handleDeactivate` tests) — add the second query the button triggers as an additional mock resolution.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: FAIL — no "Ver cadastro completo" button exists yet.

- [ ] **Step 3: Implement in `FleetTab.tsx`**

Add state `const [detailBike, setDetailBike] = useState<Bike | null>(null);` and `const [detailError, setDetailError] = useState<string | null>(null);`. Add a "Ver cadastro completo" button next to "Ver QR"/"Dar Baixa" in both the mobile card block (~line 174-197) and the desktop table row (~line 256-279). On click: `const { data, error } = await supabase.from('bikes').select('*').eq('id', bike.id).single();` — on success `setDetailBike(data as Bike)`, on error `setDetailError(...)`. Render `<BikeDetailModal bike={detailBike} onClose={() => setDetailBike(null)} onSaved={async () => { setDetailBike(null); await loadBikes(); }} />` when `detailBike` is set, alongside the existing `viewingQrTag` modal render block.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/FleetTab.tsx src/components/admin/FleetTab.test.tsx
git commit -m "feat: mount BikeDetailModal in FleetTab"
```
