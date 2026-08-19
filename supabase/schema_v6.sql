-- Run in Supabase SQL Editor after schema.sql ... schema_v5.sql. Additive.
-- Per-functional-area performance score (0-100), from an ASCM quiz you enter
-- or from an in-app practice session. Blended into readiness alongside
-- flashcard retention.

create table if not exists public.quiz_scores (
  user_id uuid references auth.users(id) on delete cascade,
  module_id int not null,
  functional_area text not null,
  score numeric not null check (score >= 0 and score <= 100),
  updated_at timestamptz not null default now(),
  primary key (user_id, module_id, functional_area)
);

alter table public.quiz_scores enable row level security;

drop policy if exists "own quiz_scores" on public.quiz_scores;
create policy "own quiz_scores" on public.quiz_scores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
