-- ─── Evidence Reports ────────────────────────────────────────────────────
-- One row per generated evidence package. The full report (header, risk
-- assessment, AI narrative, recommended actions, drafted Letter of Protest,
-- compliance flags, _usage telemetry) is stored as JSONB in `report_json`,
-- so the schema stays stable even as the Python service evolves its output
-- shape.
--
-- Written by: backend/llm/evidence_report_service.store_evidence_report()
-- Read by:    frontend/src/lib/useEvidenceReports.ts

create table if not exists public.evidence_reports (
  report_id          text        primary key,
  session_id         text        not null,
  generated_at       timestamptz not null,
  report_json        jsonb       not null,
  sign_off_status    text        not null,        -- REFUSE_TO_SIGN | SIGN | REVIEW | etc.
  report_hash        text,                        -- SHA-256 hex (0x-prefixed)
  signing_bundle_id  text,                        -- Ed25519 bundle id (optional)
  anchor_tx          text,                        -- Mock Ethereum tx hash (optional)
  created_at         timestamptz default now()
);

-- Sessions are queried by session_id frequently from the detail page.
create index if not exists evidence_reports_session_id_idx
  on public.evidence_reports (session_id);

-- For the global list view (latest first).
create index if not exists evidence_reports_generated_at_idx
  on public.evidence_reports (generated_at desc);

-- The Python runner uses upsert keyed on report_id, so re-generation
-- replaces an existing row in place.
comment on table public.evidence_reports is
  'Generated evidence packages for bunkering sessions. Each row is a signed, hash-chained report drafted by Claude over MFM + BDN + anomaly + risk data.';
