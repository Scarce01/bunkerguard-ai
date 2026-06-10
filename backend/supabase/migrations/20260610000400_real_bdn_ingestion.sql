create table if not exists bdn_documents (
  id uuid primary key default gen_random_uuid(),
  session_id text,
  filename text not null,
  content_type text not null,
  file_size_bytes bigint not null,
  s3_key text not null,
  file_sha256 text not null,
  status text not null default 'UPLOADED',
  current_stage text not null default 'UPLOADED',
  pipeline_status jsonb not null default '{}'::jsonb,
  extracted_data jsonb,
  parsing_confidence numeric(5,2),
  field_confidence jsonb,
  provider_metadata jsonb,
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists bunkering_sessions (
  session_id text primary key,
  bdn_document_id uuid references bdn_documents(id),
  normalized_session jsonb not null,
  surveyor_output jsonb,
  investigator_output jsonb,
  compliance_output jsonb,
  decision_output jsonb,
  evidence_s3_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists enrichment_results (
  id bigint generated always as identity primary key,
  session_id text not null,
  enrichment_type text not null,
  entity_name text,
  result_json jsonb not null,
  source text default 'exa',
  created_at timestamptz default now(),
  unique (session_id, enrichment_type)
);

create table if not exists supplier_intelligence (
  session_id text primary key,
  supplier_name text not null,
  company_profile jsonb,
  sanctions_check text,
  litigation_history jsonb,
  fraud_indicators boolean default false,
  negative_news jsonb,
  compliance_findings jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists vessel_intelligence (
  session_id text primary key,
  vessel_name text not null,
  imo_number text,
  vessel_history jsonb,
  ownership jsonb,
  previous_incidents jsonb,
  high_risk_patterns boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bdn_documents_session on bdn_documents(session_id);
create index if not exists idx_bdn_documents_created on bdn_documents(created_at desc);
create index if not exists idx_enrichment_results_session on enrichment_results(session_id);
