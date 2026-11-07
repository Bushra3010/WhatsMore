-- WHATSMORE: real accounts, unique @usernames, and live 1:1 / group text chats.
-- Every table has row-level security: people only ever see conversations they are a member of.

-- ---------- profiles (one per auth user, public within the app)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9._]{3,24}$'),
  name text not null check (char_length(name) between 1 and 40),
  about text not null default 'Hey there! I am using WHATSMORE.' check (char_length(about) <= 140),
  color text not null default '#1565d8',
  created_at timestamptz not null default now()
);

-- ---------- conversations, members, messages
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  name text check (name is null or char_length(name) between 1 and 60),
  emoji text not null default '👥',
  color text not null default '#1565d8',
  direct_key text unique,               -- "<smaller uuid>:<larger uuid>" so a pair has only one 1:1 chat
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.members (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists members_user_idx on public.members (user_id);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists messages_conv_time_idx on public.messages (conversation_id, created_at);

-- ---------- helpers (security definer so policies don't recurse through members)
create or replace function public.is_member(c uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members where conversation_id = c and user_id = auth.uid());
$$;

create or replace function public.username_available(u text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(u) ~ '^[a-z0-9._]{3,24}$' and not exists (select 1 from public.profiles where username = lower(u));
$$;

-- New auth user -> profile, from the name/username sent at sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, name, color)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 'WHATSMORE user'),
    coalesce(new.raw_user_meta_data ->> 'color', '#1565d8')
  );
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Find or create the 1:1 conversation with another user
create or replace function public.start_direct(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); k text; cid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
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

-- Create a group; the creator is its admin. No participant limit.
create or replace function public.create_group(p_name text, p_emoji text, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); cid uuid;
begin
  if me is null then raise exception 'not signed in'; end if;
  insert into public.conversations (kind, name, emoji, created_by)
    values ('group', trim(p_name), coalesce(nullif(p_emoji, ''), '👥'), me) returning id into cid;
  insert into public.members (conversation_id, user_id, role) values (cid, me, 'admin');
  insert into public.members (conversation_id, user_id)
    select cid, p.id from public.profiles p where p.id = any (p_members) and p.id <> me
    on conflict do nothing;
  return cid;
end $$;

-- Admins add more people to a group
create or replace function public.add_group_members(c uuid, p_members uuid[])
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if not exists (select 1 from public.members where conversation_id = c and user_id = auth.uid() and role = 'admin') then
    raise exception 'only group admins can add members';
  end if;
  insert into public.members (conversation_id, user_id)
    select c, p.id from public.profiles p where p.id = any (p_members)
    on conflict do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ---------- row-level security
alter table public.profiles enable row level security;
alter table public.conversations enable row level security;
alter table public.members enable row level security;
alter table public.messages enable row level security;

drop policy if exists "profiles readable by signed-in users" on public.profiles;
create policy "profiles readable by signed-in users" on public.profiles for select to authenticated using (true);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "members see their conversations" on public.conversations;
create policy "members see their conversations" on public.conversations for select to authenticated using (public.is_member(id));

drop policy if exists "members see fellow members" on public.members;
create policy "members see fellow members" on public.members for select to authenticated using (public.is_member(conversation_id));
drop policy if exists "leave a conversation" on public.members;
create policy "leave a conversation" on public.members for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members read messages" on public.messages;
create policy "members read messages" on public.messages for select to authenticated using (public.is_member(conversation_id));
drop policy if exists "members send as themselves" on public.messages;
create policy "members send as themselves" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id));

-- ---------- grants: functions are callable only where intended
revoke all on function public.start_direct(uuid), public.create_group(text, text, uuid[]), public.add_group_members(uuid, uuid[]), public.is_member(uuid) from public, anon;
grant execute on function public.start_direct(uuid), public.create_group(text, text, uuid[]), public.add_group_members(uuid, uuid[]), public.is_member(uuid) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;

-- ---------- realtime: new messages and new memberships are pushed live (RLS still applies)
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.members; exception when duplicate_object then null; end;
end $$;
