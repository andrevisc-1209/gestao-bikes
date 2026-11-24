# Admin Usability Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix a real phone-mask bug, two "the data exists but you can't see it" gaps (Fleet's hidden actions on inactive bikes, Ocorrências' unsurfaced resolution/photo info), and add a manual refresh button to the admin panel.

**Architecture:** Each fix targets code already in `main` from the two most recent PRs. No new schema, no new dependency. A new `IncidentDetailModal` component (same modal-chrome family as `BikeDetailModal`/`ResolveIncidentModal`) surfaces the complaint + photo + resolution data that's already captured in the database but never displayed. The refresh button remounts the active tab via a key change, re-running each tab's own existing load effect — no prop drilling needed.

**Tech Stack:** React + TypeScript + Tailwind, Supabase, Vitest + React Testing Library.

**Spec:** none (direct fixes to already-shipped, already-understood code — confirmed with the user: item 4's "ver histórico" request is a card/modal opened by clicking an occurrence, same visual family as `BikeDetailModal`).

## Global Constraints

- The phone-mask bug (Task 1) was caused by a wrong test case written in an earlier plan (`formatBrazilPhone('21999990')` was specified to return `'(21) 99999'`, silently dropping the 6th+ digit instead of showing it after a dash) — fixing this means correcting both the implementation AND that specific test case; the other 4 existing test cases in `phone.test.ts` are correct and must still pass unchanged.
- `FleetTab.tsx`'s inactive-bike action-hiding (Task 2) exists in TWO render blocks (mobile card list and desktop table) — both need the same fix.
- `IncidentDetailModal` (Task 5) opens on a click anywhere on an incident's card EXCEPT the "Ver cadastro completo"/"Marcar Resolvida" buttons (which must keep their own independent click handlers, not also trigger the detail view) — same click-isolation pattern already used in `ApprovalsTab.tsx` (Task 4 of the prior plan).
- The refresh button (Task 4) must not break the existing `refreshKpiCounts` effect (`useEffect` keyed on `[activeTab, refreshKpiCounts]`) — it's an additional manual trigger, not a replacement.

## Review Focus

- A resident types a phone number and then keeps typing past 11 digits — the mask must still cap at 11 digits and not crash or show garbage (this was already correct before and must stay correct after Task 1's fix).
- An inactive bike has no matching `bikes_history` deactivation row (e.g. deactivated before the history feature shipped) — clicking "Ver cadastro completo" on it (now newly visible per Task 2) must still work gracefully, showing the registration date but no "Baixa em" section (already handled by `BikeDetailModal`, just needs to stay working once the button becomes reachable).
- An incident has no photo attached — the detail modal and the inline thumbnail must both handle this cleanly (no broken image icon, no crash).
- Clicking "Marcar Resolvida" must not also open `IncidentDetailModal` (click-isolation, see Global Constraints) — and vice versa, clicking the card while `ResolveIncidentModal` or `BikeDetailModal` is already open for that same incident shouldn't cause a conflicting double-open.
- The manual refresh button is clicked rapidly (double-click) — remounting the active tab twice in a row must not throw or leave the UI in a broken loading state indefinitely.

---

## Task 1: Fix the phone mask's progressive-reveal bug

**Files:**
- Modify: `src/lib/phone.ts`
- Modify: `src/lib/phone.test.ts`

**Interfaces:** `formatBrazilPhone(digits: string): string` — signature unchanged, only the internal algorithm and one test case's expected value change.

- [ ] **Step 1: Fix the wrong test case**

In `phone.test.ts`, the test `'formats partial input as the user types, digit by digit'` currently asserts `formatBrazilPhone('21999990')` equals `'(21) 99999'`. This is wrong — it was the original bug. Change the expected value to `'(21) 99999-9'` (DDD `21`, then the first 5 "rest" digits `99999`, then a dash, then the 6th rest digit `9` that was previously silently dropped). Add one more case to the same test: `expect(formatBrazilPhone('219999900')).toBe('(21) 99999-00')` (9 digits total, 7 rest digits — confirms the dash-group keeps growing one digit at a time, not just jumping straight to the full 4-digit group at 11 total digits).

- [ ] **Step 2: Run tests to verify the new case fails against the current (buggy) implementation**

Run: `npx vitest run src/lib/phone.test.ts`
Expected: FAIL on the corrected assertions (current code still returns the old, wrong values).

- [ ] **Step 3: Fix `formatBrazilPhone` in `phone.ts`**

The bug: once "rest" (digits after the 2-digit DDD) exceeds 5 characters, the old code capped the displayed rest at `rest.slice(0, 5)` with no dash and no further growth — so digits 6 through 10 never appeared on screen until the 11th digit arrived and the format jumped straight to the full dashed form. Fix: when `rest.length <= 5`, show `(${ddd}) ${rest}` (unchanged, already correct for short inputs). When `rest.length > 5`, show `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}` — the dash appears as soon as there's a 6th rest-digit, and everything after it keeps growing digit by digit up to the full `-XXXX` group at 11 total digits. This must still cap at 11 total digits (existing `.slice(0, 11)` truncation stays).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/phone.test.ts`
Expected: PASS (all cases, including the corrected one and the existing 4 that were already right: full 11-digit, 2/3-digit partial, punctuated-paste reformat, overflow truncation, empty string).

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/phone.ts src/lib/phone.test.ts
git commit -m "fix: show every typed phone digit instead of freezing the display between 6-10 digits"
```

---

## Task 2: Show "Ver cadastro completo"/"Ver QR" for inactive bikes in FleetTab

**Files:**
- Modify: `src/components/admin/FleetTab.tsx`
- Test: `src/components/admin/FleetTab.test.tsx`

**Interfaces:** none new — reuses `BikeDetailModal`/the existing QR-modal, unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows "Ver cadastro completo" and "Ver QR" for an inactive bike, but not "Dar Baixa"', async () => {
  render(<FleetTab />);
  await waitFor(() => expect(screen.getAllByText(/Inativa/).length).toBeGreaterThan(0));
  // bike #1 in this file's existing fixture is inactive (status: 'inactive')
  const inactiveRow = screen.getAllByText(/Inativa/)[0].closest('tr, div')!;
  expect(within(inactiveRow).queryByText('Ver cadastro completo')).toBeInTheDocument();
  expect(within(inactiveRow).queryByText('Ver QR')).toBeInTheDocument();
  expect(within(inactiveRow).queryByText('Dar Baixa')).not.toBeInTheDocument();
});
```

Adjust the exact selector/fixture reference to match this file's existing mock data and test conventions (check the existing tests in this file for how they locate a specific bike's row) — the assertions above are the requirement, the exact query mechanics are yours to fit to the existing fixture.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: FAIL — these buttons are currently hidden entirely for inactive bikes.

- [ ] **Step 3: Fix in `FleetTab.tsx`**

In BOTH render blocks (the mobile card list and the desktop table), the "Ver cadastro completo" and "Ver QR" buttons are currently wrapped inside `{!isInactive && (...)}` alongside "Dar Baixa", hiding all three for an inactive bike. Split this: "Ver cadastro completo" and "Ver QR" render unconditionally (regardless of `isInactive`); only "Dar Baixa" stays gated behind `{!isInactive && (...)}`. The layout/spacing around these buttons may need small adjustment so an inactive bike's row shows exactly 2 buttons instead of the dash placeholder it currently shows.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/FleetTab.tsx src/components/admin/FleetTab.test.tsx
git commit -m "fix: keep Ver cadastro completo and Ver QR reachable for inactive bikes"
```

---

## Task 3: Manual refresh button in AdminPage

**Files:**
- Modify: `src/pages/AdminPage.tsx`
- Test: `src/pages/AdminPage.test.tsx` (create if it doesn't already exist — check first)

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test**

```tsx
it('remounts the active tab and refreshes KPI counts when "Atualizar" is clicked', async () => {
  render(<AdminPage />);
  await screen.findByText(/Ocorrências Reportadas/i); // or whatever text confirms OccurrencesTab mounted
  const initialLoadCallCount = loadIncidentsSpy.mock.calls.length; // however this test file mocks Supabase, assert the load function ran once on mount

  fireEvent.click(screen.getByRole('button', { name: /atualizar/i }));

  await waitFor(() => {
    expect(loadIncidentsSpy.mock.calls.length).toBeGreaterThan(initialLoadCallCount);
  });
});
```

Adapt exact assertion mechanics to however `AdminPage.test.tsx` (or a new file, if none exists yet) mocks `supabase` and the child tab components — the requirement is: clicking "Atualizar" causes the currently-active tab's own data-loading effect to run again, proving a real remount, not just a visual spinner.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/AdminPage.test.tsx`
Expected: FAIL — no "Atualizar" button exists yet.

- [ ] **Step 3: Implement in `AdminPage.tsx`**

Add a `refreshKey` state (`useState(0)`). Add an "Atualizar" button in the header (near "Sair", following the same visual pattern — icon + label, hidden label on narrow screens if that's this header's existing convention) that, on click, calls `refreshKpiCounts()` AND increments `refreshKey`. Give the active tab's rendered element a `key` prop derived from both `activeTab` and `refreshKey` (e.g. `` key={`${activeTab}-${refreshKey}`} ``) so clicking "Atualizar" forces React to unmount and remount whichever tab is currently showing, which re-runs that tab's own `useEffect`-based initial load (e.g. `OccurrencesTab`'s `loadIncidents`, `ApprovalsTab`'s `loadPendingBikes`, `FleetTab`'s own load, `StickersTab`'s own load) without needing to thread a reload callback through every tab component.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/AdminPage.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/AdminPage.tsx src/pages/AdminPage.test.tsx
git commit -m "feat: add a manual refresh button to the admin panel"
```

---

## Task 4: Visible photo thumbnail on open incident cards

**Files:**
- Modify: `src/components/admin/OccurrencesTab.tsx`
- Test: `src/components/admin/OccurrencesTab.test.tsx`

**Interfaces:** none new.

- [ ] **Step 1: Write the failing test**

```tsx
it('shows a clickable photo thumbnail instead of just a "Foto anexada" badge when an incident has a photo', async () => {
  // extend this file's existing incident fixture with one row that has photo_url set
  render(<OccurrencesTab />);
  await waitFor(() => expect(screen.getByRole('img', { name: /foto da ocorrência/i })).toBeInTheDocument());
});

it('shows no photo element at all for an incident with no photo_url', async () => {
  render(<OccurrencesTab />);
  await waitFor(() => expect(screen.getByText(/Mariana Costa/i)).toBeInTheDocument()); // or whatever confirms load
  expect(screen.queryByRole('img', { name: /foto da ocorrência/i })).not.toBeInTheDocument();
});
```

Adapt to this file's existing fixture/mocking conventions — add a `photo_url` to (at least) one of the mocked incidents if none currently has one.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: FAIL — only a text badge exists today, no `<img>`.

- [ ] **Step 3: Implement in `OccurrencesTab.tsx`**

Replace the current `{incident.photo_url && (<span>...Foto anexada</span>)}` badge with a small clickable thumbnail: `<img src={incident.photo_url} alt="Foto da ocorrência" className="w-12 h-12 rounded-lg object-cover border border-slate-200 cursor-pointer" onClick={() => window.open(incident.photo_url!, '_blank')} />` (or equivalent — opening the full photo in a new tab is the simplest correct behavior; a lightbox/modal is not required for this task, Task 5's detail modal will also show the photo at a larger size). Keep this conditional on `incident.photo_url` being present, same as before.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/OccurrencesTab.tsx src/components/admin/OccurrencesTab.test.tsx
git commit -m "feat: show a visible photo thumbnail on incidents instead of just a badge"
```

---

## Task 5: `IncidentDetailModal` — a clickable card showing the full complaint and resolution history

**Files:**
- Create: `src/components/admin/IncidentDetailModal.tsx`
- Test: `src/components/admin/IncidentDetailModal.test.tsx`
- Modify: `src/components/admin/OccurrencesTab.tsx`
- Test: `src/components/admin/OccurrencesTab.test.tsx`

**Interfaces:**
- Consumes: the `IncidentWithBike` type, currently defined locally (not exported) in `OccurrencesTab.tsx` as `type IncidentWithBike = Incident & { bikes: { tag_number, unit_block, owner_name, owner_whatsapp } | null }`. Export it from `OccurrencesTab.tsx` (`export type IncidentWithBike = ...`) so `IncidentDetailModal.tsx` can import it — do not redefine an equivalent type in the new file, that would drift the same way the project has avoided before (e.g. the shared `bikeOptions.ts` catalogs).
- Produces: `IncidentDetailModal` component, default export, props `{ incident: IncidentWithBike; onClose: () => void }` (read-only, no edit/save — just a detail view, so no `onSaved`-style callback needed).

- [ ] **Step 1: Write the failing tests for `IncidentDetailModal`**

```tsx
const openIncident = {
  id: 'inc-1', bike_id: 'bike-1', reason: 'Pneu furado', notes: 'Perto da entrada',
  photo_url: 'https://example.com/photo.jpg', reporter_info: null,
  status: 'open' as const, created_at: '2026-01-10T12:00:00Z', resolved_at: null,
  resolution: null, resolution_notes: null,
  bikes: { tag_number: '005', unit_block: 'Bloco A • Apto 101', owner_name: 'Mariana Costa', owner_whatsapp: '21999990000' },
};

const resolvedIncident = {
  ...openIncident, id: 'inc-2', status: 'resolved' as const, resolved_at: '2026-01-11T09:00:00Z',
  resolution: 'Bike retirada do local', resolution_notes: 'Removida pela portaria',
};

it('shows the complaint reason, notes, timestamp, and photo for an open incident', () => {
  render(<IncidentDetailModal incident={openIncident} onClose={vi.fn()} />);
  expect(screen.getByText('Pneu furado')).toBeInTheDocument();
  expect(screen.getByText(/Perto da entrada/)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: /foto da ocorrência/i })).toBeInTheDocument();
});

it('does not show any resolution section for an open incident', () => {
  render(<IncidentDetailModal incident={openIncident} onClose={vi.fn()} />);
  expect(screen.queryByText(/resolvida em/i)).not.toBeInTheDocument();
});

it('shows the resolution reason, notes, and timestamp for a resolved incident', () => {
  render(<IncidentDetailModal incident={resolvedIncident} onClose={vi.fn()} />);
  expect(screen.getByText('Bike retirada do local')).toBeInTheDocument();
  expect(screen.getByText(/Removida pela portaria/)).toBeInTheDocument();
  expect(screen.getByText(/resolvida em/i)).toBeInTheDocument();
});

it('calls onClose when the close button is clicked', () => {
  const onClose = vi.fn();
  render(<IncidentDetailModal incident={openIncident} onClose={onClose} />);
  fireEvent.click(screen.getByLabelText('Fechar'));
  expect(onClose).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/admin/IncidentDetailModal.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 3: Implement `IncidentDetailModal`**

Same modal-chrome family as `BikeDetailModal`/`ResolveIncidentModal` (fixed overlay, centered white card, close button with `aria-label="Fechar"`). Content: a header showing `BIKE {incident.bikes?.tag_number ?? '—'}` and `incident.bikes?.unit_block`, the resident's `owner_name`/`owner_whatsapp` (reuse this file's existing inline-contact-info visual pattern), "Reportado em: {formatTimestamp(incident.created_at)}", the complaint `reason` and `notes` (if present), the photo at a reasonably large size if `photo_url` is present (same pattern Task 4 introduced, but bigger — this is the detail view). If `incident.status === 'resolved'`, additionally show "Resolvida em: {formatTimestamp(incident.resolved_at!)}", the `resolution` reason, and `resolution_notes` if present. Define your own local `formatTimestamp` (same ~6-line helper already duplicated in `BikeDetailModal`/`OccurrencesTab` — keep the established convention of a small local copy rather than a new shared import).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/IncidentDetailModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the failing test for wiring it into `OccurrencesTab`**

```tsx
it('opens IncidentDetailModal when an incident card is clicked, but not when the action buttons are clicked', async () => {
  render(<OccurrencesTab />);
  await waitFor(() => expect(screen.getByText('Pneu furado')).toBeInTheDocument()); // or whatever fixture reason text

  fireEvent.click(screen.getByRole('button', { name: /ver cadastro completo/i }));
  expect(screen.queryByText(/reportado em/i)).not.toBeInTheDocument(); // detail modal did not open from the button

  fireEvent.click(screen.getByText('Pneu furado').closest('div')!); // clicking the card body
  await waitFor(() => expect(screen.getByText(/reportado em/i)).toBeInTheDocument());
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: FAIL — no click-to-detail wiring yet.

- [ ] **Step 7: Wire `IncidentDetailModal` into `OccurrencesTab`**

Add `viewingIncident: IncidentWithBike | null` state. Make each incident card's main content area (both the open-incidents list and the resolved-incidents list) clickable to open the detail modal, while the "Ver cadastro completo"/"Marcar Resolvida" buttons keep their own independent `onClick` handlers (use `event.stopPropagation()` on those buttons' clicks, following the same click-isolation pattern `ApprovalsTab.tsx` already established for its own card-click-vs-button conflict). Render `<IncidentDetailModal incident={viewingIncident} onClose={() => setViewingIncident(null)} />` when truthy.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/components/admin/OccurrencesTab.test.tsx`
Expected: PASS.

- [ ] **Step 9: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/IncidentDetailModal.tsx src/components/admin/IncidentDetailModal.test.tsx src/components/admin/OccurrencesTab.tsx src/components/admin/OccurrencesTab.test.tsx
git commit -m "feat: add a clickable incident detail card showing the complaint and resolution history"
```
