-- WHATSMORE v9: real stories (statuses) that disappear after 24 hours.
-- Audience: everyone (all signed-in users), contacts (people you share a chat with),
-- close (your close-friends list) or private (only you). Views are recorded per viewer.

create table if not exists public.statuses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('text', 'image', 'video', 'voice')),
  body text check (body is null or char_length(body) <= 700),
  bg text check (bg is null or bg ~ '^#[0-9a-fA-F]{3,8}$'),
  caption text check (caption is null or char_length(caption) <= 300),
  media_path text,
  duration integer,
  audience text not null default 'contacts' check (audience in ('everyone', 'contacts', 'close', 'private')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '24 hours',
  check (expires_at <= created_at + interval '24 hours 5 minutes'),
  check ((kind = 'text' and body is not null) or (kind <> 'text' and media_path is not null)),
  check (media_path is null or split_part(media_path, '/', 1) = user_id::text)
);
create index if not exists statuses_user_idx on public.statuses (user_id, expires_at);

create table if not exists public.close_friends (
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  primary key (owner_id, friend_id)
);

create table if not exists public.status_views (
  status_id uuid not null references public.statuses (id) on delete cascade,
  viewer_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (status_id, viewer_id)
);

-- Do two people share at least one conversation?
create or replace function public.shares_chat(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m1 join public.members m2 on m1.conversation_id = m2.conversation_id
                 where m1.user_id = a and m2.user_id = b);
$$;
create or replace function public.is_close_friend(owner uuid, friend uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.close_friends where owner_id = owner and friend_id = friend);
$$;
revoke all on function public.shares_chat(uuid, uuid), public.is_close_friend(uuid, uuid) from public, anon;
grant execute on function public.shares_chat(uuid, uuid), public.is_close_friend(uuid, uuid) to authenticated;

alter table public.statuses enable row level security;
alter table public.close_friends enable row level security;
alter table public.status_views enable row level security;

drop policy if exists "see allowed statuses" on public.statuses;
create policy "see allowed statuses" on public.statuses for select to authenticated using (
  user_id = auth.uid()
  or (expires_at > now() and (
        audience = 'everyone'
     or (audience = 'contacts' and public.shares_chat(user_id, auth.uid()))
     or (audience = 'close' and public.is_close_friend(user_id, auth.uid())))));
drop policy if exists "post own statuses" on public.statuses;
create policy "post own statuses" on public.statuses for insert to authenticated
  with check (user_id = auth.uid() and created_at > now() - interval '1 minute');
drop policy if exists "delete own statuses" on public.statuses;
create policy "delete own statuses" on public.statuses for delete to authenticated using (user_id = auth.uid());

drop policy if exists "manage own close friends" on public.close_friends;
create policy "manage own close friends" on public.close_friends for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- A view can only be recorded for a status you are allowed to see (the subquery obeys the policy above)
drop policy if exists "record own views" on public.status_views;
create policy "record own views" on public.status_views for insert to authenticated
  with check (viewer_id = auth.uid() and exists (select 1 from public.statuses s where s.id = status_id and s.user_id <> auth.uid()));
drop policy if exists "see views" on public.status_views;
create policy "see views" on public.status_views for select to authenticated
  using (viewer_id = auth.uid() or exists (select 1 from public.statuses s where s.id = status_id and s.user_id = auth.uid()));

-- ---------- media: private bucket, one folder per user; readable only alongside a visible status
insert into storage.buckets (id, name, public, file_size_limit)
values ('status-media', 'status-media', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "status media: upload own" on storage.objects;
create policy "status media: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'status-media' and split_part(name, '/', 1) = auth.uid()::text);
drop policy if exists "status media: read visible" on storage.objects;
create policy "status media: read visible" on storage.objects for select to authenticated
  using (bucket_id = 'status-media' and exists (select 1 from public.statuses s where s.media_path = storage.objects.name));
drop policy if exists "status media: delete own" on storage.objects;
create policy "status media: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'status-media' and owner_id = auth.uid()::text);

do $$ begin
  begin alter publication supabase_realtime add table public.statuses; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.status_views; exception when duplicate_object then null; end;
end $$;
