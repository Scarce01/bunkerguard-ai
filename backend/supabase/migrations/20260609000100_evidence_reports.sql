-- Persist generated evidence reports alongside their S3 evidence bundle.

create table if not exists public.evidence_reports (
  report_id          text primary key,
  session_id         text not null references public.sessions(session_id) on delete cascade,
  generated_at       timestamptz not null,
  report_json        jsonb not null,
  sign_off_status    text not null,
  report_hash        text,
  signing_bundle_id  text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_evidence_reports_session_generated
  on public.evidence_reports(session_id, generated_at desc);

alter table public.evidence_reports enable row level security;

drop policy if exists "Authenticated users can read evidence reports"
  on public.evidence_reports;
create policy "Authenticated users can read evidence reports"
  on public.evidence_reports
  for select
  to authenticated
  using (true);

drop trigger if exists evidence_reports_updated_at on public.evidence_reports;
create trigger evidence_reports_updated_at
  before update on public.evidence_reports
  for each row execute function public.set_updated_at();
