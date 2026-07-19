-- Run this in Supabase SQL Editor AFTER schema.sql. Safe to run once on an
-- existing project — everything here is additive (IF NOT EXISTS guards).

-- 1. Let flashcards carry an optional image
alter table public.cards add column if not exists image_path text;

-- 2. Notes: text + images + hand-drawn sketches
create table if not exists public.notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  module_id int,                 -- null = "General", not tied to a module
  title text not null,
  content text default '',
  image_paths text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;

drop policy if exists "own notes" on public.notes;
create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. Storage bucket for flashcard images, note images, and drawn sketches.
-- Public bucket: files are readable by anyone with the exact (random) URL,
-- but only the owner can upload/replace/delete their own files, enforced below.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media read public" on storage.objects;
create policy "media read public" on storage.objects
  for select using (bucket_id = 'media');

drop policy if exists "media insert own" on storage.objects;
create policy "media insert own" on storage.objects
  for insert with check (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "media update own" on storage.objects;
create policy "media update own" on storage.objects
  for update using (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects
  for delete using (
    bucket_id = 'media' and auth.uid()::text = (storage.foldername(name))[1]
  );
