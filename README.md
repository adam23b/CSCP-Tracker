# CSCP Route — cross-device study tracker

A Next.js app backed by Supabase. Same tool as before (pace calculator, module
route map, session logging, spaced-repetition flashcards) but now synced to
your account across every device.

## 1. Supabase setup

1. Create a project at supabase.com (or use an existing one).
2. Open **SQL Editor → New query**, paste the contents of `supabase/schema.sql`, and run it. This creates the four tables (`settings`, `modules_progress`, `sessions`, `cards`) with row-level security so each signed-in user only ever sees their own rows.
3. Open a new SQL Editor query, paste `supabase/schema_v2.sql`, and run it. This adds image support to flashcards, a `notes` table, and a public `media` storage bucket with policies so each user can only upload/edit/delete their own files (read is public — files are only reachable via their exact, random URL).
4. Go to **Authentication → Providers** and confirm **Email** is enabled (it is by default). This app uses magic-link sign-in — no passwords to manage.
4. Go to **Authentication → URL Configuration** and set:
   - **Site URL**: your production URL (e.g. `https://study.yourdomain.com`)
   - **Redirect URLs**: add both your production URL and `http://localhost:3000` (for local dev)
5. Go to **Settings → API** and copy the **Project URL** and **anon public** key — you'll need both next.

## 2. Local development

```bash
cp .env.local.example .env.local
# paste your Project URL and anon key into .env.local

npm install
npm run dev
```

Visit `http://localhost:3000`, sign in with your email, click the link Supabase sends you.

## 3. Deploy to Vercel

1. Push this folder to a GitHub repo.
2. In Vercel: **Add New Project → Import** the repo.
3. Under **Environment Variables**, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy.
5. In **Project Settings → Domains**, add your custom domain and follow Vercel's DNS instructions.
6. Go back to Supabase's **URL Configuration** and make sure the custom domain is in the Redirect URLs list.

## How the data is organized

- `settings` — one row per user: `start_date`, `exam_date`, `target_hours`.
- `modules_progress` — one row per module (1–8) per user: status only.
- `sessions` — one row per logged study session (`module_id`, `minutes`, timestamp). Hours-per-module are summed from this on the fly, deliberately kept granular so you can build things like a "hours per week" chart later without touching the schema.
- `cards` — flashcards, with a `step` (0–6) driving the spaced-repetition interval, a `due_date`, and an optional `image_path`.
- `notes` — free-form notes with a title, text content, an optional module tag, and an array of attached image paths (uploaded photos or hand-drawn sketches).
- Storage bucket `media` — every image (flashcard images, note images, drawn sketches) lives here under `{user_id}/cards/...` or `{user_id}/notes/...`, which is also how the RLS policies scope write access to the owner.

## Pages

- `/` — Route: pace calculator, module tracker, session logging, flashcard review + deck management.
- `/notes` — free-form notes: text, photo uploads, and an in-browser drawing pad for sketching process flows.
- `/plan` — the study plan itself (the four legs, module breakdown, retention rationale) as an always-available reference.

Every table is scoped by Postgres row-level security to `auth.uid()`, so there's no extra access-control code to write as you add features — a signed-in user can only ever touch their own rows.

## Where to extend this

The project is intentionally small and flat so it's easy to grow:

- **New pages**: add a folder under `app/`, e.g. `app/stats/page.js`, for a hours-per-week chart or a domain-weighted score predictor.
- **New tables**: add them to `supabase/schema.sql`, re-run the new `create table` + `create policy` statements in the SQL Editor.
- **New components**: drop them in `components/` and import into `Dashboard.js` or a new page.
- **Practice exam scores**: a natural next addition — a `mock_exams` table (date, score, domain breakdown) plus a small chart, to track your Leg 3 practice-exam trend over time.
