# MUGIS-Registry

Upper GI Cancer Registry for the Malaysian Upper Gastrointestinal Surgical
Society (MUGIS). Phase 1 — Gastric Adenocarcinoma.

## Stack

- Next.js 15 (App Router, `src/` directory)
- TypeScript (strict)
- Tailwind CSS v3 — design tokens as CSS variables in `src/app/globals.css`
- No runtime dependencies beyond React and Next

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000. Pick a centre and role, press Continue — no
password in demo mode. Change the role to see the access model change.

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

## Not done yet

- **Auth is a demo stub.** One click signs you in. Real auth is server-side:
  password verification, TOTP second factor, httpOnly session cookie.
- **Data lives in the browser.** `localStorage`, seeded on first load.
  "Reset demo" in the top bar restores the seed. No database yet.
- Centre list in `src/lib/centres.ts` is placeholder data.
- Oesophageal Adenocarcinoma, Oesophageal SCC and GIST are Phase 2.
- Trainee logbook is Phase 2.
