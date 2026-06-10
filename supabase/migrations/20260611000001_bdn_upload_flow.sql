-- BDN upload + un-bunked session flow.
--
-- Adds:
--   * 'PENDING' value to session_status_type (the "un-bunked" state: BDN
--     accepted, bunkering has not started ticking yet).
--   * bdn_uploads table — stores Claude's classification + extraction for
--     every uploaded document, including is_bdn=false rejections. The
--     frontend reads parsing_confidence / red_flags from here instead of
--     hardcoding 98%.
--   * sessions.parsing_confidence — surfaces the same value on the session
--     row so dashboards don't need a join.

-- ── Enum extension ───────────────────────────────────────────────────────────
-- ALTER TYPE … ADD VALUE is non-transactional in older Postgres; safe in
-- Supabase (PG 15+). IF NOT EXISTS makes the migration idempotent.
alter type session_status_type add value if not exists 'PENDING' before 'ACTIVE';

-- ── sessions: surface Claude parsing confidence ──────────────────────────────
alter table sessions
  add column if not exists parsing_confidence numeric(4,3),
  add column if not exists bdn_upload_id      text;

-- ── bdn_uploads: every Claude analysis, BDN or not ───────────────────────────
create table if not exists bdn_uploads (
  upload_id           text primary key,
  session_id          text references sessions(session_id),
  filename            text,
  mime_type           text,
  size_bytes          int,
  is_bdn              boolean not null,
  document_type       text,
  classification_confidence numeric(4,3),
  parsing_confidence  numeric(4,3),
  reasoning           text,
  red_flags           jsonb default '[]'::jsonb,
  extracted           jsonb default '{}'::jsonb,
  vessel_identified   boolean default false,
  supplier_identified boolean default false,
  quantity_extracted  boolean default false,
  fuel_grade_extracted boolean default false,
  tokens_input        int,
  tokens_output       int,
  model               text,
  uploaded_by         text,
  created_at          timestamptz default now()
);

create index if not exists idx_bdn_uploads_session on bdn_uploads(session_id);
create index if not exists idx_bdn_uploads_created on bdn_uploads(created_at desc);
