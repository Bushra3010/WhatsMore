-- WHATSMORE v9: live polls, events, payment requests and shared contacts.
-- The message itself is a 'rich' message; what people do with it (vote, RSVP, pay, decline)
-- is one row per person per action, so everyone sees the same totals live.
-- Payments are demo money: the app moves amounts between demo wallets, no real money moves.

create table if not exists public.message_actions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  action text not null check (action in ('vote', 'rsvp', 'pay', 'decline')),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id, action)
);
create index if not exists message_actions_conv_idx on public.message_actions (conversation_id);
alter table public.message_actions enable row level security;
drop policy if exists "members see actions" on public.message_actions;
create policy "members see actions" on public.message_actions for select to authenticated using (public.is_member(conversation_id));

-- Record my vote / RSVP / payment / decline on a message in a chat I belong to
create or replace function public.set_action(m uuid, a text, v jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare msg record; t text;
begin
  select conversation_id, sender_id, kind, payload into msg from public.messages where id = m and deleted_at is null;
  if msg.conversation_id is null or not public.is_member(msg.conversation_id) then raise exception 'message not found'; end if;
  t := msg.payload ->> 'type';
  if msg.kind <> 'rich' then raise exception 'this message has no actions'; end if;
  if a = 'vote' then
    if t <> 'poll' or jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 12 then raise exception 'invalid vote'; end if;
  elsif a = 'rsvp' then
    if t <> 'event' or jsonb_typeof(v) <> 'boolean' then raise exception 'invalid rsvp'; end if;
  elsif a in ('pay', 'decline') then
    if t <> 'payment' or msg.payload ->> 'kind' <> 'request' then raise exception 'not a payment request'; end if;
    if msg.sender_id = auth.uid() then raise exception 'you cannot pay your own request'; end if;
    if exists (select 1 from public.message_actions where message_id = m and user_id = auth.uid() and action in ('pay', 'decline')) then raise exception 'already answered'; end if;
  else raise exception 'unknown action';
  end if;
  insert into public.message_actions (message_id, user_id, conversation_id, action, value, updated_at)
    values (m, auth.uid(), msg.conversation_id, a, v, now())
  on conflict (message_id, user_id, action) do update set value = excluded.value, updated_at = now();
end $$;
revoke all on function public.set_action(uuid, text, jsonb) from public, anon;
grant execute on function public.set_action(uuid, text, jsonb) to authenticated;

do $$ begin
  begin alter publication supabase_realtime add table public.message_actions; exception when duplicate_object then null; end;
end $$;
