-- ─── Chief Engineer sign-offs ────────────────────────────────────────────
-- Human-in-the-loop verdict layer for the 4-agent workflow. Decoupled from
-- `sessions.status` (which is the operational lifecycle — ACTIVE, HALTED,
-- COMPLETED) so a session can be COMPLETED operationally and still carry an
-- audit-trail of human approvals / overrides on top.
--
-- Two artefacts:
--   1. `sessions.sign_off_status` — denormalised "latest verdict" for fast
--      reads / filtering (text, not an enum, so we can add new values
--      without DDL).
--   2. `sign_offs` — append-only audit table — one row per Chief Engineer
--      action. Replaces or re-approves can be inferred by ordering on
--      `signed_at`.

alter table public.sessions
  add column if not exists sign_off_status text;

create table if not exists public.sign_offs (
  sign_off_id    bigserial primary key,
  session_id     text not null references public.sessions(session_id),
  action         text not null check (action in ('APPROVED', 'OVERRIDDEN', 'PENDING_REVIEW')),
  signer_role    text not null default 'Chief Engineer',
  signer_name    text,                    -- optional: name of the human signer
  notes          text,                    -- optional: override reason
  evidence_hash  text,                    -- link to evidence_reports.report_hash
  signed_at      timestamptz default now()
);

create index if not exists sign_offs_session_idx
  on public.sign_offs (session_id);
create index if not exists sign_offs_signed_at_idx
  on public.sign_offs (signed_at desc);

comment on table public.sign_offs is
  'Append-only audit trail of Chief Engineer (or other authorised role) sign-off actions on bunkering sessions. The 4-agent AI workflow recommends; this table records what a human actually did.';
comment on column public.sessions.sign_off_status is
  'Denormalised latest sign-off verdict for fast filtering on Sessions / Dashboard views. Populated from sign_offs ORDER BY signed_at DESC LIMIT 1.';
