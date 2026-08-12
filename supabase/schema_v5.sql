-- Run this in Supabase SQL Editor AFTER schema.sql ... schema_v4.sql.
-- Deck sharing (copy model): the admin copies their cards + notes into
-- another user's account. The recipient gets an independent copy with a
-- fresh spaced-repetition schedule.
--
-- SECURITY DEFINER lets this function write into the recipient's rows (past
-- RLS), but auth.uid()/auth.jwt() still identify the CALLER — so the admin
-- check below is enforced. Only the admin email may share.
--
-- NOTE: change the admin email here if your login differs (keep it in sync
-- with ADMIN_EMAIL in lib/constants.js).

create or replace function public.share_deck(recipient_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_email text := auth.jwt() ->> 'email';
  admin_email  text := 'adam23b@gmail.com';
  recipient_id uuid;
  cards_copied int := 0;
  notes_copied int := 0;
begin
  if caller_email is null or lower(caller_email) <> lower(admin_email) then
    raise exception 'Not authorized to share.';
  end if;

  select id into recipient_id
  from auth.users
  where lower(email) = lower(trim(recipient_email))
  limit 1;

  if recipient_id is null then
    raise exception 'No user found with that email. They need to sign into the app once first.';
  end if;
  if recipient_id = auth.uid() then
    raise exception 'That is your own account.';
  end if;

  -- Copy cards the recipient doesn't already have (matched by module + front + back).
  with ins as (
    insert into public.cards (user_id, module_id, front, back, topic, functional_area, exam_priority, image_path, step, due_date)
    select recipient_id, c.module_id, c.front, c.back, c.topic, c.functional_area, c.exam_priority, c.image_path, 0, current_date
    from public.cards c
    where c.user_id = auth.uid()
      and not exists (
        select 1 from public.cards r
        where r.user_id = recipient_id
          and r.module_id = c.module_id
          and r.front = c.front
          and r.back = c.back
      )
    returning 1
  )
  select count(*) into cards_copied from ins;

  -- Copy notes the recipient doesn't already have (matched by module + title + content).
  with ins as (
    insert into public.notes (user_id, module_id, title, content, image_paths)
    select recipient_id, n.module_id, n.title, n.content, n.image_paths
    from public.notes n
    where n.user_id = auth.uid()
      and not exists (
        select 1 from public.notes r
        where r.user_id = recipient_id
          and coalesce(r.module_id, -1) = coalesce(n.module_id, -1)
          and r.title = n.title
          and r.content = n.content
      )
    returning 1
  )
  select count(*) into notes_copied from ins;

  return json_build_object('cards_copied', cards_copied, 'notes_copied', notes_copied);
end;
$$;

revoke all on function public.share_deck(text) from public;
grant execute on function public.share_deck(text) to authenticated;
