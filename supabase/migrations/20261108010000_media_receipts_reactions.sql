-- WHATSMORE v8: photos/videos/voice/documents, rich messages, replies, edits, deletes,
-- reactions and read receipts for live chats. Everything stays behind row-level security.

-- ---------- richer messages
alter table public.messages
  add column if not exists kind text not null default 'text',
  add column if not exists media_path text,
  add column if not exists media_name text,
  add column if not exists media_size bigint,
  add column if not exists media_mime text,
  add column if not exists duration integer,
  add column if not exists caption text,
  add column if not exists payload jsonb,
  add column if not exists reply_to uuid references public.messages (id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;
alter table public.messages alter column body drop not null;
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages drop constraint if exists messages_kind_check;
alter table public.messages add constraint messages_kind_check check (kind in ('text', 'image', 'video', 'voice', 'doc', 'rich', 'deleted'));
alter table public.messages drop constraint if exists messages_shape_check;
alter table public.messages add constraint messages_shape_check check (
  (kind = 'text' and body is not null and char_length(body) between 1 and 4000)
  or (kind in ('image', 'video', 'voice', 'doc') and media_path is not null)
  or (kind = 'rich' and payload is not null and pg_column_size(payload) < 8000)
  or (kind = 'deleted')
);
alter table public.messages drop constraint if exists messages_caption_check;
alter table public.messages add constraint messages_caption_check check (caption is null or char_length(caption) <= 1000);
-- Media must live in this conversation's folder of the chat-media bucket
alter table public.messages drop constraint if exists messages_media_path_check;
alter table public.messages add constraint messages_media_path_check check (media_path is null or split_part(media_path, '/', 1) = conversation_id::text);

-- New messages can only be created as fresh, unedited, undeleted messages
drop policy if exists "members send as themselves" on public.messages;
create policy "members send as themselves" on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and public.is_member(conversation_id) and kind <> 'deleted' and edited_at is null and deleted_at is null
              and (messages.reply_to is null or exists (select 1 from public.messages r where r.id = messages.reply_to and r.conversation_id = messages.conversation_id)));

-- Edit your own text message (within 15 minutes) and delete your own message for everyone
create or replace function public.edit_message(m uuid, new_body text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(coalesce(new_body, '')) not between 1 and 4000 then raise exception 'message must be 1-4000 characters'; end if;
  update public.messages set body = new_body, edited_at = now()
   where id = m and sender_id = auth.uid() and kind = 'text' and deleted_at is null and created_at > now() - interval '15 minutes';
  if not found then raise exception 'you can only edit your own text messages within 15 minutes'; end if;
end $$;

create or replace function public.delete_message(m uuid)
returns text language plpgsql security definer set search_path = public as $$
declare p text;
begin
  select media_path into p from public.messages where id = m and sender_id = auth.uid() and deleted_at is null;
  if not found then raise exception 'you can only delete your own messages'; end if;
  update public.messages set kind = 'deleted', body = null, caption = null, payload = null, media_path = null,
         media_name = null, media_size = null, media_mime = null, duration = null, deleted_at = now()
   where id = m;
  return p; -- the app removes the stored file at this path
end $$;

-- ---------- reactions: one per person per message; a removed reaction is emoji = null
create table if not exists public.reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  emoji text check (emoji is null or char_length(emoji) between 1 and 16),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index if not exists reactions_conv_idx on public.reactions (conversation_id);
alter table public.reactions enable row level security;
drop policy if exists "members see reactions" on public.reactions;
create policy "members see reactions" on public.reactions for select to authenticated using (public.is_member(conversation_id));

create or replace function public.set_reaction(m uuid, e text)
returns void language plpgsql security definer set search_path = public as $$
declare c uuid;
begin
  select conversation_id into c from public.messages where id = m and deleted_at is null;
  if c is null or not public.is_member(c) then raise exception 'message not found'; end if;
  insert into public.reactions (message_id, user_id, conversation_id, emoji, updated_at)
    values (m, auth.uid(), c, nullif(e, ''), now())
  on conflict (message_id, user_id) do update set emoji = excluded.emoji, updated_at = now();
end $$;

-- ---------- read receipts
alter table public.members add column if not exists last_read_at timestamptz;
create or replace function public.mark_read(c uuid)
returns void language sql security definer set search_path = public as $$
  update public.members set last_read_at = now() where conversation_id = c and user_id = auth.uid();
$$;

-- ---------- grants
revoke all on function public.edit_message(uuid, text), public.delete_message(uuid), public.set_reaction(uuid, text), public.mark_read(uuid) from public, anon;
grant execute on function public.edit_message(uuid, text), public.delete_message(uuid), public.set_reaction(uuid, text), public.mark_read(uuid) to authenticated;

-- ---------- media storage: private bucket, one folder per conversation, members only
insert into storage.buckets (id, name, public, file_size_limit)
values ('chat-media', 'chat-media', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create or replace function public.member_of_path(p text)
returns boolean language sql stable security definer set search_path = public as $$
  select case when split_part(p, '/', 1) ~ '^[0-9a-f-]{36}$' then public.is_member(split_part(p, '/', 1)::uuid) else false end;
$$;
grant execute on function public.member_of_path(text) to authenticated;

drop policy if exists "chat media: members read" on storage.objects;
create policy "chat media: members read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-media' and public.member_of_path(name));
drop policy if exists "chat media: members upload" on storage.objects;
create policy "chat media: members upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'chat-media' and public.member_of_path(name));
drop policy if exists "chat media: owners delete" on storage.objects;
create policy "chat media: owners delete" on storage.objects for delete to authenticated
  using (bucket_id = 'chat-media' and owner_id = auth.uid()::text);

-- ---------- realtime: edits/deletes (UPDATE), reactions and read receipts
do $$ begin
  begin alter publication supabase_realtime add table public.reactions; exception when duplicate_object then null; end;
end $$;
