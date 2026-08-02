# CSCP Route — project guide

A cross-device study tracker + spaced-repetition app for the ASCM CSCP exam.
Single user (the owner), installed as a PWA on iPhone.

## Stack
- Next.js 14, App Router, all pages are client components ("use client")
- Supabase: email OTP auth (8-digit code — NOT magic links; they break inside
  the installed iOS PWA), Postgres with RLS on every table, Storage bucket `media`
- Deployed on Vercel via GitHub (push to main = deploy), custom domain
- PWA: `public/manifest.json` + `public/sw.js` (service worker never intercepts
  Supabase requests; bump its VERSION string when changing cached routes)

## Layout
- `app/` — routes: `/` (Route dashboard), `/dock` (full-screen card review),
  `/notes`, `/plan`, `/how-it-works`
- `components/` — Dashboard, DockMode, TodayPlan, Notes, DrawingPad, Auth, NavBar
- `lib/` — supabaseClient, constants (modules/phases/SRS steps), todayEngine,
  storage (media bucket helpers), useSession
- `supabase/schema.sql` + `schema_v2.sql` — already applied to the live project.
  New schema changes: add a new `schema_v3.sql` (additive, IF NOT EXISTS style)
  and the owner runs it manually in the Supabase SQL Editor.

## Data model (all tables RLS-scoped to auth.uid() = user_id)
- `settings` — start_date, exam_date, target_hours (one row per user)
- `modules_progress` — status per module 1–8: todo | progress | done
- `sessions` — granular study log: module_id, minutes, logged_at
- `cards` — flashcards: front, back, image_path, step (0–6), due_date.
  SRS intervals: STEP_DAYS = [1,3,7,14,30,60,120]; Again→0, Good→+1, Easy→+2
- `notes` — title, content, module_id (null = General), image_paths[]

## Conventions
- Dark maritime theme: CSS vars in `app/globals.css` (--bg, --panel, --amber,
  --teal...). Fonts: Space Grotesk (headings), Inter (body), JetBrains Mono.
- No CSS framework; plain global CSS classes.
- Respect iOS safe areas (env(safe-area-inset-*)) — body and Dock already do.
- Keep client-side data access direct via supabase-js; RLS is the security layer.

## Environment
- `.env.local` (never committed): NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY. Same two vars set in Vercel.
- Owner is on Windows; prefer cross-platform commands.

## Validate before pushing
- `npm run build` must pass (placeholder env vars in .env.local are fine for
  building). Push to main deploys straight to production via Vercel.
