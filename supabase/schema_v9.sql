-- Run in Supabase SQL Editor after schema.sql ... schema_v8.sql. Additive.
-- Soft-delete for notes: deleting sets deleted_at instead of removing the row,
-- so notes can be restored from Trash. RLS ("own notes") already covers it.
alter table public.notes add column if not exists deleted_at timestamptz;
