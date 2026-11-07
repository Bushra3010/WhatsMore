-- WHATSMORE v10: real admin panel (Command Center).
-- Admins are listed by user id. Everything an admin sees or changes goes through security-definer
-- functions that check is_admin() first, and every change is written to an audit log.
-- Ordinary users gain: reports that reach a real queue, verification requests, verified badges,
-- suspensions that block sending, and announcements.

-- ---------- admins
create table if not exists public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'moderator' check (role in ('owner', 'moderator')),
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
drop policy if exists "admins see themselves" on public.admins;
create policy "admins see themselves" on public.admins for select to authenticated using (user_id = auth.uid());

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid() and role = 'owner');
$$;

-- ---------- profile badges and suspensions
alter table public.profiles
  add column if not exists badge text check (badge is null or badge in ('verified', 'business', 'creator', 'official', 'government')),
  add column if not exists suspended_until timestamptz,
  add column if not exists suspend_reason text;
-- people can still edit their name/username/about, but not their own badge or suspension
create or replace function public.protect_profile_admin_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() and (new.badge is distinct from old.badge or new.suspended_until is distinct from old.suspended_until or new.suspend_reason is distinct from old.suspend_reason) then
    raise exception 'only admins can change badges or suspensions';
  end if;
  return new;
end $$;
drop trigger if exists protect_profile_admin_fields on public.profiles;
create trigger protect_profile_admin_fields before update on public.profiles for each row execute function public.protect_profile_admin_fields();

create or replace function public.is_suspended(u uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select suspended_until > now() from public.profiles where id = u), false);
$$;

-- suspended accounts can't send messages, post statuses or start chats
drop policy if exists "members send as themselves" on public.messages;
create policy "members send as themselves" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id) and not public.is_suspended(auth.uid())
              and kind <> 'deleted' and edited_at is null and deleted_at is null
              and (messages.reply_to is null or exists (select 1 from public.messages r where r.id = messages.reply_to and r.conversation_id = messages.conversation_id)));
drop policy if exists "post own statuses" on public.statuses;
create policy "post own statuses" on public.statuses for insert to authenticated
  with check (user_id = auth.uid() and created_at > now() - interval '1 minute' and not public.is_suspended(auth.uid()));

create or replace function public.guard_not_suspended()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if public.is_suspended(auth.uid()) then raise exception 'your account is suspended'; end if;
end $$;
-- start_direct / create_group refuse suspended accounts
create or replace function public.start_direct(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); k text; cid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  perform public.guard_not_suspended();
  if other = me then raise exception 'cannot chat with yourself'; end if;
  if not exists (select 1 from public.profiles where id = other) then raise exception 'user not found'; end if;
  k := least(me::text, other::text) || ':' || greatest(me::text, other::text);
  select id into cid from public.conversations where direct_key = k;
  if cid is null then
    insert into public.conversations (kind, direct_key, created_by) values ('direct', k, me) returning id into cid;
    insert into public.members (conversation_id, user_id, role) values (cid, me, 'member'), (cid, other, 'member');
  end if;
  return cid;
end $$;
create or replace function public.create_group(p_name text, p_emoji text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  perform public.guard_not_suspended();
  insert into public.conversations (kind, name, emoji, created_by)
    values ('group', trim(p_name), coalesce(nullif(p_emoji, ''), '👥'), me) returning id into cid;
  insert into public.members (conversation_id, user_id, role) values (cid, me, 'admin');
  insert into public.members (conversation_id, user_id)
    select cid, p.id from public.profiles p where p.id = any (p_members) and p.id <> me
    on conflict do nothing;
  return cid;
end $$;

-- ---------- reports from users
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  target_kind text not null check (target_kind in ('user', 'business', 'message', 'group', 'channel', 'status', 'scam')),
  target_user uuid references auth.users (id) on delete set null,
  target_message uuid references public.messages (id) on delete set null,
  target_conversation uuid references public.conversations (id) on delete set null,
  target_label text check (target_label is null or char_length(target_label) <= 120),
  category text not null check (category in ('Spam', 'Harassment', 'Fraud', 'Impersonation', 'Illegal content', 'Security concern', 'Other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  resolution text,
  resolved_by uuid references auth.users (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
alter table public.reports enable row level security;
drop policy if exists "file reports" on public.reports;
create policy "file reports" on public.reports for insert to authenticated with check (
  reporter_id = auth.uid() and status = 'open' and resolution is null and resolved_by is null
  -- you can only report a message or chat you can actually see
  and (target_message is null or exists (select 1 from public.messages m where m.id = target_message))
  and (target_conversation is null or public.is_member(target_conversation)));
drop policy if exists "see own reports" on public.reports;
create policy "see own reports" on public.reports for select to authenticated using (reporter_id = auth.uid());

-- ---------- verification requests
create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  badge text not null check (badge in ('verified', 'business', 'creator', 'official', 'government')),
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.verification_requests enable row level security;
drop policy if exists "request verification" on public.verification_requests;
create policy "request verification" on public.verification_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and decided_by is null
              and not exists (select 1 from public.verification_requests v where v.user_id = auth.uid() and v.status = 'pending'));
drop policy if exists "see own verification requests" on public.verification_requests;
create policy "see own verification requests" on public.verification_requests for select to authenticated using (user_id = auth.uid());

-- ---------- announcements (everyone signed in can read the active ones)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  body text not null check (char_length(body) between 1 and 600),
  level text not null default 'info' check (level in ('info', 'warning', 'critical')),
  active boolean not null default true,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
drop policy if exists "read active announcements" on public.announcements;
create policy "read active announcements" on public.announcements for select to authenticated using (active);

-- ---------- audit log
create table if not exists public.admin_audit (
  id bigserial primary key,
  admin_id uuid references auth.users (id) on delete set null,
  action text not null,
  target text,
  details jsonb,
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security; -- no policies: read only through admin functions
create or replace function public.audit(a text, t text, d jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.admin_audit (admin_id, action, target, details) values (auth.uid(), a, t, d);
$$;
revoke all on function public.audit(text, text, jsonb) from public, anon, authenticated;

-- ---------- admin functions (all check is_admin first)
create or replace function public.admin_guard()
returns void language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'admins only'; end if;
end $$;

create or replace function public.admin_me()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return (select jsonb_build_object('user_id', a.user_id, 'role', a.role, 'name', p.name, 'username', p.username)
            from public.admins a left join public.profiles p on p.id = a.user_id where a.user_id = auth.uid());
end $$;

create or replace function public.admin_stats()
returns jsonb language plpgsql security definer set search_path = public, storage as $$
declare r jsonb;
begin
  perform public.admin_guard();
  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'users_today', (select count(*) from auth.users where created_at > now() - interval '24 hours'),
    'users_7d', (select count(*) from auth.users where created_at > now() - interval '7 days'),
    'active_24h', (select count(distinct sender_id) from public.messages where created_at > now() - interval '24 hours'),
    'signed_in_24h', (select count(*) from auth.users where last_sign_in_at > now() - interval '24 hours'),
    'messages', (select count(*) from public.messages),
    'messages_today', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
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
    'daily', (select jsonb_agg(jsonb_build_object('day', d::date, 'signups', (select count(*) from auth.users u where u.created_at::date = d::date),
                                                   'messages', (select count(*) from public.messages m where m.created_at::date = d::date)) order by d)
              from generate_series((now() - interval '13 days')::date, now()::date, interval '1 day') d)
  ) into r;
  return r;
end $$;

create or replace function public.admin_users(q text default '', lim integer default 50, off integer default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select u.id, u.email, u.created_at, u.last_sign_in_at, p.username, p.name, p.about, p.badge, p.suspended_until, p.suspend_reason,
           (select count(*) from public.messages m where m.sender_id = u.id) as messages,
           (select count(*) from public.members mm where mm.user_id = u.id) as chats,
           (select count(*) from public.reports r where r.target_user = u.id and r.status = 'open') as open_reports,
           (select role from public.admins a where a.user_id = u.id) as admin_role
    from auth.users u left join public.profiles p on p.id = u.id
    where coalesce(q, '') = '' or p.username ilike '%' || q || '%' or p.name ilike '%' || q || '%' or u.email ilike '%' || q || '%'
    order by u.created_at desc limit least(greatest(lim, 1), 200) offset greatest(off, 0)) x), '[]'::jsonb);
end $$;

create or replace function public.admin_set_badge(u uuid, b text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update public.profiles set badge = nullif(b, '') where id = u;
  perform public.audit(case when nullif(b, '') is null then 'badge.remove' else 'badge.set' end, u::text, jsonb_build_object('badge', b));
end $$;

create or replace function public.admin_suspend(u uuid, days integer, reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  if exists (select 1 from public.admins where user_id = u) then raise exception 'admins cannot be suspended here'; end if;
  update public.profiles set suspended_until = case when days <= 0 then null else now() + make_interval(days => days) end,
                             suspend_reason = case when days <= 0 then null else left(reason, 300) end
   where id = u;
  perform public.audit(case when days <= 0 then 'user.unsuspend' else 'user.suspend' end, u::text, jsonb_build_object('days', days, 'reason', reason));
end $$;

create or replace function public.admin_delete_user(u uuid, reason text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.admin_guard();
  if not public.is_owner() then raise exception 'only the owner can delete accounts'; end if;
  if exists (select 1 from public.admins where user_id = u) then raise exception 'remove admin rights first'; end if;
  perform public.audit('user.delete', u::text, jsonb_build_object('email', (select email from auth.users where id = u), 'reason', reason));
  delete from auth.users where id = u;
end $$;

create or replace function public.admin_reports(st text default 'open')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select r.*, rp.username as reporter_username, tp.username as target_username, tp.name as target_name, tp.suspended_until as target_suspended_until,
           m.body as message_body, m.kind as message_kind, m.caption as message_caption, m.media_name as message_file, m.deleted_at as message_deleted_at,
           m.sender_id as message_sender, sp.username as message_sender_username
    from public.reports r
    left join public.profiles rp on rp.id = r.reporter_id
    left join public.profiles tp on tp.id = coalesce(r.target_user, (select sender_id from public.messages where id = r.target_message))
    left join public.messages m on m.id = r.target_message
    left join public.profiles sp on sp.id = m.sender_id
    where st = 'all' or r.status = st
    order by r.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_resolve_report(rid uuid, outcome text, note text, remove_message boolean default false, suspend_days integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare r public.reports; target uuid;
begin
  perform public.admin_guard();
  select * into r from public.reports where id = rid;
  if r.id is null then raise exception 'report not found'; end if;
  if outcome not in ('actioned', 'dismissed') then raise exception 'invalid outcome'; end if;
  if remove_message and r.target_message is not null then
    update public.messages set kind = 'deleted', body = null, caption = null, payload = null, media_path = null, media_name = null,
           media_size = null, media_mime = null, duration = null, deleted_at = now() where id = r.target_message;
    perform public.audit('message.remove', r.target_message::text, jsonb_build_object('report', rid));
  end if;
  target := coalesce(r.target_user, (select sender_id from public.messages where id = r.target_message));
  if suspend_days > 0 and target is not null and not exists (select 1 from public.admins where user_id = target) then
    update public.profiles set suspended_until = now() + make_interval(days => suspend_days), suspend_reason = left(coalesce(note, r.category), 300) where id = target;
    perform public.audit('user.suspend', target::text, jsonb_build_object('days', suspend_days, 'report', rid));
  end if;
  update public.reports set status = outcome, resolution = left(note, 500), resolved_by = auth.uid(), resolved_at = now() where id = rid;
  perform public.audit('report.' || outcome, rid::text, jsonb_build_object('note', note, 'removed_message', remove_message, 'suspend_days', suspend_days));
end $$;

create or replace function public.admin_verifications(st text default 'pending')
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select v.*, p.username, p.name, p.badge as current_badge from public.verification_requests v left join public.profiles p on p.id = v.user_id
    where st = 'all' or v.status = st order by v.created_at desc limit 200) x), '[]'::jsonb);
end $$;

create or replace function public.admin_decide_verification(vid uuid, approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v public.verification_requests;
begin
  perform public.admin_guard();
  select * into v from public.verification_requests where id = vid and status = 'pending';
  if v.id is null then raise exception 'request not found or already decided'; end if;
  update public.verification_requests set status = case when approve then 'approved' else 'rejected' end, decided_by = auth.uid(), decided_at = now() where id = vid;
  if approve then update public.profiles set badge = v.badge where id = v.user_id; end if;
  perform public.audit(case when approve then 'verification.approve' else 'verification.reject' end, v.user_id::text, jsonb_build_object('badge', v.badge));
end $$;

create or replace function public.admin_announce(t text, b text, lvl text)
returns uuid language plpgsql security definer set search_path = public as $$
declare aid uuid;
begin
  perform public.admin_guard();
  insert into public.announcements (title, body, level, created_by) values (t, b, coalesce(nullif(lvl, ''), 'info'), auth.uid()) returning id into aid;
  perform public.audit('announcement.publish', aid::text, jsonb_build_object('title', t, 'level', lvl));
  return aid;
end $$;
create or replace function public.admin_end_announcement(aid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  update public.announcements set active = false where id = aid;
  perform public.audit('announcement.end', aid::text, null);
end $$;
create or replace function public.admin_announcements()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(a) order by a.created_at desc) from (select * from public.announcements order by created_at desc limit 50) a), '[]'::jsonb);
end $$;

create or replace function public.admin_remove_status(sid uuid, reason text)
returns text language plpgsql security definer set search_path = public as $$
declare p text;
begin
  perform public.admin_guard();
  select media_path into p from public.statuses where id = sid;
  delete from public.statuses where id = sid;
  perform public.audit('status.remove', sid::text, jsonb_build_object('reason', reason));
  return p;
end $$;
create or replace function public.admin_recent_statuses()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select s.id, s.kind, s.body, s.caption, s.audience, s.created_at, s.expires_at, s.media_path, p.username, p.name
    from public.statuses s left join public.profiles p on p.id = s.user_id where s.expires_at > now() order by s.created_at desc limit 100) x), '[]'::jsonb);
end $$;

create or replace function public.admin_audit_log(lim integer default 100)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select a.id, a.action, a.target, a.details, a.created_at, p.username as admin_username,
           (select username from public.profiles where id::text = a.target) as target_username
    from public.admin_audit a left join public.profiles p on p.id = a.admin_id order by a.id desc limit least(lim, 500)) x), '[]'::jsonb);
end $$;

create or replace function public.admin_list_admins()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  return coalesce((select jsonb_agg(row_to_json(x)) from (
    select a.user_id, a.role, a.added_at, p.username, p.name, u.email from public.admins a
    left join public.profiles p on p.id = a.user_id left join auth.users u on u.id = a.user_id order by a.added_at) x), '[]'::jsonb);
end $$;
create or replace function public.admin_set_admin(u uuid, r text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public.admin_guard();
  if not public.is_owner() then raise exception 'only the owner can change admins'; end if;
  if u = auth.uid() then raise exception 'you cannot change your own admin role'; end if;
  if r is null or r = '' then delete from public.admins where user_id = u;
  elsif r in ('owner', 'moderator') then insert into public.admins (user_id, role) values (u, r) on conflict (user_id) do update set role = excluded.role;
  else raise exception 'invalid role'; end if;
  perform public.audit(case when coalesce(r, '') = '' then 'admin.remove' else 'admin.set' end, u::text, jsonb_build_object('role', r));
end $$;

-- grants: admin functions callable by signed-in users (they refuse non-admins); helpers locked down
revoke all on function public.is_admin(), public.is_owner(), public.is_suspended(uuid), public.guard_not_suspended(), public.admin_guard(),
  public.admin_me(), public.admin_stats(), public.admin_users(text, integer, integer), public.admin_set_badge(uuid, text), public.admin_suspend(uuid, integer, text),
  public.admin_delete_user(uuid, text), public.admin_reports(text), public.admin_resolve_report(uuid, text, text, boolean, integer),
  public.admin_verifications(text), public.admin_decide_verification(uuid, boolean), public.admin_announce(text, text, text),
  public.admin_end_announcement(uuid), public.admin_announcements(), public.admin_remove_status(uuid, text), public.admin_recent_statuses(),
  public.admin_audit_log(integer), public.admin_list_admins(), public.admin_set_admin(uuid, text) from public, anon;
grant execute on function public.is_admin(), public.is_owner(), public.is_suspended(uuid),
  public.admin_me(), public.admin_stats(), public.admin_users(text, integer, integer), public.admin_set_badge(uuid, text), public.admin_suspend(uuid, integer, text),
  public.admin_delete_user(uuid, text), public.admin_reports(text), public.admin_resolve_report(uuid, text, text, boolean, integer),
  public.admin_verifications(text), public.admin_decide_verification(uuid, boolean), public.admin_announce(text, text, text),
  public.admin_end_announcement(uuid), public.admin_announcements(), public.admin_remove_status(uuid, text), public.admin_recent_statuses(),
  public.admin_audit_log(integer), public.admin_list_admins(), public.admin_set_admin(uuid, text) to authenticated;
revoke all on function public.protect_profile_admin_fields() from public, anon, authenticated;
revoke all on function public.start_direct(uuid), public.create_group(text, text, uuid[]) from public, anon;
grant execute on function public.start_direct(uuid), public.create_group(text, text, uuid[]) to authenticated;

-- live announcements
do $$ begin
  begin alter publication supabase_realtime add table public.announcements; exception when duplicate_object then null; end;
end $$;
