-- BunkerGuard Copilot Chat Persistence
-- Active chats live in app memory; on "New chat" they are flushed here.
-- One vessel session (SES-xxx) can have many chats over its lifetime.

create type copilot_chat_status as enum ('active', 'archived');
create type copilot_message_role as enum ('user', 'assistant', 'tool');

create table if not exists copilot_chats (
  chat_id            uuid primary key default gen_random_uuid(),
  vessel_session_id  text not null,
  title              text not null default 'New chat',
  status             copilot_chat_status not null default 'active',
  started_at         timestamptz not null default now(),
  archived_at        timestamptz,
  message_count      int not null default 0,
  total_tokens_in    int not null default 0,
  total_tokens_out   int not null default 0
);

create index if not exists ix_copilot_chats_session
  on copilot_chats (vessel_session_id, started_at desc);

create table if not exists copilot_messages (
  msg_id      bigserial primary key,
  chat_id     uuid not null references copilot_chats(chat_id) on delete cascade,
  turn_index  int not null,
  role        copilot_message_role not null,
  -- For role='user'/'assistant': {"text": "..."}
  -- For role='tool': {"name": "...", "args": {...}, "result": {...}}
  content     jsonb not null,
  -- Anthropic usage block for assistant turns; null otherwise.
  usage       jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists ix_copilot_messages_chat
  on copilot_messages (chat_id, turn_index);
