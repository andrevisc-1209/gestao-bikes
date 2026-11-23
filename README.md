# BikeCondo

BikeCondo is a small web app for condominiums to manage shared electric
bikes. It covers the whole lifecycle of a bike in the fleet:

- **Residents** self-register their bike at `/cadastro` (unit, owner, WhatsApp
  contact, brand/model, color, photo) with the bike entering as `pending`.
- **Admins** review pending registrations, approve them, and the app
  atomically assigns the next sequential tag number and generates a QR code
  for it.
- A physical QR sticker on the bike links to a **public incident page**
  (`/b/:tagNumber`) anyone can open — it shows only non-identifying bike info
  (brand, color, tag) and lets a passerby report an issue via a WhatsApp
  message, without ever exposing the owner's name, unit, or phone number.
- The **admin dashboard** (`/admin`, behind Supabase Auth login) shows
  occupancy/KPI cards, an occurrences tab for open/resolved incident reports,
  an approvals tab for pending bikes, and a fleet tab to search, soft-deactivate
  bikes, and adjust total condo capacity.

## Tech stack

- [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Supabase](https://supabase.com/) (Postgres + Auth + Storage) as the backend
- [React Router](https://reactrouter.com/) (`HashRouter`) for client-side routing
- [Vitest](https://vitest.dev/) + React Testing Library for tests
- `qrcode.react` for QR code generation, `browser-image-compression` for
  client-side photo compression before upload

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the example env file and fill in your Supabase project's credentials:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the
   values from your Supabase project's API settings.

3. Set up the database: open your Supabase project's SQL editor and run the
   contents of `supabase/schema.sql`. This creates the tables, enums,
   row-level security policies, and RPCs (`get_public_bike_by_tag`,
   `approve_bike`) the app depends on.

4. Create an admin user: in the Supabase dashboard, go to
   **Authentication → Users** and add a user with an email/password. That
   account is what you'll use to sign in at `/#/login` and access `/#/admin`
   (there is no self-service admin sign-up — admins are provisioned directly
   in Supabase).

5. **Mandatory — disable public sign-up.** Every privileged RLS policy and
   RPC in `supabase/schema.sql` grants access with `to authenticated` (or an
   equivalent "is this an authenticated session" check) and nothing more —
   there is no separate `admins` table or role claim. Supabase projects allow
   anyone to self-register a new account by default
   (`supabase.auth.signUp`), and a freshly self-registered user is just as
   "authenticated" as the admin account you created in step 4. Without this
   step, anyone who signs up (even with a throwaway, unconfirmed-looking
   email) can read every resident's name, unit, and WhatsApp number, and can
   deactivate bikes or change condo capacity — the exact privacy leak this
   app exists to prevent. To close this off, go to the Supabase dashboard,
   **Authentication → Providers** (on some Supabase versions this is under
   **Authentication → Settings** instead — look for email provider settings
   either way) and **disable "Allow new users to sign up"** (sometimes
   labeled "Enable email signups"). This must be done before the app is
   used with real resident data; it ensures the only authenticated session
   anyone can ever obtain is the one admin account you provision by hand.

## Running locally

```bash
npm run dev
```

This starts the Vite dev server (default `http://localhost:5173`).

## Building for production

```bash
npm run build
```

Type-checks the project (`tsc`) and produces a static build in `dist/`.

## Testing

```bash
npx vitest run
```

## Deploying

This project deploys to GitHub Pages automatically via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml), which builds
the app and publishes `dist/` on every push to `main`. The Vite `base` path
in `vite.config.ts` is set to `/gestao-bikes/` to match this repo's name,
since GitHub Pages serves project pages from a `<user>.github.io/<repo>/`
subpath.

Two one-time manual steps are required in the GitHub repo settings before
the workflow can deploy successfully (the workflow cannot do these itself):

1. **Settings → Pages**: set "Source" to **GitHub Actions**.
2. **Settings → Secrets and variables → Actions**: add repository secrets
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with the values from your
   Supabase project's API settings. (These end up visible in the built
   client bundle, since this is a public-anon-key client app — they're kept
   as secrets only to avoid hardcoding environment-specific values in the
   repo.)

Once those are set, pushes to `main` deploy automatically. The app is
served at `https://andrevisc-1209.github.io/gestao-bikes/`, with routes such
as `https://andrevisc-1209.github.io/gestao-bikes/#/cadastro` (routing uses
`HashRouter`, so the `#` is expected).
