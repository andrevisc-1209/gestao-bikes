# BikeCondo Web App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the static `mockup_interativo_bikecondo.html` prototype into a functional, responsive, PWA-ready React + Supabase web app for managing electric bikes in condominiums: public QR-code incident reporting, public resident self-registration, and an authenticated syndic admin panel.

**Architecture:** Single-page app (Vite + React + TypeScript + React Router) talking directly to Supabase (Postgres + Storage + Auth) from the client, using the public anon key everywhere; the only privileged path is a `SECURITY DEFINER` RPC that returns a redacted bike projection for the public QR page. All writes besides that RPC path rely on Postgres RLS to separate "anyone can create a pending record" from "only an authenticated admin can read/update/delete." Deployed for testing as a static site on GitHub Pages (project page, served under `/<repo>/`), built and published by a GitHub Actions workflow on every push to `main`.

**Tech Stack:** React 18, Vite, TypeScript, Tailwind CSS, lucide-react, react-router-dom, @supabase/supabase-js, qrcode.react, browser-image-compression, Vitest + @testing-library/react for unit/component tests.

**Spec:** user-supplied spec pasted in conversation on 2026-11-23 (reproduced in full in `docs/superpowers/plans/2026-11-23-bikecondo-webapp-spec.md`), reusing text/flows/colors from `mockup_interativo_bikecondo.html` (kept at repo root for reference).

## Global Constraints

- Stack: React + Vite + TypeScript + Tailwind CSS + lucide-react icons.
- Backend: Supabase (Postgres + Storage for bike/incident photos + Auth for the admin panel).
- Routing: React Router DOM; public QR route is the short path `/b/:tagNumber`. Deployment target is GitHub Pages, which does not support server-side rewrites for deep links, so the router is `HashRouter` (URLs like `https://<user>.github.io/<repo>/#/b/014`) rather than `BrowserRouter` — every `to=`/`navigate()`/printed QR URL in the app must account for the `#/` segment.
- Palette: emerald (`#059669`/`emerald-600`) primary, `slate-900`/`slate-50` neutrals — exactly the mockup's palette.
- `condo_settings`: singleton row, `total_capacity` default `50`, `next_tag_number` default `1`.
- `bikes.tag_number`: nullable text, unique, zero-padded 3-digit display (e.g. `"014"`); null while `status = 'pending'`.
- `bikes.status` ∈ `{'pending','active','inactive'}`; `incidents.status` ∈ `{'open','resolved'}`.
- Storage bucket name: `bike-photos`.
- Public `INSERT` allowed on `bikes` only when `status = 'pending'`; public `INSERT` allowed on `incidents`.
- Public `SELECT` on `bikes` is blocked entirely; public reads go only through `get_public_bike_by_tag(p_tag text)`, `SECURITY DEFINER`, returning only `id, tag_number, brand_model, color, photo_url` — never `owner_name`, `unit_block`, `owner_whatsapp`.
- All other access (`SELECT/UPDATE/DELETE` on `bikes`/`incidents`, all of `condo_settings`) requires an authenticated session.
- Deliverables: working Vite project, `supabase/schema.sql` (tables + triggers + storage bucket + RLS/RPC), `.env.example`, short `README.md`.

## Review Focus

- **LGPD leak on the public QR page:** any response reaching `/b/:tagNumber` (RPC result or page props) must never contain `owner_name`, `unit_block`, or `owner_whatsapp` — assert on the RPC's returned column set and on the rendered page's text content, not just on what the component intentionally renders.
- **Tag-number race on approval:** two admins approving two different pending bikes at nearly the same time must not receive the same `tag_number` — the increment of `next_tag_number` and the tag assignment must happen atomically in one DB round trip (a single RPC/function call), not as separate read-then-write client calls.
- **Occupancy over capacity:** when active bikes exceed `total_capacity` (e.g. capacity lowered after bikes were already active), the occupancy bar/percentage must clamp visually (cap at 100%) instead of overflowing or showing `>100%`, matching the mockup's `Math.min(100, ...)` behavior.
- **Unknown/inactive tag lookup:** `/b/:tagNumber` for a tag that doesn't exist, or belongs to a `pending`/`inactive` bike, must render a friendly "not found" state — never a crash, a raw Supabase error, or a leak of why it isn't shown.
- **Upload failure mid-flow:** a failed photo compression/upload (bad file, network error, Supabase Storage error) on `/cadastro` or on the QR incident form must surface an inline error and preserve the user's already-typed fields — never silently submit a record with a missing/broken `photo_url`, and never wipe the form.

---

## File Structure

```
gestao-bikes/
├── mockup_interativo_bikecondo.html        # kept as reference, untouched
├── .github/
│   └── workflows/
│       └── deploy.yml                      # build + deploy to GitHub Pages on push to main
├── supabase/
│   └── schema.sql                          # tables, triggers, storage bucket, RLS, RPCs
├── .env.example
├── README.md
├── index.html
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.js
├── postcss.config.js
├── package.json
└── src/
    ├── main.tsx
    ├── App.tsx                             # router + layout shell
    ├── index.css                           # Tailwind directives
    ├── lib/
    │   ├── supabase.ts                     # supabase client singleton
    │   ├── reasons.ts                      # incident reason list (from mockup)
    │   ├── tag.ts                          # formatTagNumber(), parse helpers
    │   ├── whatsapp.ts                     # buildWhatsappPreview() template
    │   └── imageCompression.ts             # compressImage() wrapper
    ├── types/
    │   └── database.ts                     # Bike, Incident, CondoSettings, PublicBike types
    ├── context/
    │   └── AuthContext.tsx                 # session state + useAuth()
    ├── components/
    │   ├── ProtectedRoute.tsx
    │   ├── ToastProvider.tsx               # toast context + <Toast/>
    │   └── admin/
    │       ├── KpiCards.tsx
    │       ├── OccurrencesTab.tsx
    │       ├── ApprovalsTab.tsx
    │       ├── FleetTab.tsx
    │       └── CapacityModal.tsx
    └── pages/
        ├── PublicBikePage.tsx              # /b/:tagNumber
        ├── RegisterPage.tsx                 # /cadastro
        ├── LoginPage.tsx                    # /login
        └── AdminPage.tsx                    # /admin (tabs host)

tests/ (colocated as *.test.ts(x) next to source, per Vitest convention)
```

---

### Task 1: Project scaffold, Tailwind, routing shell

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `tailwind.config.js`, `postcss.config.js`, `index.html`, `.gitignore`
- Create: `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `src/lib/tag.ts`
- Test: `src/lib/tag.test.ts`

**Interfaces:**
- Produces: `formatTagNumber(n: number): string` → zero-padded 3-digit string (e.g. `formatTagNumber(14) === "014"`), used by Task 8 (approvals) and Task 9 (fleet table).
- Produces: `App` component mounted at `#root`, wrapped in `<HashRouter>` (not `BrowserRouter` — see Global Constraints), with `<Routes>` for `/b/:tagNumber`, `/cadastro`, `/login`, `/admin`, and a catch-all redirect to `/cadastro`.

- [ ] **Step 1: Scaffold the Vite project**

Run: `npm create vite@latest . -- --template react-ts` (into the current repo root; keep `mockup_interativo_bikecondo.html` and `.git`), then `npm install`.

- [ ] **Step 2: Install dependencies**

Run: `npm install react-router-dom @supabase/supabase-js qrcode.react browser-image-compression lucide-react` and `npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom`

- [ ] **Step 3: Configure Tailwind**

Run: `npx tailwindcss init -p`. Set `content: ["./index.html", "./src/**/*.{ts,tsx}"]` in `tailwind.config.js`, extend nothing custom (use stock `emerald`/`slate` palette to match the mockup exactly). Add `@tailwind base; @tailwind components; @tailwind utilities;` to `src/index.css`. Use the `Inter` Google Font link in `index.html` exactly as in the mockup's `<head>`.

- [ ] **Step 4: Write the failing test for `formatTagNumber`**

```ts
import { describe, it, expect } from 'vitest';
import { formatTagNumber } from './tag';

describe('formatTagNumber', () => {
  it('pads single digits to 3 characters', () => {
    expect(formatTagNumber(1)).toBe('001');
  });
  it('pads double digits to 3 characters', () => {
    expect(formatTagNumber(14)).toBe('014');
  });
  it('keeps triple digits as-is', () => {
    expect(formatTagNumber(123)).toBe('123');
  });
});
```

- [ ] **Step 5: Run test to verify it fails**

Run: `npx vitest run src/lib/tag.test.ts`
Expected: FAIL (`formatTagNumber` not defined / module not found)

- [ ] **Step 6: Implement `formatTagNumber` in `src/lib/tag.ts`**

`export function formatTagNumber(n: number): string` — `String(n).padStart(3, '0')`.

- [ ] **Step 7: Run test to verify it passes**

Run: `npx vitest run src/lib/tag.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 8: Build the router shell**

`src/App.tsx` renders `<HashRouter>` with the four routes listed in Interfaces, each pointing at a placeholder `<div>` for now (pages land in later tasks). `src/main.tsx` mounts `<App />` with `ToastProvider`/`AuthContext` left as TODO comments only if a later task needs to wrap them here (prefer wiring providers in the tasks that create them, Task 5 and Task 6).

- [ ] **Step 9: Verify the app boots**

Run: `npm run build`
Expected: build succeeds with no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite+React+TS+Tailwind project with routing shell"
```

---

### Task 2: Supabase schema, client, and shared types

**Files:**
- Create: `supabase/schema.sql`
- Create: `src/lib/supabase.ts`
- Create: `src/types/database.ts`
- Create: `.env.example`

**Interfaces:**
- Produces: `supabase` client export (`import { supabase } from '../lib/supabase'`) used by every page/component in later tasks.
- Produces: TypeScript types `CondoSettings`, `Bike`, `PublicBike`, `Incident`, `BikeStatus`, `IncidentStatus` in `src/types/database.ts`, used by every data-fetching component.
- Produces: SQL RPC `get_public_bike_by_tag(p_tag text) returns table(id uuid, tag_number text, brand_model text, color text, photo_url text)`.
- Produces: SQL RPC `approve_bike(p_bike_id uuid) returns text` — atomically increments `condo_settings.next_tag_number`, assigns the old value (formatted) as `bikes.tag_number`, sets `status = 'active'`, returns the assigned tag string. (This closes the Review Focus item on tag-assignment races.)

- [ ] **Step 1: Write `supabase/schema.sql`**

Include, in order:
1. `create extension if not exists "pgcrypto";` (for `gen_random_uuid()`).
2. `create type bike_status as enum ('pending','active','inactive');` and `create type incident_status as enum ('open','resolved');`.
3. `create table condo_settings (id uuid primary key default gen_random_uuid(), condo_name text not null default 'Condomínio', total_capacity int not null default 50, next_tag_number int not null default 1);` plus a seed `insert into condo_settings (condo_name) values ('Residencial') on conflict do nothing;` guarded by a check that only inserts if the table is empty (use `insert ... select ... where not exists (select 1 from condo_settings)`).
4. `create table bikes (id uuid primary key default gen_random_uuid(), tag_number text unique, unit_block text not null, owner_name text not null, owner_whatsapp text not null, brand_model text not null, color text not null, photo_url text, status bike_status not null default 'pending', created_at timestamptz not null default now());`
5. `create table incidents (id uuid primary key default gen_random_uuid(), bike_id uuid not null references bikes(id) on delete cascade, reason text not null, notes text, photo_url text, reporter_info text, status incident_status not null default 'open', created_at timestamptz not null default now(), resolved_at timestamptz);`
6. Storage: `insert into storage.buckets (id, name, public) values ('bike-photos', 'bike-photos', true) on conflict (id) do nothing;` (public read so `photo_url` can be a plain public URL; writes still gated by storage RLS policies below).
7. `enable row level security` on `condo_settings`, `bikes`, `incidents`.
8. RLS policies:
   - `condo_settings`: `select/update` only for `authenticated` role; no public policy at all (default deny).
   - `bikes`: `insert` policy `for insert to anon, authenticated with check (status = 'pending')`; `select/update/delete` policy `for all to authenticated using (true)`.
   - `incidents`: `insert` policy `for insert to anon, authenticated with check (true)`; `select/update/delete` policy `for all to authenticated using (true)`.
   - `storage.objects` for bucket `bike-photos`: `insert` allowed to `anon, authenticated` (resident/reporter uploads), `select` allowed to everyone (bucket is public), `update/delete` only to `authenticated`.
9. `create function get_public_bike_by_tag(p_tag text) returns table(id uuid, tag_number text, brand_model text, color text, photo_url text) language sql security definer set search_path = public as $$ select id, tag_number, brand_model, color, photo_url from bikes where tag_number = p_tag and status = 'active'; $$;` then `grant execute on function get_public_bike_by_tag(text) to anon, authenticated;`
10. `create function approve_bike(p_bike_id uuid) returns text language plpgsql security definer set search_path = public as $$ declare v_next int; v_tag text; begin update condo_settings set next_tag_number = next_tag_number + 1 where id = (select id from condo_settings limit 1) returning next_tag_number - 1 into v_next; v_tag := lpad(v_next::text, 3, '0'); update bikes set tag_number = v_tag, status = 'active' where id = p_bike_id; return v_tag; end; $$;` then `grant execute on function approve_bike(uuid) to authenticated;` (not granted to `anon` — only admins approve).
11. A trigger or default is not needed for `resolved_at`; set it from the client when resolving (Task 7).

- [ ] **Step 2: Sanity-check the SQL**

Run: `grep -c "create table\|create function\|create policy" supabase/schema.sql`
Expected: non-zero count matching 2 tables + 1 settings table + 2 functions + the policies listed above (manual read-through, since there's no local Postgres in this environment — flag any syntax mistake found on inspection and fix it before moving on).

- [ ] **Step 3: Write `.env.example`**

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

- [ ] **Step 4: Implement `src/lib/supabase.ts`**

`export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY)` using `@supabase/supabase-js`'s `createClient`. Throw a clear error at module load if either env var is missing/undefined.

- [ ] **Step 5: Implement `src/types/database.ts`**

```ts
export type BikeStatus = 'pending' | 'active' | 'inactive';
export type IncidentStatus = 'open' | 'resolved';

export interface CondoSettings {
  id: string;
  condo_name: string;
  total_capacity: number;
  next_tag_number: number;
}

export interface Bike {
  id: string;
  tag_number: string | null;
  unit_block: string;
  owner_name: string;
  owner_whatsapp: string;
  brand_model: string;
  color: string;
  photo_url: string | null;
  status: BikeStatus;
  created_at: string;
}

// Exactly the columns get_public_bike_by_tag returns — never widen this type.
export interface PublicBike {
  id: string;
  tag_number: string;
  brand_model: string;
  color: string;
  photo_url: string | null;
}

export interface Incident {
  id: string;
  bike_id: string;
  reason: string;
  notes: string | null;
  photo_url: string | null;
  reporter_info: string | null;
  status: IncidentStatus;
  created_at: string;
  resolved_at: string | null;
}
```

- [ ] **Step 6: Write the failing test asserting `PublicBike` never grows sensitive fields**

```ts
import { describe, it, expect } from 'vitest';
import type { PublicBike } from './database';

describe('PublicBike', () => {
  it('only exposes the non-sensitive projection', () => {
    const keys: (keyof PublicBike)[] = ['id', 'tag_number', 'brand_model', 'color', 'photo_url'];
    const sample: PublicBike = { id: '1', tag_number: '014', brand_model: 'x', color: 'y', photo_url: null };
    expect(Object.keys(sample).sort()).toEqual(keys.sort());
  });
});
```

- [ ] **Step 7: Run test to verify it fails, then passes**

Run: `npx vitest run src/types/database.test.ts`
Expected: FAIL first (file/type not found) before Step 5, PASS after Step 5 is in place — reorder if needed so the test genuinely fails before the type exists, then passes after.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds with no type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Supabase schema, client, and shared data types"
```

---

### Task 3: Public QR incident page (`/b/:tagNumber`)

**Files:**
- Create: `src/lib/reasons.ts`
- Create: `src/lib/whatsapp.ts`
- Create: `src/pages/PublicBikePage.tsx`
- Test: `src/lib/whatsapp.test.ts`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase` (Task 2), `PublicBike`/`Incident` types (Task 2), `compressImage` from `../lib/imageCompression` (Task 4 — if Task 4 isn't done yet, inline a stub upload using `supabase.storage` directly and let Task 4 replace it; prefer sequencing Task 4 before this task if the executor has flexibility).
- Produces: `INCIDENT_REASONS: { id: string; label: string; icon: string }[]` exported from `reasons.ts`, used only here (admin tabs show free-text `reason`, not the picker).
- Produces: `buildWhatsappPreview(ownerFirstName: string, tag: string, model: string, reason: string, note?: string): string` — HTML string matching the mockup's template, used by this page's confirmation UI.

- [ ] **Step 1: Write the failing test for `buildWhatsappPreview`**

```ts
import { describe, it, expect } from 'vitest';
import { buildWhatsappPreview } from './whatsapp';

describe('buildWhatsappPreview', () => {
  it('includes tag, model and reason without the note block when note is omitted', () => {
    const msg = buildWhatsappPreview('Carlos', '014', 'Caloi E-Vibe Urbis', 'Pneu murcho');
    expect(msg).toContain('Carlos');
    expect(msg).toContain('014');
    expect(msg).toContain('Pneu murcho');
    expect(msg).not.toContain('Obs.:');
  });
  it('includes the note block when a note is given', () => {
    const msg = buildWhatsappPreview('Carlos', '014', 'Caloi E-Vibe Urbis', 'Pneu murcho', 'Perto da saída');
    expect(msg).toContain('Obs.:');
    expect(msg).toContain('Perto da saída');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/whatsapp.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `buildWhatsappPreview` in `src/lib/whatsapp.ts`**

Port the template literal from the mockup's `submitOccurrence()` (lines ~692–696): bold owner first name and tag/model, a `📌 Motivo:` line, an optional `💬 Obs.:` line only when `note` is truthy, closing thank-you line.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/whatsapp.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Implement `src/lib/reasons.ts`**

Port the five reasons from the mockup's `reason-btn` buttons (lines 139–172) as data: irregular parking, flat tire/abandonment, cable/outlet misuse, fallen/damage risk, other — each with id, label, and a lucide icon name.

- [ ] **Step 6: Implement `PublicBikePage`**

On mount, read `tagNumber` from `useParams()`, call `supabase.rpc('get_public_bike_by_tag', { p_tag: tagNumber })`. Three states:
- Loading: skeleton card.
- Not found (empty RPC result or error): a friendly "Bike não encontrada ou cadastro não regularizado" message — no stack trace, no mention of RLS/DB. (Review Focus: unknown/inactive tag.)
- Found: render the mockup's dark header card (tag badge, model, color, "Privacidade protegida" notice — **only** fields from `PublicBike`, never fetch or render `owner_name`/`unit_block`/`owner_whatsapp` anywhere in this file), the reason picker from `reasons.ts`, optional note input, optional photo attach, and a submit button that inserts into `incidents` (`bike_id`, `reason`, `notes`, `photo_url`, `status: 'open'`) and then shows a WhatsApp-preview confirmation panel built with `buildWhatsappPreview` (the real WhatsApp send is out of scope here — Task 2's schema and this insert are the integration point for a future Edge Function/webhook; leave a one-line comment saying so, no mock network call).

- [ ] **Step 7: Verify the build and manually smoke-test the "not found" path**

Run: `npm run dev`, navigate to `/b/doesnotexist`.
Expected: friendly not-found message renders, no console error about missing columns/owner data.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: public QR incident reporting page at /b/:tagNumber"
```

---

### Task 4: Image compression helper + photo upload

**Files:**
- Create: `src/lib/imageCompression.ts`
- Test: `src/lib/imageCompression.test.ts`
- Modify: `src/pages/PublicBikePage.tsx` (swap any stub upload for the real helper, if Task 3 landed first)

**Interfaces:**
- Produces: `async function compressAndUpload(file: File, pathPrefix: string): Promise<{ url: string } | { error: string }>` — compresses client-side via `browser-image-compression`, uploads to the `bike-photos` bucket at `${pathPrefix}/${crypto.randomUUID()}.jpg`, returns the public URL or a user-safe error string. Used by Task 3 (incident photo) and Task 5 (registration photo).

- [ ] **Step 1: Write the failing test for the error path**

```ts
import { describe, it, expect, vi } from 'vitest';
import { compressAndUpload } from './imageCompression';

vi.mock('../lib/supabase', () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn().mockRejectedValue(new Error('network')) }) } },
}));

describe('compressAndUpload', () => {
  it('returns a user-safe error instead of throwing when upload fails', async () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bike.jpg', { type: 'image/jpeg' });
    const result = await compressAndUpload(file, 'incidents');
    expect('error' in result).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/imageCompression.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `compressAndUpload` in `src/lib/imageCompression.ts`**

Use `imageCompression(file, { maxSizeMB: 1, maxWidthOrHeight: 1600 })` from `browser-image-compression`, then `supabase.storage.from('bike-photos').upload(path, compressed)`; wrap both calls in try/catch, return `{ error: 'Não foi possível enviar a foto. Tente novamente.' }` on any failure (never throw — callers must be able to keep the form filled in, per Review Focus), and `{ url: supabase.storage.from('bike-photos').getPublicUrl(path).data.publicUrl }` on success.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/imageCompression.test.ts`
Expected: PASS

- [ ] **Step 5: Wire it into `PublicBikePage`'s optional incident photo**

Replace any placeholder upload call from Task 3 with `compressAndUpload(file, 'incidents')`; on `{ error }`, show the error inline and keep `selectedReason`/`note` state intact.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: client-side image compression and Storage upload helper"
```

---

### Task 5: Resident self-registration page (`/cadastro`)

**Files:**
- Create: `src/pages/RegisterPage.tsx`
- Test: `src/pages/RegisterPage.test.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 2), `compressAndUpload` (Task 4).
- Produces: a mounted `/cadastro` route (wired into `App.tsx` from Task 1, replacing its placeholder).

- [ ] **Step 1: Write the failing test for required-photo validation**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RegisterPage from './RegisterPage';

vi.mock('../lib/supabase', () => ({ supabase: { from: () => ({ insert: vi.fn() }) } }));

describe('RegisterPage', () => {
  it('blocks submit with a message when no photo was attached', () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByLabelText(/bloco/i), { target: { value: 'Bloco A' } });
    fireEvent.click(screen.getByRole('button', { name: /enviar cadastro/i }));
    expect(screen.getByText(/anexar/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `RegisterPage`**

Port the mockup's form fields verbatim (bloco/torre select, apartamento, WhatsApp, nome completo, marca/modelo, cor, photo upload box) with labels wired via `htmlFor`/`id` for accessibility and the test above. On submit: require a photo (mirrors mockup's `registerPhotoUploaded` guard), call `compressAndUpload(file, 'bikes')`, then `supabase.from('bikes').insert({ ...fields, photo_url: url, status: 'pending' })`, then show a success toast and redirect to `/` or a thank-you state (not `/admin` — that's an internal mockup shortcut, drop it in the real app).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/pages/RegisterPage.test.tsx`
Expected: PASS

- [ ] **Step 5: Wire the route in `App.tsx`**

Replace the `/cadastro` placeholder from Task 1 with `<RegisterPage />`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: resident self-registration page at /cadastro"
```

---

### Task 6: Auth context, login page, protected route

**Files:**
- Create: `src/context/AuthContext.tsx`
- Create: `src/components/ProtectedRoute.tsx`
- Create: `src/pages/LoginPage.tsx`
- Test: `src/context/AuthContext.test.tsx`
- Modify: `src/App.tsx` (wrap in `<AuthProvider>`, wire `/login` and guard `/admin`)

**Interfaces:**
- Produces: `AuthProvider`, `useAuth(): { session: Session | null; loading: boolean; signIn(email, password): Promise<{ error?: string }>; signOut(): Promise<void> }`, used by `LoginPage`, `ProtectedRoute`, and `AdminPage` (Task 7).
- Produces: `<ProtectedRoute>{children}</ProtectedRoute>` that redirects to `/login` when `session` is null and `loading` is false.

- [ ] **Step 1: Write the failing test for `ProtectedRoute`'s redirect**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';

vi.mock('./AuthContext', () => ({ useAuth: () => ({ session: null, loading: false }) }));

describe('ProtectedRoute', () => {
  it('redirects to /login when there is no session', () => {
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/admin" element={<ProtectedRoute><div>Secret</div></ProtectedRoute>} />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>
    );
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/context/AuthContext.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `AuthContext`**

`AuthProvider` subscribes to `supabase.auth.onAuthStateChange` and seeds from `supabase.auth.getSession()`; `signIn` calls `supabase.auth.signInWithPassword`; `signOut` calls `supabase.auth.signOut()`.

- [ ] **Step 4: Implement `ProtectedRoute`**

Render `<Navigate to="/login" replace />` when `!loading && !session`; render a spinner when `loading`; render `children` otherwise.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/context/AuthContext.test.tsx`
Expected: PASS

- [ ] **Step 6: Implement `LoginPage`**

Simple email/password form styled with the mockup's dark/emerald aesthetic, calling `useAuth().signIn`, showing the Supabase error message on failure, redirecting to `/admin` on success.

- [ ] **Step 7: Wire into `App.tsx`**

Wrap the router tree in `<AuthProvider>`; mount `LoginPage` at `/login`; wrap the `/admin` element in `<ProtectedRoute>`.

- [ ] **Step 8: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: Supabase auth context, login page, and protected /admin route"
```

---

### Task 7: Admin dashboard shell + KPIs + Occurrences tab

**Files:**
- Create: `src/pages/AdminPage.tsx`
- Create: `src/components/admin/KpiCards.tsx`
- Create: `src/components/admin/OccurrencesTab.tsx`
- Test: `src/components/admin/KpiCards.test.tsx`

**Interfaces:**
- Consumes: `supabase`, `Bike`/`Incident`/`CondoSettings` types, `useAuth` (for a sign-out button).
- Produces: `<KpiCards activeCount={number} totalCapacity={number} pendingCount={number} openIncidentCount={number} />`, a pure presentational component reused by `AdminPage`; `occupancyPercent(active: number, capacity: number): number` exported from `KpiCards.tsx` (or a small co-located helper) clamped to `[0, 100]`.
- Produces: `<OccurrencesTab />` that fetches open/resolved incidents joined with their bike's `tag_number` + `unit_block` (admin-only view, safe to show owner-adjacent data here) and exposes a "Marcar Resolvida" action calling `supabase.from('incidents').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', id)`.

- [ ] **Step 1: Write the failing test for the capacity clamp**

```tsx
import { describe, it, expect } from 'vitest';
import { occupancyPercent } from './KpiCards';

describe('occupancyPercent', () => {
  it('clamps at 100 when active bikes exceed capacity', () => {
    expect(occupancyPercent(60, 50)).toBe(100);
  });
  it('computes a normal percentage otherwise', () => {
    expect(occupancyPercent(38, 50)).toBe(76);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/KpiCards.test.tsx`
Expected: FAIL (module/export not found)

- [ ] **Step 3: Implement `occupancyPercent` and `KpiCards`**

`occupancyPercent = (active, capacity) => capacity <= 0 ? 0 : Math.min(100, Math.round((active / capacity) * 100))`. `KpiCards` renders the four mockup cards (occupancy bar, active, pending, open incidents) using this function and the props' raw counts — purely presentational, no data fetching.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/KpiCards.test.tsx`
Expected: PASS

- [ ] **Step 5: Implement `OccurrencesTab`**

Fetch `supabase.from('incidents').select('*, bikes(tag_number, unit_block)').order('created_at', { ascending: false })`; split into open/resolved sections matching the mockup's card style (reason, note, photo badge, timestamp, "Marcar Resolvida" button); empty state copy ported from the mockup's `renderOccurrences()`.

- [ ] **Step 6: Implement `AdminPage` shell**

Tab bar (Ocorrências / Aprovações / Frota) over `KpiCards` fetching its own counts (`bikes` count by status via `select('id', { count: 'exact', head: true })`, `condo_settings` single row, `incidents` open count) and rendering the active tab's component; a sign-out button using `useAuth().signOut`. Leave `ApprovalsTab`/`FleetTab` as placeholders for Tasks 8–9.

- [ ] **Step 7: Verify build**

Run: `npm run build`
Expected: succeeds.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: admin dashboard shell, KPI cards, and occurrences tab"
```

---

### Task 8: Approvals tab (tag assignment + QR generation)

**Files:**
- Create: `src/components/admin/ApprovalsTab.tsx`
- Test: `src/components/admin/ApprovalsTab.test.tsx`
- Modify: `src/pages/AdminPage.tsx` (mount the real tab)

**Interfaces:**
- Consumes: `supabase`, `Bike` type, `formatTagNumber` (Task 1 — used only for display since `approve_bike` already returns the formatted string).
- Produces: `<ApprovalsTab onApproved={() => void}>` so `AdminPage` can refresh its KPI counts after an approval.

- [ ] **Step 1: Write the failing test for the approval call**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ApprovalsTab from './ApprovalsTab';

const rpc = vi.fn().mockResolvedValue({ data: '039', error: null });
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [{ id: 'b1', unit_block: 'Bloco A', owner_name: 'X', brand_model: 'Y', color: 'Z', photo_url: null }], error: null }) }) }) }),
    rpc,
  },
}));

describe('ApprovalsTab', () => {
  it('calls approve_bike RPC with the bike id when approving', async () => {
    render(<ApprovalsTab onApproved={() => {}} />);
    await waitFor(() => screen.getByText(/Bloco A/));
    fireEvent.click(screen.getByRole('button', { name: /atribuir adesivo/i }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('approve_bike', { p_bike_id: 'b1' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/ApprovalsTab.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `ApprovalsTab`**

Fetch `supabase.from('bikes').select('*').eq('status', 'pending').order('created_at')`; render each pending bike's photo, unit, owner, model/color (full detail is fine — admin-only, per spec). "Atribuir Adesivo" button calls `supabase.rpc('approve_bike', { p_bike_id: bike.id })`; on success, show the returned tag inside a `qrcode.react` `<QRCodeSVG value={`${window.location.origin}${window.location.pathname}#/b/${tag}`} />` (note the `#/` — the deployed site is `HashRouter`-based, see Global Constraints) in a small modal/panel styled like the mockup's sticker preview, call `onApproved()`, and refetch the pending list.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/admin/ApprovalsTab.test.tsx`
Expected: PASS

- [ ] **Step 5: Mount in `AdminPage`**

Replace the Task 7 placeholder with `<ApprovalsTab onApproved={refetchKpis} />`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: admin approvals tab with atomic tag assignment and QR generation"
```

---

### Task 9: Fleet tab (search, inactivate, capacity modal)

**Files:**
- Create: `src/components/admin/FleetTab.tsx`
- Create: `src/components/admin/CapacityModal.tsx`
- Test: `src/components/admin/FleetTab.test.tsx`
- Modify: `src/pages/AdminPage.tsx` (mount the real tab, pass capacity state)

**Interfaces:**
- Consumes: `supabase`, `Bike`/`CondoSettings` types.
- Produces: `<FleetTab />` (self-contained: fetches active+inactive bikes, filters client-side by its own search input) and `<CapacityModal currentCapacity={number} onSave={(n: number) => void} onClose={() => void} />`.

- [ ] **Step 1: Write the failing test for client-side search filtering**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import FleetTab from './FleetTab';

vi.mock('../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ order: () => Promise.resolve({ data: [
    { id: '1', tag_number: '014', unit_block: 'Bloco A', owner_name: 'Carlos', owner_whatsapp: 'x', brand_model: 'Caloi', color: 'Cinza', status: 'active' },
    { id: '2', tag_number: '007', unit_block: 'Bloco B', owner_name: 'Fernanda', owner_whatsapp: 'y', brand_model: 'Sense', color: 'Azul', status: 'active' },
  ], error: null }) }) }) },
}));

describe('FleetTab', () => {
  it('filters the table by search text', async () => {
    render(<FleetTab />);
    await waitFor(() => screen.getByText(/Caloi/));
    fireEvent.change(screen.getByPlaceholderText(/buscar/i), { target: { value: '007' } });
    expect(screen.queryByText(/Caloi/)).not.toBeInTheDocument();
    expect(screen.getByText(/Sense/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `FleetTab`**

Fetch all `bikes` (any status except `pending`, which lives in Approvals), search input filtering by tag/unit/owner/model exactly like the mockup's `renderInventory()`; "Dar Baixa" button sets `status = 'inactive'` via `supabase.from('bikes').update({ status: 'inactive' }).eq('id', id)` (soft delete — freeing the occupancy count, not a hard row delete, since the mockup's `removeBike` hard-deletes but the spec says "inativar... liberando vaga"); a toolbar button opens `CapacityModal`.

- [ ] **Step 4: Implement `CapacityModal`**

Small form with one number input pre-filled from `currentCapacity`, Save button calling `onSave`, which the parent wires to `supabase.from('condo_settings').update({ total_capacity: n }).eq('id', settingsId)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/admin/FleetTab.test.tsx`
Expected: PASS

- [ ] **Step 6: Mount in `AdminPage`**

Replace the Task 7 placeholder; wire `CapacityModal`'s save to refresh `AdminPage`'s KPI state.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: admin fleet tab with search, soft-deactivation, and capacity modal"
```

---

### Task 10: PWA manifest, README, final polish

**Files:**
- Create: `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png` (simple placeholder emerald bike-themed icons)
- Modify: `index.html` (link manifest, theme-color meta)
- Create: `README.md`
- Modify: `.gitignore` (ensure `.env`, `node_modules`, `dist` are excluded)

**Interfaces:**
- None — this task wires existing pieces for deployability, no new exported functions.

- [ ] **Step 1: Add `public/manifest.webmanifest`**

`{ "name": "BikeCondo", "short_name": "BikeCondo", "start_url": "/", "display": "standalone", "background_color": "#f8fafc", "theme_color": "#059669", "icons": [...] }`.

- [ ] **Step 2: Link it in `index.html`**

Add `<link rel="manifest" href="/manifest.webmanifest">` and `<meta name="theme-color" content="#059669">`.

- [ ] **Step 3: Write `README.md`**

Sections: what the app does (short version of the spec), tech stack, setup (`npm install`, copy `.env.example` to `.env`, fill Supabase URL/anon key, run `supabase/schema.sql` in the Supabase SQL editor, create an admin user via Supabase Auth dashboard), `npm run dev`, `npm run build`. Deploy section defers to Task 11 (GitHub Pages) — link to it rather than duplicating the steps.

- [ ] **Step 4: Full test suite run**

Run: `npx vitest run`
Expected: all tests across every task pass.

- [ ] **Step 5: Full build**

Run: `npm run build`
Expected: succeeds with no errors or warnings about unused env vars.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: add PWA manifest and project README"
```

---

### Task 11: GitHub Pages deployment

**Files:**
- Modify: `vite.config.ts` (set `base`)
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (deploy section)

**Interfaces:**
- None — this task only wires CI/build config; it does not change any app code or exported interface. It depends on Task 1 (project exists) and Task 10 (manifest/README exist) being done, but can run any time after Task 1 in practice.

- [ ] **Step 1: Set the Vite `base` path**

In `vite.config.ts`, set `base: '/gestao-bikes/'` (the GitHub repo name — confirm it matches the actual repo name `andrevisc-1209/gestao-bikes` before hardcoding; if the repo is ever renamed this must change too). Without this, built asset URLs break on a project-page deploy (`<user>.github.io/<repo>/`).

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

A workflow triggered `on: push: branches: [main]` that: checks out, sets up Node, runs `npm ci`, runs `npm run build` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` taken from `${{ secrets.VITE_SUPABASE_URL }}` / `${{ secrets.VITE_SUPABASE_ANON_KEY }}` (repo secrets — these end up visible in the built client bundle since this is a public-anon-key client app, but keeping them as secrets avoids hardcoding environment-specific values in the repo), then deploys `dist/` using `actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4` (the standard `actions/configure-pages` flow, `permissions: pages: write, id-token: write`).

- [ ] **Step 3: Document the one-time repo setting**

In `README.md`'s deploy section, note the manual one-time step this task's workflow cannot do itself: in the GitHub repo's Settings → Pages, set "Source" to "GitHub Actions"; and in Settings → Secrets and variables → Actions, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Also note the final URL shape: `https://andrevisc-1209.github.io/gestao-bikes/#/cadastro` etc.

- [ ] **Step 4: Verify the workflow YAML is syntactically valid**

Run: `cat .github/workflows/deploy.yml | python3 -c "import sys, yaml; yaml.safe_load(sys.stdin)"` (or any available YAML validator)
Expected: no parse error.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "ci: deploy to GitHub Pages via GitHub Actions"
git push -u origin main
```

- [ ] **Step 6: Manual verification (requires the repo secrets and Pages source to already be set per Step 3)**

After pushing, check the Actions tab for a successful `deploy.yml` run, then open `https://andrevisc-1209.github.io/gestao-bikes/#/cadastro` and confirm the registration form renders.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-11-23-bikecondo-webapp.md`.
