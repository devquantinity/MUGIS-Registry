# MUGIS-Registry

Upper GI Cancer Registry for the Malaysian Upper Gastrointestinal Surgical
Society (MUGIS). Phase 1 — Gastric Adenocarcinoma.

## Stack

- Next.js 15 (App Router, `src/` directory)
- TypeScript (strict)
- Tailwind CSS v3 — design tokens as CSS variables in `src/app/globals.css`
- No runtime dependencies beyond React and Next

## Getting started

The app signs in against the MUGIS backend (`mugis-backend`). Start that
first (it listens on http://localhost:8080 by default), then:

```bash
cp .env.example .env          # empty NEXT_PUBLIC_API_BASE_URL + API_PROXY_TARGET=http://localhost:8080
npm install
npm run dev                   # reads .env
npm run dev:staging           # reads .env.staging
npm run build:staging         # production build against .env.staging
```

Open http://localhost:3000 and sign in with a backend account. The first
SYSTEM_ADMIN comes from the backend (`BOOTSTRAP_ADMIN_EMAIL`, or
`internal/data/support-sql/CREATE_ADMIN.sql`). Everyone sets up an
authenticator app on first sign-in.

`.env` and `.env.staging` are gitignored, and `.claude/settings.json` stops
Claude Code from reading them.

## Backend integration

Live against the API (`src/lib/api.ts`):

| Screen | API |
| --- | --- |
| Sign in, 2-step code, mandatory TOTP enrolment | `/auth/login`, `/auth/login/verify-2fa`, `/auth/2fa/*`, `/auth/refresh` |
| Request an account, activation link, invitation, password reset | `/auth/register`, `/auth/activate`, `/auth/accept-invitation`, `/auth/forgot-password`, `/auth/reset-password` |
| Profile — details, change password, sign out | `/auth/me`, `/auth/change-password`, `/auth/logout` |
| Centre switcher (users in several centres) | `/auth/switch-centre` |
| Admin — Registrations (HOD, Head of Service, Admin) | `/registrations`, `/centres/{id}/consultants` |
| Admin — Users, Admin — Centres (System Admin) | `/admin/users`, `/admin/centres` |

Error messages shown to users come from `GET /api/v1/error-dictionary`.
Tokens live in `sessionStorage` (gone when the tab closes); an expired access
token is refreshed once on a 401, and 30 minutes without activity signs the
user out.

The registry screens below (patients, episodes, reports, export, audit) still
run on the seeded in-browser demo data until their APIs exist. Real roles map
onto them: Consultant → clinician scope, Fellow → trainee scope.

## What works

Every page is functional against a seeded in-browser dataset (~75 patients,
6 centres, 18 users, full audit trail).

| Page | What it does |
| --- | --- |
| Dashboard | Live stats, stage distribution, surgical approach, per-centre volume, recent activity |
| Patients | Search, filter by centre and stage, sortable columns, pagination, CSV export, MyKad masking |
| New patient | Demography capture with cross-centre duplicate detection by hashed identifier |
| Patient detail | Demography, episode cards, per-patient audit trail, inline edit, delete |
| Episodes | Filter by status, centre, and completeness |
| Episode record | All 12 parameter groups, ~85 fields, live AJCC staging, live Charlson score, dirty-tracking save |
| Reports | Operative audit metrics — R0 rate, nodal yield, Clavien-Dindo, 30-day mortality, MIS rate |
| Data export | Pick parameter groups, choose CSV or JSON, identifier toggle, every export audited |
| Admin — Users | Invite, change role, toggle 2FA, suspend |
| Admin — Centres | Recruitment and completeness by centre |
| Admin — Audit | Filterable immutable log with field-level before/after values |

### Derived values

- **AJCC 8th edition stage** from T, node-positive count and metastatic site.
  Shows its own reasoning. `src/lib/staging.ts`.
- **Charlson Comorbidity Index** including age points, with the contributing
  factors listed.
- **N stage** from node counts (N0 / N1 / N2 / N3a / N3b).
- **BMI** with nutritional band.
- **Completeness** per group and per record.

> The AJCC tables must be reviewed and signed off by a MUGIS consultant
> before go-live. Quantyr implements the tables; clinical correctness
> remains a MUGIS responsibility.

### Access model

| Role | Scope |
| --- | --- |
| System Admin | Everything, plus user and centre management |
| Clinician | Creates and edits **only** the records they entered |
| Head of Department | Reads every record in their own centre |
| Head of Service | Reads every record, every centre |
| Researcher | De-identified read and export, nationwide |
| Trainee | Limited entry; logbook lands in Phase 2 |

Scoping is applied in `src/lib/access.ts` and consumed through the
`useScoped()` hook, so no page can accidentally render a record the signed-in
user should not see. In production this is enforced by PostgreSQL row-level
security as well — the interface is never the only line of defence.

## Structure

```
src/app/            App Router pages
src/components/     Shell, LoginScreen, EpisodeForm, ui kit
src/lib/
  parameters.ts     All 12 groups and ~85 fields, transcribed from the
                    MUGIS parameter documents. Adding a cancer type is a
                    new entry in SCHEMAS — no migration, no new form code.
  staging.ts        AJCC 8th ed., Charlson, BMI, completeness
  access.ts         Role scoping
  store.tsx         State, audit trail, localStorage persistence
  seed.ts           Deterministic dummy data
```

## Phones and tablets

Clinicians use the registry on phones and iPads, so every screen is laid out
for a small phone first and checked at widths from 280px (Galaxy Fold) to
1920px, in portrait and landscape:

| Width | Layout |
| --- | --- |
| below 640px (phones) | one column, bottom tab bar, dialogs as bottom sheets |
| 640–1023px (iPad portrait) | lists as two columns of cards, bottom tab bar |
| 1024–1279px (iPad landscape) | tables, bottom tab bar, full-width content |
| 1280px and up | sidebar and desktop top bar |

- The shell switches at `xl` (`TabBar`, `MobileHeader` and `Sidebar` in
  `Shell.tsx`); the cancer record's section rail switches with it
  (`EpisodeForm.tsx`). Lists are cards below `lg`, tables from `lg`.
- `touch:` is a Tailwind variant for `(pointer: coarse)`. `.btn` and `.input`
  are 44px tall there, and other controls get the same size. Keep text inputs
  at 16px or iOS zooms in when they take focus.
- `short:` is `(max-height: 500px)`, a phone held sideways: the header scrolls
  away and the tab bar shows icons only.
- On a phone the tab bar slides away while the keyboard is up.
- Safe-area insets and bar heights are CSS variables at the top of
  `globals.css`.

## Not done yet

- **Auth is a demo stub.** One click signs you in. Real auth is server-side:
  password verification, TOTP second factor, httpOnly session cookie.
- **Data lives in the browser.** `localStorage`, seeded on first load.
  "Reset demo" in the top bar restores the seed. No database yet.
- Centre list in `src/lib/centres.ts` is placeholder data.
- Oesophageal Adenocarcinoma, Oesophageal SCC and GIST are Phase 2.
- Trainee logbook is Phase 2.

v1.0.2
