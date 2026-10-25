begin;

-- Existing rows intentionally retain NULL: their original addition date is unknown.
alter table public.books add column if not exists added_when timestamptz;
alter table public.books alter column added_when set default now();

-- Expose only the aggregate; individual ratings remain protected by existing RLS.
create or replace function public.get_meeting_rating(p_meeting_id text)
returns table(average_rating numeric, rating_count bigint)
language sql stable security definer set search_path = ''
as $$
  select avg(ub.rating)::numeric, count(ub.rating)
  from public.meetings m
  join public.user_books ub on ub.book_id = m.book_id
    and coalesce(to_jsonb(m.attendees), '[]'::jsonb) @> jsonb_build_array(ub.user_id::text)
  where auth.uid() is not null
    and m.id::text = p_meeting_id
    and m.is_active = false
    and m.date <= (now() at time zone 'Europe/Budapest')::date
    and ub.rating > 0 and ub.rating <= 10;
$$;
revoke all on function public.get_meeting_rating(text) from public, anon;
grant execute on function public.get_meeting_rating(text) to authenticated;

-- Lock the meeting so simultaneous admin additions cannot overwrite one another.
-- jsonb_populate_record preserves the existing attendees column type (array or JSON).
create or replace function public.admin_add_meeting_attendee(p_meeting_id text, p_user_id text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  meeting_row public.meetings%rowtype;
  attendee_ids jsonb;
begin
  if not exists (select 1 from public.users where id = auth.uid() and is_admin = true) then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if not exists (select 1 from public.users where id::text = p_user_id) then
    raise exception 'Member does not exist';
  end if;
  select * into meeting_row from public.meetings where id::text = p_meeting_id for update;
  if not found then raise exception 'Meeting does not exist'; end if;
  attendee_ids := coalesce(nullif(to_jsonb(meeting_row.attendees), 'null'::jsonb), '[]'::jsonb);
  if not attendee_ids @> jsonb_build_array(p_user_id) then
    attendee_ids := attendee_ids || jsonb_build_array(p_user_id);
    update public.meetings
      set attendees = (jsonb_populate_record(null::public.meetings,
        jsonb_build_object('attendees', attendee_ids))).attendees
      where id = meeting_row.id;
  end if;
  return attendee_ids;
end;
$$;
revoke all on function public.admin_add_meeting_attendee(text, text) from public, anon;
grant execute on function public.admin_add_meeting_attendee(text, text) to authenticated;

commit;
