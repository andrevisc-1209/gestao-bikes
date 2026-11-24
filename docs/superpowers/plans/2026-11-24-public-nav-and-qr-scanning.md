# Public Nav Tabs and QR Scanning Implementation Plan (PR B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote "report an issue" from a small secondary link on `/cadastro` to a first-class public page (`/ocorrencia`), switchable via a shared tab bar also shown on `/cadastro`, and let a visitor reach the right bike by scanning its QR sticker with the camera instead of only typing the number.

**Architecture:** A new `PublicNavTabs` component renders atop both `RegisterPage` and a new `OccurrenceEntryPage`, navigating between `/cadastro` and `/ocorrencia`. `OccurrenceEntryPage` absorbs the manual tag-entry logic `RegisterPage` currently has (removed from there) and adds a camera-based QR scanner via the `html5-qrcode` library, which decodes the sticker's full URL payload and extracts the `/b/:tag` path to navigate to.

**Tech Stack:** React + TypeScript + Tailwind, react-router-dom (`HashRouter`, `useNavigate`), `html5-qrcode` (new dependency), Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-24-branding-deactivation-public-nav-design.md`

**Depends on:** PR A (`docs/superpowers/plans/2026-11-24-rebrand-and-deactivation-reason.md`) is independent and can merge before or after this plan — no file overlap.

## Global Constraints

- `HashRouter` throughout: the QR sticker's payload is the full URL `${origin}${pathname}#/b/<tag>` (exactly what `FleetTab`'s and `StickersTab`'s printed QR codes already encode) — the scanner must extract the `/b/:tag`-shaped path after the `#`, not treat the whole decoded string as a bare tag number.
- `/cadastro` stays reachable at its own URL and keeps being the registration form — the new tab bar does not fold it into `/ocorrencia`; each route stays independently bookmarkable/shareable.
- Camera access requires the user's browser permission and must degrade gracefully: if denied, unavailable, or the scanned content doesn't match the expected `/b/:tag` shape, the manual tag-number input (zero-padded, trimmed, moved from `RegisterPage`) must still work — never block the user behind the camera.
- Non-goals (do not build): changing anything on `/b/:tagNumber` itself, a "default" tab concept (each route is reached on its own, same as today — the tab bar is only for switching once already on one of the two pages).

## Review Focus

- A visitor scans a QR code that isn't one of this app's own sticker QR codes (e.g. a random QR code, or an empty/garbled scan result) — must show a clear "QR Code não reconhecido" message and leave the manual input available, never crash or silently navigate somewhere wrong.
- A visitor denies camera permission (or the browser has no camera) — the manual tag-number input must still be fully usable, with no error blocking the rest of the page.
- A visitor types a tag number without leading zeros in the manual input on `/ocorrencia` (e.g. `7`) — must still resolve to `/b/007`, matching the zero-pad/trim behavior already shipped for `/cadastro`'s version of this input.
- Switching tabs via `PublicNavTabs` while mid-way through filling the registration form, or mid-scan on `/ocorrencia` — navigating away should not throw (the scanner must stop cleanly on unmount, not leave a dangling camera stream).
- `/cadastro`'s own URL must keep working exactly as before for residents who already have it bookmarked/shared — the removal of its secondary report-link block must not touch anything else in the registration flow (photo upload, brand/model catalog, submit).

---

## Task 1: `PublicNavTabs` component and the `html5-qrcode` dependency

**Files:**
- Create: `src/components/PublicNavTabs.tsx`
- Test: `src/components/PublicNavTabs.test.tsx`
- Modify: `package.json` (add `html5-qrcode`)

**Interfaces:**
- Produces: `PublicNavTabs` component, default export, props `{ active: 'cadastro' | 'ocorrencia' }`. Renders two buttons labeled "Cadastro" and "Ocorrência"; clicking the inactive one calls `useNavigate()` to `/cadastro` or `/ocorrencia` respectively; the `active` one is visually highlighted and not a no-op button click target (clicking it does nothing, it's already there).

- [ ] **Step 1: Add `html5-qrcode` to `package.json`**

Run: `npm install html5-qrcode@^2.3.8`

- [ ] **Step 2: Write the failing tests**

```tsx
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigateMock }));

it('highlights Cadastro and navigates to /ocorrencia when Ocorrência is clicked', () => {
  render(<PublicNavTabs active="cadastro" />);
  const cadastroTab = screen.getByRole('button', { name: 'Cadastro' });
  expect(cadastroTab).toHaveAttribute('aria-current', 'page');

  fireEvent.click(screen.getByRole('button', { name: 'Ocorrência' }));
  expect(navigateMock).toHaveBeenCalledWith('/ocorrencia');
});

it('highlights Ocorrência and navigates to /cadastro when Cadastro is clicked', () => {
  render(<PublicNavTabs active="ocorrencia" />);
  expect(screen.getByRole('button', { name: 'Ocorrência' })).toHaveAttribute('aria-current', 'page');

  fireEvent.click(screen.getByRole('button', { name: 'Cadastro' }));
  expect(navigateMock).toHaveBeenCalledWith('/cadastro');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/components/PublicNavTabs.test.tsx`
Expected: FAIL — component doesn't exist yet.

- [ ] **Step 4: Implement `PublicNavTabs`**

A segmented-control-style pair of buttons (visually similar to `AdminPage`'s internal tab bar, sized/colored for a public-facing page rather than the dark admin header). The `active` tab gets `aria-current="page"` and a highlighted style; clicking it is a no-op (don't call `navigate` for the already-active tab). Clicking the inactive tab calls `navigate('/cadastro')` or `navigate('/ocorrencia')`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/components/PublicNavTabs.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json src/components/PublicNavTabs.tsx src/components/PublicNavTabs.test.tsx
git commit -m "feat: add PublicNavTabs and the html5-qrcode dependency"
```

---

## Task 2: Mount `PublicNavTabs` on `/cadastro` and remove its old secondary report-link block

**Files:**
- Modify: `src/pages/RegisterPage.tsx`
- Modify: `src/pages/RegisterPage.test.tsx` (remove the now-obsolete report-link tests, which move to Task 3's `OccurrenceEntryPage`)

**Interfaces:**
- Consumes: `PublicNavTabs` (Task 1).

- [ ] **Step 1: Add `<PublicNavTabs active="cadastro" />` above the white card**

In both of `RegisterPage.tsx`'s return branches (the `submitted` thank-you screen and the main form), add `<PublicNavTabs active="cadastro" />` directly above the `bg-white rounded-2xl ...` card div, inside the `max-w-2xl mx-auto p-5` wrapper.

- [ ] **Step 2: Remove the old secondary report-link block and its state/handler**

Delete the `<div className="px-6 pb-6 pt-3 border-t ...">` block (the "Já tem uma bike cadastrada?" section, its label, input, and "Reportar um problema" button) from the end of the form. Remove the now-unused `reportTag` state and `handleReportSubmit` function, and the `useNavigate` import/call if nothing else in this file uses it.

- [ ] **Step 3: Remove the obsolete tests from `RegisterPage.test.tsx`**

Delete the two tests that exercised `handleReportSubmit` ("normalizes and navigates to /b/:tag...", "trims whitespace before navigating...") and the Enter-key regression test for that block — this behavior moves to `OccurrenceEntryPage` in Task 3, which gets its own equivalent tests there. Also remove the now-unused `navigateMock`/`react-router-dom` mock from this test file if nothing else in it needs `useNavigate`.

- [ ] **Step 4: Run tests to verify the remaining suite passes**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: PASS (only the original registration-flow tests remain).

- [ ] **Step 5: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/pages/RegisterPage.tsx src/pages/RegisterPage.test.tsx
git commit -m "feat: mount PublicNavTabs on /cadastro and retire its inline report link"
```

---

## Task 3: `OccurrenceEntryPage` with manual tag entry, mounted at `/ocorrencia`

**Files:**
- Create: `src/pages/OccurrenceEntryPage.tsx`
- Test: `src/pages/OccurrenceEntryPage.test.tsx`
- Modify: `src/App.tsx` (add the `/ocorrencia` route)

**Interfaces:**
- Consumes: `PublicNavTabs` (Task 1).
- Produces: `OccurrenceEntryPage` component, default export. No props.

- [ ] **Step 1: Write the failing tests**

```tsx
const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal()), useNavigate: () => navigateMock }));

it('normalizes and navigates to /b/:tag when a tag number is entered manually', () => {
  render(<OccurrenceEntryPage />);
  fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
  expect(navigateMock).toHaveBeenCalledWith('/b/007');
});

it('trims whitespace before navigating', () => {
  render(<OccurrenceEntryPage />);
  fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '  12  ' } });
  fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
  expect(navigateMock).toHaveBeenCalledWith('/b/012');
});

it('renders PublicNavTabs with Ocorrência active', () => {
  render(<OccurrenceEntryPage />);
  expect(screen.getByRole('button', { name: 'Ocorrência' })).toHaveAttribute('aria-current', 'page');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/pages/OccurrenceEntryPage.test.tsx`
Expected: FAIL — page doesn't exist yet.

- [ ] **Step 3: Implement `OccurrenceEntryPage`** (manual-entry path only — the camera scanner is Task 4)

`<PublicNavTabs active="ocorrencia" />` at the top, then a page body (reuse `RegisterPage`'s outer `max-w-2xl mx-auto p-5` + white card visual pattern for consistency) containing: an input labeled "Número do adesivo", and a "Ver Ocorrência" button. On click, `navigate(\`/b/${tagInput.trim().padStart(3, '0')}\`)` — same zero-pad/trim logic the removed `RegisterPage` block used. Leave a placeholder spot above this manual-entry section for the camera scanner (Task 4 fills it in).

- [ ] **Step 4: Add the `/ocorrencia` route in `src/App.tsx`**

```tsx
<Route path="/ocorrencia" element={<OccurrenceEntryPage />} />
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/pages/OccurrenceEntryPage.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 6: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/pages/OccurrenceEntryPage.tsx src/pages/OccurrenceEntryPage.test.tsx src/App.tsx
git commit -m "feat: add /ocorrencia entry page with manual tag lookup"
```

---

## Task 4: Camera QR scanning on `OccurrenceEntryPage`

**Files:**
- Modify: `src/pages/OccurrenceEntryPage.tsx`
- Create: `src/lib/qrScan.ts` (pure parsing helper, unit-testable without a real camera)
- Test: `src/lib/qrScan.test.ts`
- Test: `src/pages/OccurrenceEntryPage.test.tsx` (add scanner-integration tests with `html5-qrcode` mocked)

**Interfaces:**
- Produces: `src/lib/qrScan.ts` exports `extractBikeTagPath(decodedText: string): string | null` — returns a path like `/b/007` when `decodedText`'s hash fragment matches `^/b/\d+$`, otherwise `null`.

- [ ] **Step 1: Write the failing tests for `extractBikeTagPath`**

```ts
import { extractBikeTagPath } from './qrScan';

it('extracts the /b/:tag path from a full sticker URL', () => {
  expect(extractBikeTagPath('https://andrevisc-1209.github.io/gestao-bikes/#/b/007')).toBe('/b/007');
});

it('returns null for a URL with no matching hash path', () => {
  expect(extractBikeTagPath('https://example.com/#/admin')).toBeNull();
});

it('returns null for an unrelated or garbled scan result', () => {
  expect(extractBikeTagPath('not a url at all')).toBeNull();
  expect(extractBikeTagPath('')).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/qrScan.test.ts`
Expected: FAIL — module doesn't exist yet.

- [ ] **Step 3: Implement `extractBikeTagPath` in `src/lib/qrScan.ts`**

Split `decodedText` on `#`, take everything after the first `#` (or treat the whole string as having no hash if there isn't one), and return it only if it matches `^/b/\d+$`; otherwise return `null`. Handle `decodedText` having no `#` at all (return `null`), and malformed input defensively (never throw).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/qrScan.test.ts`
Expected: PASS (3+ tests).

- [ ] **Step 5: Write the failing scanner-integration tests in `OccurrenceEntryPage.test.tsx`**

Mock the `html5-qrcode` module so these tests drive the surrounding logic without a real camera:

```tsx
const startMock = vi.fn();
const stopMock = vi.fn().mockResolvedValue(undefined);
let capturedOnSuccess: ((decodedText: string) => void) | undefined;

vi.mock('html5-qrcode', () => ({
  Html5Qrcode: vi.fn().mockImplementation(() => ({
    start: (...args: unknown[]) => {
      capturedOnSuccess = args[2] as (decodedText: string) => void;
      startMock(...args);
      return Promise.resolve();
    },
    stop: stopMock,
  })),
}));

it('navigates to the scanned bike when the QR payload matches the expected shape', async () => {
  render(<OccurrenceEntryPage />);
  fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
  await waitFor(() => expect(startMock).toHaveBeenCalled());

  capturedOnSuccess?.('https://andrevisc-1209.github.io/gestao-bikes/#/b/014');

  await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/b/014'));
});

it('shows "QR Code não reconhecido" and keeps the manual input usable for an unrecognized scan', async () => {
  render(<OccurrenceEntryPage />);
  fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
  await waitFor(() => expect(startMock).toHaveBeenCalled());

  capturedOnSuccess?.('garbled nonsense');

  await waitFor(() => {
    expect(screen.getByText(/qr code não reconhecido/i)).toBeInTheDocument();
  });
  expect(screen.getByLabelText(/número do adesivo/i)).toBeEnabled();
});

it('keeps the manual input usable and shows an error when the camera fails to start (e.g. permission denied)', async () => {
  startMock.mockImplementationOnce(() => { throw new Error('Permission denied'); });
  render(<OccurrenceEntryPage />);

  fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));

  await waitFor(() => {
    expect(screen.getByText(/não foi possível acessar a câmera/i)).toBeInTheDocument();
  });
  expect(screen.getByLabelText(/número do adesivo/i)).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/número do adesivo/i), { target: { value: '9' } });
  fireEvent.click(screen.getByRole('button', { name: /ver ocorrência/i }));
  expect(navigateMock).toHaveBeenCalledWith('/b/009');
});

it('stops the scanner on unmount', async () => {
  const { unmount } = render(<OccurrenceEntryPage />);
  fireEvent.click(screen.getByRole('button', { name: /ativar câmera/i }));
  await waitFor(() => expect(startMock).toHaveBeenCalled());

  unmount();

  await waitFor(() => expect(stopMock).toHaveBeenCalled());
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `npx vitest run src/pages/OccurrenceEntryPage.test.tsx`
Expected: FAIL — no "ativar câmera" button or scanner wiring yet.

- [ ] **Step 7: Implement the camera panel in `OccurrenceEntryPage`**

Above the manual-entry section, an "Ativar Câmera" button (camera does not auto-start on mount — requires this explicit user gesture, both to avoid surprising the visitor and because some browsers block unprompted camera access anyway). On click, instantiate `new Html5Qrcode(<elementId>)` and call `.start({ facingMode: 'environment' }, <scanConfig>, onScanSuccess, onScanFailure)`, where `onScanSuccess` calls `extractBikeTagPath(decodedText)` — if it returns a path, `navigate(path)`; if `null`, set an inline error state showing "QR Code não reconhecido. Tente novamente ou digite o número." (the manual input stays rendered and usable throughout — never conditionally hidden while the camera is active). Stop the scanner (`.stop()`) in a `useEffect` cleanup so navigating away via `PublicNavTabs` (or anywhere else) doesn't leave a dangling camera stream.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npx vitest run src/pages/OccurrenceEntryPage.test.tsx`
Expected: PASS (all tests in the file, including Task 3's — 6 total: 3 from Task 3, 4 new from this task).

- [ ] **Step 9: Run full suite, `tsc --noEmit`, build**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add src/pages/OccurrenceEntryPage.tsx src/pages/OccurrenceEntryPage.test.tsx src/lib/qrScan.ts src/lib/qrScan.test.ts
git commit -m "feat: add camera QR-code scanning to the occurrence entry page"
```
