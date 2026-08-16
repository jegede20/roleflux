# Roleflux

An AI-powered job search assistant for **remote work**. You fill in your profile
once; Roleflux continuously ingests remote job listings, scores each one against
your profile with AI, and lets you generate tailored resume summaries and cover
letters on demand. A calm, Kanban-style board doubles as your application
tracker.

> **v1 scope note:** Roleflux does **not** auto-submit applications to external
> job boards, has no team/multi-user accounts, and ships no native app-store
> apps. It's a responsive PWA that works well on desktop and mobile browsers.

---

## Tech stack

| Layer            | Choice                                                        |
| ---------------- | ------------------------------------------------------------- |
| Frontend         | Next.js (App Router), Tailwind CSS, Inter font                |
| Drag & drop      | `@dnd-kit/core`                                               |
| Hosting / infra  | Vercel (hosting, serverless functions, Cron Jobs)             |
| Database / auth  | Supabase (Postgres, Auth via email + magic link, Storage)    |
| AI               | Groq API — model `openai/gpt-oss-120b`                        |
| Job sources      | Remotive, Arbeitnow, RemoteOK (all free, no key required)     |
| File parsing     | `pdf-parse` (PDF), `mammoth` (DOCX)                           |
| PWA              | Manual `manifest.json` + service worker                       |

---

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run the migrations **in order**:
   - `supabase/migrations/0001_init.sql` — tables, enums, triggers, RLS
   - `supabase/migrations/0002_seed_taxonomy.sql` — fixed roles/skills lists
   - `supabase/migrations/0003_storage.sql` — resume-file storage bucket
3. Under **Authentication → Providers**, ensure **Email** is enabled. For the
   smoothest local dev, you can turn *off* "Confirm email" so password sign-ups
   work immediately.
4. Grab your keys from **Project Settings → API**.

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and fill it in:

```bash
cp .env.example .env.local
```

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only, bypasses RLS
GROQ_API_KEY=...                   # from console.groq.com
CRON_SECRET=...                    # any long random string
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 4. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## First-run: seed some jobs

The job table starts empty. The Vercel Cron job fills it every 6 hours in
production, but locally (or on first deploy) you can trigger ingestion manually:

```bash
curl -X GET http://localhost:3000/api/cron/ingest-jobs \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Then in the app:

1. Go to **Profile** and add at least a couple of target roles / skills, plus a
   resume (paste or upload a PDF/DOCX). Everything autosaves.
2. Go to the **Board** and click **Scan for jobs** — Roleflux scores fresh jobs
   against your profile and drops strong matches (score ≥ 60) into **New
   Matches**. Scanning processes a batch at a time; click again for more.
3. Open a card → **Generate draft** to create a tailored resume summary +
   cover letter. Edit them inline (autosaves), copy with the copy buttons.
4. Drag cards across columns to track your pipeline.

---

## How it works

### Job ingestion (`/api/cron/ingest-jobs`)

- Scheduled every 6 hours via `vercel.json`.
- Fetches Remotive, Arbeitnow and RemoteOK, each in its own try/catch so one
  failing source never blocks the others.
- Normalizes each source's shape into the shared `jobs` schema.
- Upserts in batches of ~100 with `ignoreDuplicates` on `(source, external_id)`
  to stay within the serverless time budget and de-dupe.
- Secured by the `Authorization: Bearer <CRON_SECRET>` header.

### Matching (`/api/match`)

- For each unscored job × the signed-in profile, calls Groq at `temperature 0.3`
  asking for strict JSON `{"score": 0-100, "reason": "..."}`.
- Records every score in `matches`; only jobs scoring **≥ 60** create a card in
  the `applications` board (status `new_match`), so weak matches never flood it.
- Processes a bounded batch per request to respect function timeouts.

### Draft generation (`/api/applications/generate`)

- On-demand only — triggered by "Generate draft" on a specific card, never
  automatically for every match (keeps API usage in check).
- Calls Groq at `temperature 0.6` for strict JSON
  `{"resume_summary": "...", "cover_letter": "..."}` (250–300 word letter, no
  placeholders). Stores the result and moves the card to `drafted`.

### Resume parsing (`/api/resume/parse`)

- Server-side extraction: `pdf-parse` for PDFs, `mammoth` for DOCX.
- Extracted text lands in `profiles.resume_base`; the original file is
  optionally retained in the private `resumes` Storage bucket.

---

## Data model

- **profiles** — one per user (roles, skills, experience, salary, resume text).
- **jobs** — normalized listings shared across users; unique on
  `(source, external_id)`.
- **matches** — AI score (0–100) + one-sentence reason per profile × job.
- **applications** — the Kanban pipeline: `new_match → drafted → applied →
  interview → rejected`, plus tailored drafts and notes.
- **taxonomy_roles / taxonomy_skills** — fixed vocabularies constraining intake.

Row-level security scopes every user to their own profile, matches and
applications. Jobs and taxonomy are read-only reference data. Cron ingestion and
bulk matching use the service-role key to bypass RLS.

---

## Deploying to Vercel

1. Push this repo to GitHub and import it in Vercel.
2. Add all env vars from `.env.local` in the Vercel project settings (set
   `NEXT_PUBLIC_SITE_URL` to your production URL).
3. In Supabase **Authentication → URL Configuration**, add your production URL
   and `https://<your-domain>/auth/callback` to the redirect allow-list.
4. `vercel.json` registers the cron automatically — Vercel sends the
   `CRON_SECRET` bearer token on each run.

---

## PWA / Add to Home Screen

`public/manifest.json` + `public/sw.js` make Roleflux installable. It ships with
an SVG app icon; to also generate PNG icons (better on some older devices):

```bash
npm i -D sharp
node scripts/generate-icons.mjs
```

---

## Design system — "Calm Slate"

Indigo primary (`#4F46E5`), teal success accent (`#0D9488`), slate text, soft
shadows and rounded cards. The **Rejected** column is deliberately muted — job
rejections are emotionally loaded, so it avoids stark red or alarming visuals.
