# Admin Detail, Timestamps, and Incident Resolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface registration/deactivation timestamps in `BikeDetailModal`, rename a KPI label, mask the WhatsApp input while typing, reuse `BikeDetailModal` for the Aprovações pending-request detail view, show contact/registration info on each occurrence, and let an admin record a reason + notes when resolving an occurrence.

**Architecture:** Mostly reuse of existing components (`BikeDetailModal`, the modal-chrome pattern from `DeactivateBikeModal`) against existing data (`bikes_history`, already-fetched full `Bike` rows) — one small schema addition (two nullable columns on `incidents`) with no new RPC, since `incidents` already grants `authenticated` a direct UPDATE (unlike `bikes`, which needed an RPC specifically to pair a snapshot-insert with the update).

**Tech Stack:** React + TypeScript + Tailwind, Supabase (Postgres + RLS), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-24-admin-detail-and-resolution-design.md`

**Base:** `main` already has PR #5 (rebrand + `deactivate_bike`/`bikes_history.action,reason,notes`/`DeactivateBikeModal`/`DEACTIVATION_REASONS`) and PR #6 (public nav + QR scanning) merged — every dependency this plan relies on already exists.

## Global Constraints

- `owner_whatsapp` stays stored as digits only (e.g. `"21999990000"`) — the phone mask is display-only; the value submitted/stored is never the punctuated string.
- `BikeDetailModal`'s existing props (`{ bike: Bike; onClose: () => void; onSaved: (updated: Bike) => void }`) do not change — it's reused as-is in `ApprovalsTab` and `OccurrencesTab`, exactly how `FleetTab` already uses it.
- **Deviation from the design doc, decided during planning:** the design doc proposed a `resolve_incident` RPC for recording a resolution reason/notes. Checking `supabase/schema.sql` shows `incidents` already has `grant select, insert, update, delete on incidents to authenticated` plus a permissive `for all` RLS policy for `authenticated` — this table's established pattern (unlike `bikes`, which needed an RPC to pair an audit-snapshot insert with its update) is a direct client-side update, which is what `OccurrencesTab`'s current `handleResolve` already does. Adding an RPC here would introduce an inconsistent, unnecessary extra layer for a table whose security model already permits the direct update. **This plan has no new RPC and no migration file beyond the two new columns** — `ResolveIncidentModal`'s confirm action calls `supabase.from('incidents').update({...})` directly, same security posture as today.
- Any new mutating RPC in this project (none are added here, but if one were) must follow: RLS enabled + a real policy, a base-table GRANT to `authenticated`, EXECUTE revoked from `public`/`anon`, granted only to `authenticated`, an `auth.role() = 'authenticated'` guard — recorded for completeness, not applicable to this plan's own scope.

## Review Focus

- `BikeDetailModal` opened for an ACTIVE bike must not show any "Baixa em" section at all (no stray "undefined"/empty fields) — only inactive bikes have a deactivation to show.
- `BikeDetailModal` opened for an inactive bike whose `bikes_history` query returns no row (a bike deactivated before this feature shipped, or one deactivated via a path that didn't go through `deactivate_bike`) must not crash or show broken placeholder text — the "Baixa em" section simply doesn't render.
- The phone mask must handle a paste of a full 11-digit number (not just incremental typing) and format it correctly on the first render, not just as each keystroke arrives.
- Resolving an incident that was already resolved by someone else in the meantime (e.g. two admin tabs) — the direct `.update()` with no row-count guard today could silently "succeed" with 0 rows affected; this plan's `ResolveIncidentModal` should check the Supabase response's row count (or re-fetch) and surface an error rather than silently reporting success when nothing was actually updated.
- `ApprovalsTab` reusing `BikeDetailModal`: approving a bike (`Atribuir Adesivo`) while its detail modal happens to be open for that same bike must not leave the modal showing stale data or crash when the list reloads out from under it.

---

## Task 1: Rename the KPI label

**Files:**
- Modify: `src/components/admin/KpiCards.tsx`

**Interfaces:** none.

- [ ] **Step 1: Replace the label**

Change `"Bikes Emplacadas (Ativas)"` to `"Bikes Adesivadas (Ativas)"`.

- [ ] **Step 2: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/KpiCards.tsx
git commit -m "feat: rename Bikes Emplacadas to Bikes Adesivadas"
```

---

## Task 2: Phone mask on the WhatsApp input

**Files:**
- Create: `src/lib/phone.ts`
- Test: `src/lib/phone.test.ts`
- Modify: `src/pages/RegisterPage.tsx` (the `id="reg-phone"` input)
- Modify: `src/components/admin/BikeDetailModal.tsx` (the edit-mode WhatsApp input)

**Interfaces:**
- Produces: `formatBrazilPhone(digits: string): string` — given a string, strips all non-digit characters, truncates to 11 digits, and progressively applies `(XX) XXXXX-XXXX` punctuation depending on how many digits are present (e.g. 2 digits → `"(21"`, 7 digits → `"(21) 99999"`, 11 digits → `"(21) 99999-0000"`). Never throws on empty or already-punctuated input.

- [ ] **Step 1: Write the failing tests**

```ts
import { formatBrazilPhone } from './phone';

it('formats a full 11-digit number', () => {
  expect(formatBrazilPhone('21999990000')).toBe('(21) 99999-0000');
});

it('formats partial input as the user types, digit by digit', () => {
  expect(formatBrazilPhone('2')).toBe('(2');
  expect(formatBrazilPhone('21')).toBe('(21');
  expect(formatBrazilPhone('219')).toBe('(21) 9');
  expect(formatBrazilPhone('21999990')).toBe('(21) 99999');
});

it('strips non-digit characters before formatting, so a pasted formatted number re-formats correctly', () => {
  expect(formatBrazilPhone('(21) 99999-0000')).toBe('(21) 99999-0000');
});

it('truncates input beyond 11 digits instead of overflowing the mask', () => {
  expect(formatBrazilPhone('219999900001234')).toBe('(21) 99999-0000');
});

it('returns an empty string for empty input', () => {
  expect(formatBrazilPhone('')).toBe('');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/phone.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `formatBrazilPhone` in `src/lib/phone.ts`**

Strip non-digits (`replace(/\D/g, '')`), slice to the first 11 characters, then build the punctuated string progressively based on the digit count (0 digits → `''`; 1-2 → `(XX`; 3-7 → `(XX) XXXXX`-shaped using however many digits are present after the area code; 8-11 → insert the `-` before the last 4 digits). The exact branching is up to you as long as every test above passes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/phone.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Apply the mask in `RegisterPage.tsx`**

The `id="reg-phone"` input's `value` becomes `formatBrazilPhone(whatsapp)`; its `onChange` extracts only the digits from the new input value (`event.target.value.replace(/\D/g, '').slice(0, 11)`) and stores THAT (not the formatted string) in the `whatsapp` state — so `whatsapp` itself stays digit-only (what's already submitted to `insert({ owner_whatsapp: whatsapp.trim(), ... })` elsewhere in this file, unchanged).

- [ ] **Step 6: Apply the same mask in `BikeDetailModal.tsx`'s edit-mode WhatsApp input**

Same pattern: the `ownerWhatsapp` state stays digit-only, the input's displayed `value` is `formatBrazilPhone(ownerWhatsapp)`, `onChange` stores the stripped digits.

- [ ] **Step 7: Run the full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass (existing `RegisterPage.test.tsx` and `BikeDetailModal.test.tsx` tests that set `whatsapp`/`ownerWhatsapp` via `fireEvent.change` with a digit-only value must still pass unchanged, since the stored state is still digit-only — only the displayed value changes).

- [ ] **Step 8: Commit**

```bash
git add src/lib/phone.ts src/lib/phone.test.ts src/pages/RegisterPage.tsx src/components/admin/BikeDetailModal.tsx
git commit -m "feat: mask the WhatsApp input while typing, storage unchanged"
```

---

## Task 3: Registration and deactivation timestamps in `BikeDetailModal`

**Files:**
- Modify: `src/components/admin/BikeDetailModal.tsx`
- Test: `src/components/admin/BikeDetailModal.test.tsx`

**Interfaces:**
- Consumes: `bikes_history` (already exists, has `edited_at`, `reason`, `notes`, `action` columns since PR #5).

- [ ] **Step 1: Write the failing tests**

```tsx
const bikeActive = { ...bike, status: 'active' as const };
const bikeInactive = { ...bike, status: 'inactive' as const };

it('always shows the registration date', () => {
  render(<BikeDetailModal bike={bikeActive} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
});

it('does not show a deactivation section for an active bike', () => {
  render(<BikeDetailModal bike={bikeActive} onClose={vi.fn()} onSaved={vi.fn()} />);
  expect(screen.queryByText(/baixa em/i)).not.toBeInTheDocument();
});

it('shows the deactivation date, reason and notes for an inactive bike with a matching history row', async () => {
  // mock supabase.from('bikes_history').select(...).eq(...).eq(...).order(...).limit(...).single()
  // resolving to { data: { edited_at: '2026-01-15T10:00:00Z', reason: 'Roubo/Furto', notes: 'BO anexado' }, error: null }
  render(<BikeDetailModal bike={bikeInactive} onClose={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => {
    expect(screen.getByText(/baixa em/i)).toBeInTheDocument();
    expect(screen.getByText('Roubo/Furto')).toBeInTheDocument();
    expect(screen.getByText('BO anexado')).toBeInTheDocument();
  });
});

it('shows no deactivation section for an inactive bike with no matching history row, without crashing', async () => {
  // mock the same query resolving to { data: null, error: { message: 'no rows' } } (or a PostgREST "no rows" shape)
  render(<BikeDetailModal bike={bikeInactive} onClose={vi.fn()} onSaved={vi.fn()} />);
  await waitFor(() => expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument());
  expect(screen.queryByText(/baixa em/i)).not.toBeInTheDocument();
});
```

Mock `supabase.from` so it still serves the existing `rpc` mock for `update_bike_registration` (already in this test file) alongside a new `from('bikes_history')` chain — follow this file's existing mocking conventions.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/BikeDetailModal.test.tsx`
Expected: FAIL — no "Cadastrado em"/"Baixa em" text yet.

- [ ] **Step 3: Implement in `BikeDetailModal.tsx`**

Add a small date formatter (e.g. `formatTimestamp(value: string): string` using `new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })` — the same shape `OccurrencesTab.tsx`'s existing local `formatTimestamp` already uses; define your own local copy here rather than importing from `OccurrencesTab` to avoid a cross-component import, duplication of ~6 lines is acceptable here). In the read-only view, always show `Cadastrado em: {formatTimestamp(bike.created_at)}`. On mount (a `useEffect` keyed on `bike.id`), if `bike.status === 'inactive'`, query `supabase.from('bikes_history').select('edited_at, reason, notes').eq('bike_id', bike.id).eq('action', 'deactivate').order('edited_at', { ascending: false }).limit(1).single()`; store the result (or `null` on error/no row) in state, and if present, render a "Baixa em: {formatTimestamp(...)}", "Motivo: {reason}", and the notes (if non-empty) below the registration date line.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/BikeDetailModal.test.tsx`
Expected: PASS (all tests, old + 4 new).

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/BikeDetailModal.tsx src/components/admin/BikeDetailModal.test.tsx
git commit -m "feat: show registration and deactivation timestamps in BikeDetailModal"
```

---

## Task 4: Reuse `BikeDetailModal` for the Aprovações pending-request detail view

**Files:**
- Modify: `src/components/admin/ApprovalsTab.tsx`
- Test: `src/components/admin/ApprovalsTab.test.tsx`

**Interfaces:**
- Consumes: `BikeDetailModal` (unchanged props from Task 3: `{ bike: Bike; onClose: () => void; onSaved: (updated: Bike) => void }`).

- [ ] **Step 1: Write the failing test**

```tsx
it('opens BikeDetailModal with the full pending bike when its card is clicked', async () => {
  render(<ApprovalsTab onApproved={vi.fn()} />);
  await screen.findByText(/mariana costa/i); // or whatever the existing seed fixture's owner_name is
  fireEvent.click(screen.getByText(/mariana costa/i).closest('div')!); // or a dedicated clickable wrapper — implementer's call on the exact click target, as long as it's the pending card itself, not the "Atribuir Adesivo" button
  await waitFor(() => {
    expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument(); // proves the real BikeDetailModal rendered, using Task 3's own content
  });
});

it('clicking "Atribuir Adesivo" still approves without opening the detail modal', async () => {
  render(<ApprovalsTab onApproved={vi.fn()} />);
  await screen.findByText(/mariana costa/i);
  fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
  // existing approve-flow assertions, unchanged from before this task
  expect(screen.queryByText(/cadastrado em/i)).not.toBeInTheDocument();
});

it('approving a bike while its own detail modal is open does not crash and closes cleanly', async () => {
  render(<ApprovalsTab onApproved={vi.fn()} />);
  await screen.findByText(/mariana costa/i);
  fireEvent.click(screen.getByText(/mariana costa/i).closest('div')!);
  await waitFor(() => expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument());
  // approve the same bike while its modal is still open (e.g. via the modal's own context,
  // or simulate the list reloading under it) — loadPendingBikes() re-running must not
  // touch viewingBike state or throw; the modal stays showing its own snapshot until
  // the admin explicitly closes it.
  fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
  await waitFor(() => {
    expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument(); // modal unaffected by the list reload
  });
});
```

Follow this file's existing mock conventions for `supabase.from('bikes').select('*')...` and `supabase.rpc('approve_bike', ...)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/ApprovalsTab.test.tsx`
Expected: FAIL — no click-to-detail behavior yet.

- [ ] **Step 3: Implement in `ApprovalsTab.tsx`**

Widen the `PendingBike` type to the full `Bike` type imported from `../../types/database` (the query is already `select('*')`, so no new fetch is needed — only the TS narrowing changes). Add `viewingBike: Bike | null` state. Make the pending-bike card's main content area (not the "Atribuir Adesivo" button, which must keep its own `onClick` and not also trigger the detail view) clickable, setting `viewingBike` to that row. Render `<BikeDetailModal bike={viewingBike} onClose={() => setViewingBike(null)} onSaved={async (updated) => { setViewingBike(null); await loadPendingBikes(); }} />` when `viewingBike` is truthy.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/ApprovalsTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ApprovalsTab.tsx src/components/admin/ApprovalsTab.test.tsx
git commit -m "feat: open BikeDetailModal from a pending request in Aprovações"
```

---

## Task 5: Contact info and full-registration detail on each occurrence

**Files:**
- Modify: `src/components/admin/OccurrencesTab.tsx`
- Test: `src/components/admin/OccurrencesTab.test.tsx`

**Interfaces:**
- Consumes: `BikeDetailModal` (unchanged props).

- [ ] **Step 1: Write the failing tests**

```tsx
it('shows the owner name and WhatsApp inline on an open incident', async () => {
  render(<OccurrencesTab />);
  await waitFor(() => {
    expect(screen.getByText('Mariana Costa')).toBeInTheDocument(); // from the widened join fixture
    expect(screen.getByText('21999990000')).toBeInTheDocument();
  });
});

it('opens BikeDetailModal with the full bike when "Ver cadastro completo" is clicked', async () => {
  render(<OccurrencesTab />);
  await waitFor(() => expect(screen.getByText('Mariana Costa')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /ver cadastro completo/i }));
  await waitFor(() => {
    expect(screen.getByText(/cadastrado em/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: FAIL — no owner name/WhatsApp shown yet, no "Ver cadastro completo" button.

- [ ] **Step 3: Implement in `OccurrencesTab.tsx`**

Widen the join to `bikes(tag_number, unit_block, owner_name, owner_whatsapp)` and the `IncidentWithBike` type accordingly. Show `incident.bikes?.owner_name` and `incident.bikes?.owner_whatsapp` inline on each open-incident card (both the resolved-list card too, for consistency — your call on exact placement, following this file's existing layout). Add a `viewingBikeId: string | null` or similar state plus a `viewingBike: Bike | null` state; a "Ver cadastro completo" button per open incident fetches the full row (`supabase.from('bikes').select('*').eq('id', incident.bike_id).single()`) and sets `viewingBike`; render `<BikeDetailModal bike={viewingBike} onClose={() => setViewingBike(null)} onSaved={() => setViewingBike(null)} />` when truthy (no need to reload incidents on save here, since editing a bike's registration doesn't change incident data).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/OccurrencesTab.tsx src/components/admin/OccurrencesTab.test.tsx
git commit -m "feat: show contact info and full registration detail on occurrences"
```

---

## Task 6: `incidents` schema — resolution columns and the resolution-reason catalog

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/migration_incident_resolution.sql`
- Modify: `src/lib/bikeOptions.ts`
- Modify: `src/types/database.ts` (the `Incident` interface)

**Interfaces:**
- Produces: `incidents` gains nullable `resolution text` and `resolution_notes text` columns. `src/lib/bikeOptions.ts` exports `INCIDENT_RESOLUTION_REASONS: string[] = ['Bike retirada do local', 'Morador contatado e resolveu', 'Reorganizada pela administração', 'Falso alarme / engano', 'Outro']`. `Incident` interface gains `resolution: string | null; resolution_notes: string | null`.

- [ ] **Step 1: Add the 2 columns to `supabase/schema.sql`'s `incidents` table**

```sql
alter table incidents add column resolution text;
alter table incidents add column resolution_notes text;
```

(No RPC and no grant/RLS change — `authenticated` already has direct `update` on `incidents` via the existing `grant select, insert, update, delete on incidents to authenticated` and the `incidents_all_authenticated` policy; see this plan's Global Constraints for why.)

- [ ] **Step 2: Create `supabase/migration_incident_resolution.sql`**

```sql
-- Migration: adds resolution/resolution_notes columns to incidents, so
-- resolving an occurrence can record why and with what notes. Run against
-- an existing Supabase project that already has schema.sql applied (SQL
-- editor). Idempotent: safe to re-run. No RPC/grant change — incidents
-- already grants authenticated a direct update.

alter table incidents add column if not exists resolution text;
alter table incidents add column if not exists resolution_notes text;
```

- [ ] **Step 3: Add `INCIDENT_RESOLUTION_REASONS` to `src/lib/bikeOptions.ts`**

```ts
export const INCIDENT_RESOLUTION_REASONS = [
  'Bike retirada do local',
  'Morador contatado e resolveu',
  'Reorganizada pela administração',
  'Falso alarme / engano',
  'Outro',
];
```

- [ ] **Step 4: Update the `Incident` interface in `src/types/database.ts`**

Add `resolution: string | null;` and `resolution_notes: string | null;` fields.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass (the widened `Incident` type must not break `OccurrencesTab.tsx`'s existing usage, since the new fields are additive and optional-shaped as `| null`).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql supabase/migration_incident_resolution.sql src/lib/bikeOptions.ts src/types/database.ts
git commit -m "feat: add incident resolution columns and reason catalog"
```

---

## Task 7: Apply the migration to the live Supabase project

**Files:** none (manual operation against the live project)

- [ ] **Step 1: Run `supabase/migration_incident_resolution.sql` in the live project's SQL editor**

Confirm it completes without error.

- [ ] **Step 2: Verify the columns exist**

Run: `select column_name from information_schema.columns where table_name = 'incidents' and column_name in ('resolution', 'resolution_notes');`
Expected: 2 rows.

- [ ] **Step 3: Record completion**

Note in the SDD ledger that the migration has been applied to the live project.

---

## Task 8: `ResolveIncidentModal` component

**Files:**
- Create: `src/components/admin/ResolveIncidentModal.tsx`
- Test: `src/components/admin/ResolveIncidentModal.test.tsx`

**Interfaces:**
- Consumes: `INCIDENT_RESOLUTION_REASONS` from `src/lib/bikeOptions.ts` (Task 6).
- Produces: `ResolveIncidentModal` component, default export, props `{ incident: { id: string }; onClose: () => void; onResolved: () => void }`.

- [ ] **Step 1: Write the failing tests**

Mirror `DeactivateBikeModal.test.tsx`'s structure (same mocking pattern) but asserting a direct `supabase.from('incidents').update(...)` call shape instead of an RPC call (per this plan's Global Constraints deviation — no RPC for this table):

```tsx
const updateMock = vi.fn();
vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ update: updateMock }) },
}));
// updateMock returns an object whose .eq(...).select() resolves to { data, error } —
// shape it so a successful update's data is a non-empty array (row(s) affected) and
// a stale/already-resolved update's data is an empty array (0 rows affected).

it('defaults to the first reason and updates the incident with the selected reason and notes', async () => {
  updateMock.mockReturnValue({ eq: () => ({ select: () => Promise.resolve({ data: [{ id: 'incident-1' }], error: null }) }) });
  const onResolved = vi.fn();
  render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={vi.fn()} onResolved={onResolved} />);
  fireEvent.change(screen.getByLabelText(/motivo da resolução/i), { target: { value: 'Morador contatado e resolveu' } });
  fireEvent.change(screen.getByLabelText(/observações/i), { target: { value: 'Falou com o morador' } });
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'resolved',
      resolution: 'Morador contatado e resolveu',
      resolution_notes: 'Falou com o morador',
    }));
    expect(onResolved).toHaveBeenCalled();
  });
});

it('shows an error and does not call onResolved when the update affects zero rows (already resolved elsewhere)', async () => {
  updateMock.mockReturnValue({ eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }) });
  const onResolved = vi.fn();
  render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={vi.fn()} onResolved={onResolved} />);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(screen.getByText(/não foi possível|já foi resolvida/i)).toBeInTheDocument();
  });
  expect(onResolved).not.toHaveBeenCalled();
});

it('shows the error and does not call onResolved when the update itself fails', async () => {
  updateMock.mockReturnValue({ eq: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'network error' } }) }) });
  const onResolved = vi.fn();
  render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={vi.fn()} onResolved={onResolved} />);
  fireEvent.click(screen.getByRole('button', { name: /confirmar/i }));
  await waitFor(() => {
    expect(screen.getByText('network error')).toBeInTheDocument();
  });
  expect(onResolved).not.toHaveBeenCalled();
});

it('calls onClose without updating anything on Cancelar', () => {
  const onClose = vi.fn();
  render(<ResolveIncidentModal incident={{ id: 'incident-1' }} onClose={onClose} onResolved={vi.fn()} />);
  fireEvent.click(screen.getByRole('button', { name: /cancelar/i }));
  expect(onClose).toHaveBeenCalled();
  expect(updateMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/ResolveIncidentModal.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `ResolveIncidentModal`**

Same visual family as `DeactivateBikeModal`: a "Motivo da Resolução" select defaulting to `INCIDENT_RESOLUTION_REASONS[0]`, an always-visible "Observações" textarea, "Confirmar" and "Cancelar". "Confirmar" calls `supabase.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolution: reason, resolution_notes: notes }).eq('id', incident.id)...` (with the zero-rows-affected check from Step 1), calling `onResolved()` on genuine success or showing an error and staying open otherwise. "Cancelar" calls `onClose()` without touching the database.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/ResolveIncidentModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/ResolveIncidentModal.tsx src/components/admin/ResolveIncidentModal.test.tsx
git commit -m "feat: add ResolveIncidentModal for capturing a resolution reason"
```

---

## Task 9: Wire `ResolveIncidentModal` into `OccurrencesTab`, replacing the native confirm

**Files:**
- Modify: `src/components/admin/OccurrencesTab.tsx`
- Test: `src/components/admin/OccurrencesTab.test.tsx`

**Interfaces:**
- Consumes: `ResolveIncidentModal` (Task 8), props `{ incident: { id: string }; onClose: () => void; onResolved: () => void }`.

- [ ] **Step 1: Write the failing test**

```tsx
it('opens ResolveIncidentModal instead of window.confirm when "Marcar Resolvida" is clicked, and refreshes on success', async () => {
  render(<OccurrencesTab onResolved={vi.fn()} />);
  await waitFor(() => expect(screen.getByText('Mariana Costa')).toBeInTheDocument());
  fireEvent.click(screen.getAllByRole('button', { name: /marcar resolvida/i })[0]);
  // mocked ResolveIncidentModal (same pattern as FleetTab's DeactivateBikeModal mock) renders a "Confirmar Mock" button calling onResolved
  fireEvent.click(screen.getByRole('button', { name: /confirmar mock/i }));
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /confirmar mock/i })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: FAIL — `window.confirm` still gates resolution.

- [ ] **Step 3: Implement in `OccurrencesTab.tsx`**

Replace `handleResolve`'s `window.confirm(...)` + direct `.update()` call with a `resolvingIncident: { id: string } | null` state set on "Marcar Resolvida" click; render `<ResolveIncidentModal incident={resolvingIncident} onClose={() => setResolvingIncident(null)} onResolved={async () => { setResolvingIncident(null); await loadIncidents(); onResolved(); }} />` when truthy. Remove the now-unused `resolvingId` state if nothing else needs it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/OccurrencesTab.tsx src/components/admin/OccurrencesTab.test.tsx
git commit -m "feat: capture a resolution reason when resolving an occurrence"
```
