# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository. It mirrors CLAUDE.md — see that file for the authoritative, actively-maintained version.

## What this project is

CareNova is an AI-powered patient-trust and conversion platform for Turkish health tourism clinics (hair transplant, dental, aesthetic surgery, and other branches). When a prospective international patient contacts a clinic but doesn't book, CareNova's multilingual AI (TR/EN/AR/DE/RU) replies over WhatsApp in seconds, qualifies the case against a branch-specific pricing-authority matrix, and hands off to a doctor-approved locked quote and an aftercare line that follows the patient home. It is not a CRM — it's the trust infrastructure between a clinic's ad spend and a booked, retained patient.

CareNova is forked from CareDental (`/Users/baturayozden/projects/caredental`), a working UK dental-clinic lead-recovery SaaS (~47k LOC). See `CARENOVA-STRATEJI.md` for the full product strategy and `docs/dental-cleanup-inventory.md` for exactly what was generalized or removed during the fork.

## Non-negotiable rules

1. **No dental-specific assumptions.** CareDental's codebase is dental-only; CareNova is branch-agnostic (hair transplant, dental, aesthetic, and beyond via the branch template engine, PAKET 6). Never hardcode a dental procedure, terminology, or UI copy as if it were universal.
2. **Turkish is the default UI language; every user-facing string goes through i18n.** English is the second language. Never hardcode a new user-facing string directly in JSX — add it to `frontend/src/i18n/locales/{tr,en}/*.json`.
3. **The AI pricing-authority matrix is never bypassed.** Each branch template defines what the AI may say about price: `full` / `range_from_photo` / `range_after_imaging` / `qualification_only` / `logistics_only` (CARENOVA-STRATEJI.md Bölüm 7/M2). A `qualification_only` branch (e.g. aesthetic surgery, bariatric, IVF) must never be made to quote a price, regardless of prompt changes elsewhere.
4. **Patient data is never used for model training or CareNova's own analytics under any circumstance.** This is a contractual commitment (KVKK data-processor position, Bölüm 7/M7.3) — do not add telemetry, logging, or fine-tuning pipelines that consume patient content.

## Workspaces

| Directory | Tech | Port |
|-----------|------|------|
| `backend/` | Node.js + Express (CommonJS) | 3001 |
| `frontend/` | React + TypeScript (Create React App) | 3000 |

(CareDental's `landing-v2/` Vite workspace was not part of the fork; the root `landing/` folder is a legacy static page, unused by the app.)

## Commands

### Backend
```bash
cd backend
cp .env.example .env   # fill keys the first time
npm install
npm run dev             # nodemon src/index.js
node migrate.js         # run schema migrations against PostgreSQL
```

### Frontend (CRA)
```bash
cd frontend
npm install --legacy-peer-deps
npm start               # react-scripts start
npm run build            # ALLOW_PLACEHOLDERS=1 gates on frontend/src/lib/businessDetails.ts
```

## Architecture overview — inherited from CareDental, being adapted

`src/index.js` is the backend entry point; `/api/leads`, `/api/clinics`, `/api/whatsapp`, `/api/activity`, `/api/insights` require `authenticate` middleware. Auth is JWT access (15 min) + rotated refresh tokens (7 days); **users and refresh tokens are still in-memory** (`backend/src/store/users.js`, `backend/src/utils/tokens.js`) — moving them to PostgreSQL is planned (KOMUT 3) but not yet done. Leads live in PostgreSQL via `pg` Pool (`DATABASE_URL`); migrations are numbered SQL files under `backend/src/migrations/`, applied by `backend/migrate.js`.

**AI pipeline** (`backend/src/services/ai.js` + `backend/src/routes/whatsapp.js`): parse webhook → upsert lead → detect objection → quota check → `detectLanguage`/`classifyScenario`/`generateFollowUp` via Claude (`claude-sonnet-4-5`) → send WhatsApp reply. `buildSystemPrompt` is being converted from a fixed dental prompt into a **layered compiler** (universal core + regulatory shield + branch template + clinic knowledge + case context + date/time reference) per CARENOVA-STRATEJI.md Bölüm 7/M0.4 — this is in progress, not finished.

**Case File model (new, in progress):** medical tourism's unit is a case, not a lead — patient, companions, medical file, quote(s), travel, program, payments, consents, aftercare line, ownership. See CARENOVA-STRATEJI.md Bölüm 7/M1 and `backend/src/migrations/` from 055 onward.

**Frontend**: `src/App.tsx` route tree, `src/context/AuthContext.tsx` for session, `src/lib/api.ts` Axios client (`REACT_APP_API_URL`, default `http://localhost:3001`). `src/pages/LandingPage.tsx` is currently a placeholder — the real CareNova landing page (TR/EN, Bölüm 6.2/7/10) is a separate work item.

## Environment variables

See `backend/.env.example` and `frontend/.env.example` for the current authoritative list — do not assume this doc is in sync with them. Key ones: `DATABASE_URL` (PostgreSQL), `JWT_SECRET`/`JWT_REFRESH_SECRET`, `WHATSAPP_ACCESS_TOKEN`/`WHATSAPP_PHONE_NUMBER_ID`/`WHATSAPP_WEBHOOK_VERIFY_TOKEN`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY` (falls back to console logging if blank), `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (patient document storage). Frontend: `REACT_APP_API_URL`, `REACT_APP_DEMO_MODE`.

**Never copy real secrets from `caredental/backend/.env` into CareNova.** The two products must not share a WhatsApp line, database, or AI key.

## Deployment

Frontend deploys to Vercel, project `carenova` (Baturay Ozden's personal Hobby team — **not** the `caredental` project, which lives under a separate team and is a live revenue-generating product). Backend is not yet deployed (no secrets provisioned); the frontend runs in demo mode (`REACT_APP_DEMO_MODE=true`) against seeded data until then.

## Key constraints (inherited, still true)

- **Users are in-memory only** until KOMUT 3 lands — restarting the backend clears all registered users except the seeded super-admin.
- **Refresh tokens are also in-memory** — same caveat.
- **WhatsApp webhook must respond 200 immediately** (`backend/src/routes/whatsapp.js`) — Meta's 5-second timeout.
- **AI never gives a real Anthropic call in dev/demo without a key** — demo mode must mock the AI response, not call the API.
