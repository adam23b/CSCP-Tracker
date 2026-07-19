-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run
create extension if not exists "uuid-ossp";

-- one settings row per user: their exam date, target hours, and route start date
create table if not exists public.settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  start_date date not null default current_date,
  exam_date date not null default (current_date + interval '8 months'),
  target_hours numeric not null default 100
);

-- status of each of the 8 CSCP modules, per user
create table if not exists public.modules_progress (
  user_id uuid references auth.users(id) on delete cascade,
  module_id int not null check (module_id between 1 and 8),
  status text not null default 'todo' check (status in ('todo','progress','done')),
  primary key (user_id, module_id)
);

-- a log of every study session -- kept granular on purpose so you can build
-- things like "hours per week" charts later without changing the schema
create table if not exists public.sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  module_id int not null,
  minutes numeric not null,
  logged_at timestamptz not null default now()
);

-- flashcards, with a simple spaced-repetition step + next due date
create table if not exists public.cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  module_id int not null,
  front text not null,
  back text not null,
  step int not null default 0,
  due_date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table public.settings enable row level security;
alter table public.modules_progress enable row level security;
alter table public.sessions enable row level security;
alter table public.cards enable row level security;

-- each user can only ever see/edit their own rows
create policy "own settings" on public.settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own modules_progress" on public.modules_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own sessions" on public.sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own cards" on public.cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
