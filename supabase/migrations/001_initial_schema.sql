-- ============================================================================
-- AI SaaS Chat - initial schema
-- Run this in the Supabase SQL editor (or via supabase CLI migrations).
--
-- Auth model: Clerk is the identity provider (Supabase third-party auth).
-- The authenticated Clerk user id is available as auth.jwt()->>'sub'.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Helper: current Clerk user id from the verified JWT
-- ----------------------------------------------------------------------------
create or replace function public.requesting_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->>'sub', '')
$$;

-- ----------------------------------------------------------------------------
-- conversations
-- ----------------------------------------------------------------------------
create table public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     text not null,
  title       text not null check (char_length(title) between 1 and 120),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index conversations_user_id_idx    on public.conversations (user_id);
create index conversations_updated_at_idx on public.conversations (updated_at desc);

-- keep updated_at fresh on every update
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger conversations_set_updated_at
  before update on public.conversations
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- messages
-- ----------------------------------------------------------------------------
create table public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  user_id          text not null,
  role             text not null check (role in ('user', 'assistant')),
  content          text,
  status           text not null check (status in ('pending', 'completed', 'error')),
  created_at       timestamptz not null default now()
);

create index messages_conversation_id_idx on public.messages (conversation_id);
create index messages_user_id_idx         on public.messages (user_id);
create index messages_created_at_idx      on public.messages (created_at);

-- ----------------------------------------------------------------------------
-- attachments
-- ----------------------------------------------------------------------------
create table public.attachments (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations (id) on delete cascade,
  message_id       uuid references public.messages (id) on delete set null,
  user_id          text not null,
  storage_path     text not null unique,
  file_name        text not null check (char_length(file_name) between 1 and 255),
  mime_type        text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes       bigint not null check (size_bytes > 0),
  created_at       timestamptz not null default now()
);

create index attachments_conversation_id_idx on public.attachments (conversation_id);
create index attachments_message_id_idx      on public.attachments (message_id);
create index attachments_user_id_idx         on public.attachments (user_id);

-- ----------------------------------------------------------------------------
-- usage_events (daily rate limiting + generation audit)
-- ----------------------------------------------------------------------------
create table public.usage_events (
  id               uuid primary key default gen_random_uuid(),
  user_id          text not null,
  event_type       text not null check (event_type in ('ai_message')),
  conversation_id  uuid references public.conversations (id) on delete set null,
  status           text not null default 'reserved'
                   check (status in ('reserved', 'completed', 'error')),
  created_at       timestamptz not null default now()
);

create index usage_events_user_day_idx on public.usage_events (user_id, created_at);

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;
alter table public.attachments   enable row level security;
alter table public.usage_events  enable row level security;

-- conversations: full CRUD on own rows only
create policy "conversations_select_own" on public.conversations
  for select to authenticated
  using (user_id = public.requesting_user_id());

create policy "conversations_insert_own" on public.conversations
  for insert to authenticated
  with check (user_id = public.requesting_user_id());

create policy "conversations_update_own" on public.conversations
  for update to authenticated
  using (user_id = public.requesting_user_id())
  with check (user_id = public.requesting_user_id());

create policy "conversations_delete_own" on public.conversations
  for delete to authenticated
  using (user_id = public.requesting_user_id());

-- messages: ownership verified via BOTH message.user_id and parent conversation
create policy "messages_select_own" on public.messages
  for select to authenticated
  using (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  );

create policy "messages_insert_own" on public.messages
  for insert to authenticated
  with check (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  );

create policy "messages_update_own" on public.messages
  for update to authenticated
  using (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  )
  with check (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  );

create policy "messages_delete_own" on public.messages
  for delete to authenticated
  using (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  );

-- attachments: own rows, and only inside conversations the user owns
create policy "attachments_select_own" on public.attachments
  for select to authenticated
  using (user_id = public.requesting_user_id());

create policy "attachments_insert_own" on public.attachments
  for insert to authenticated
  with check (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  );

create policy "attachments_update_own" on public.attachments
  for update to authenticated
  using (user_id = public.requesting_user_id())
  with check (
    user_id = public.requesting_user_id()
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and c.user_id = public.requesting_user_id()
    )
  );

create policy "attachments_delete_own" on public.attachments
  for delete to authenticated
  using (user_id = public.requesting_user_id());

-- usage_events: read-only for owners; writes happen ONLY through the
-- security-definer functions below (no insert/update/delete policies).
create policy "usage_events_select_own" on public.usage_events
  for select to authenticated
  using (user_id = public.requesting_user_id());

-- ----------------------------------------------------------------------------
-- Daily usage limit functions (atomic, race-safe)
--
-- Day boundary: UTC. A "day" is date_trunc('day', now() at UTC).
-- Failed generations still count as attempts (documented in README).
-- ----------------------------------------------------------------------------

-- Count today's (UTC) ai_message events for the calling user.
create or replace function public.get_daily_usage()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_user text := public.requesting_user_id();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  return (
    select count(*)::integer
    from public.usage_events
    where user_id = v_user
      and event_type = 'ai_message'
      and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc')
  );
end;
$$;

-- Atomically reserve one message from today's allowance.
-- Returns whether the request is allowed, the remaining allowance AFTER this
-- reservation, and the created usage event id (null when denied).
-- A per-user transaction-scoped advisory lock prevents race-condition bypasses.
create or replace function public.consume_daily_usage(p_limit integer, p_conversation_id uuid default null)
returns table (allowed boolean, remaining integer, event_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user  text := public.requesting_user_id();
  v_count integer;
  v_id    uuid;
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_limit is null or p_limit < 1 then
    raise exception 'invalid limit';
  end if;

  -- serialize concurrent requests from the same user
  perform pg_advisory_xact_lock(hashtext('daily_usage:' || v_user));

  select count(*) into v_count
  from public.usage_events
  where user_id = v_user
    and event_type = 'ai_message'
    and created_at >= (date_trunc('day', now() at time zone 'utc') at time zone 'utc');

  if v_count >= p_limit then
    return query select false, 0, null::uuid;
    return;
  end if;

  insert into public.usage_events (user_id, event_type, conversation_id, status)
  values (v_user, 'ai_message', p_conversation_id, 'reserved')
  returning id into v_id;

  return query select true, greatest(p_limit - v_count - 1, 0), v_id;
end;
$$;

-- Record the outcome of a generation on the caller's own usage event.
-- Note: changing status never refunds allowance (count includes all statuses),
-- so a client calling this directly cannot bypass the daily limit.
create or replace function public.finalize_usage_event(p_event_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user text := public.requesting_user_id();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;
  if p_status not in ('completed', 'error') then
    raise exception 'invalid status';
  end if;

  update public.usage_events
  set status = p_status
  where id = p_event_id
    and user_id = v_user;
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage: private bucket `chat-images`
-- Path convention: {clerkUserId}/{conversationId}/{randomUuid}.{ext}
-- The first path segment MUST equal the caller's Clerk user id.
--
-- If this insert fails due to permissions in your project, create the bucket
-- manually in Dashboard -> Storage -> New bucket -> name: chat-images,
-- Public: OFF, then re-run only the policy statements below.
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('chat-images', 'chat-images', false)
on conflict (id) do nothing;

create policy "chat_images_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = public.requesting_user_id()
  );

create policy "chat_images_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = public.requesting_user_id()
  );

create policy "chat_images_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = public.requesting_user_id()
  )
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = public.requesting_user_id()
  );

create policy "chat_images_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = public.requesting_user_id()
  );
