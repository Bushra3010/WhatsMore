-- WHATSMORE v10 fixes found in testing:
-- 1. Suspension date and reason were readable by every signed-in user. Ordinary users now see only
--    public profile columns; each person reads their own moderation status through my_moderation().
-- 2. Daily charts grouped days in UTC, so an admin in India saw today's activity on yesterday's date.
--    admin_stats now takes the admin's time zone.

revoke select on public.profiles from anon, authenticated;
grant select (id, username, name, about, color, badge, created_at) on public.profiles to authenticated;

create or replace function public.my_moderation()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('badge', badge, 'suspended_until', suspended_until, 'suspend_reason', suspend_reason)
    from public.profiles where id = auth.uid();
$$;
revoke all on function public.my_moderation() from public, anon;
grant execute on function public.my_moderation() to authenticated;

drop function if exists public.admin_stats();
create or replace function public.admin_stats(tz text default 'UTC')
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare r jsonb; z text := case when exists (select 1 from pg_timezone_names where name = tz) then tz else 'UTC' end;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'tz', z,
    'users', (select count(*) from auth.users),
    'users_today', (select count(*) from auth.users where (created_at at time zone z)::date = (now() at time zone z)::date),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_24h', (select count(distinct sender_id) from public.messages where created_at > now() - interval '24 hours'),
    'signed_in_24h', (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'messages', (select count(*) from public.messages),
    'messages_today', (select count(*) from public.messages where (created_at at time zone z)::date = (now() at time zone z)::date),
    'direct_chats', (select count(*) from public.conversations where kind = 'direct'),
    'groups', (select count(*) from public.conversations where kind = 'group'),
    'statuses_live', (select count(*) from public.statuses where expires_at > now()),
    'reactions', (select count(*) from public.reactions where emoji is not null),
    'reports_open', (select count(*) from public.reports where status = 'open'),
    'verifications_pending', (select count(*) from public.verification_requests where status = 'pending'),
    'suspended', (select count(*) from public.profiles where suspended_until > now()),
    'verified', (select count(*) from public.profiles where badge is not null),
    'files', (select count(*) from storage.objects where bucket_id in ('chat-media', 'status-media')),
    'storage_bytes', (select coalesce(sum((metadata ->> 'size')::bigint), 0) from storage.objects where bucket_id in ('chat-media', 'status-media')),
    'by_kind', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb) from (select kind, count(*) n from public.messages group by kind) k),
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date,
                'signups', (select count(*) from auth.users u where (u.created_at at time zone z)::date = d::date),
                'messages', (select count(*) from public.messages m where (m.created_at at time zone z)::date = d::date)) order by d)
              from generate_series((now() at time zone z)::date - 13, (now() at time zone z)::date, interval '1 day') d)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_stats(text) from public, anon;
grant execute on function public.admin_stats(text) to authenticated;

-- 3. Audit entries keep the target's @username as it was at the time, so history stays readable
--    after an account is deleted.
create or replace function public.audit(a text, t text, d jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit (admin_id, action, target, details)
  values (auth.uid(), a, t, coalesce(d, '{}'::jsonb) || coalesce((select jsonb_build_object('who', '@' || username) from public.profiles where id::text = t), '{}'::jsonb));
$$;
revoke all on function public.audit(text, text, jsonb) from public, anon, authenticated;
