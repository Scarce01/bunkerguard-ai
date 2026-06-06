-- BunkerGuard Supabase Schema
-- Tables mirror the MockDataset v3 structure + pipeline output shape.
-- Run this in the Supabase SQL Editor (Project → SQL Editor → New query).

-- ============================================================
-- ENUMS
-- ============================================================

create type verdict_type as enum (
  'SIGN', 'SIGN_WITH_NOTES', 'SIGN_WITH_LOP', 'REFUSE_TO_SIGN', 'PENDING', 'INSUFFICIENT_DATA'
);

create type risk_category_type as enum (
  'LOW', 'MODERATE', 'HIGH', 'CRITICAL', 'INSUFFICIENT_DATA'
);

create type session_status_type as enum (
  'COMPLETED', 'ACTIVE', 'HALTED'
);

create type severity_type as enum (
  'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
);

create type ebdn_status_type as enum (
  'VERIFIED', 'MISMATCH', 'NOT_FOUND', 'PENDING'
);

create type supplier_flag_type as enum (
  'CLEAR', 'MONITORING', 'FLAGGED', 'NOT_REGISTERED'
);

-- ============================================================
-- SUPPLIERS
-- ============================================================

create table suppliers (
  id              text primary key,
  name            text not null,
  mpa_licence     text,
  licence_expiry  date,
  contact_name    text,
  email           text,
  phone           text,
  total_sessions  int  default 0,
  mismatch_count  int  default 0,
  avg_dev_pct     numeric(6,4) default 0,
  critical_count  int  default 0,
  lop_count       int  default 0,
  reputation_score int,
  trend           text,
  flag            supplier_flag_type default 'CLEAR',
  notes           text,
  created_at      timestamptz default now()
);

-- ============================================================
-- SESSIONS
-- ============================================================

create table sessions (
  session_id      text primary key,
  vessel_name     text not null,
  vessel_imo      text not null,
  barge_name      text,
  barge_imo       text,
  supplier_id     text references suppliers(id),
  supplier_name   text,
  mpa_licence     text,
  port            text,
  fuel_grade      text,
  bdn_qty_mt      numeric(10,3),
  mfm_qty_mt      numeric(10,3),
  dev_mt          numeric(10,3),
  dev_pct         numeric(8,4),
  delivery_date   date,
  start_time      time,
  end_time        time,
  duration_h      numeric(6,2),
  risk_score      int,
  risk_category   risk_category_type,
  verdict         verdict_type,
  lop_issued      boolean default false,
  blockchain_tx   text,
  status          session_status_type default 'ACTIVE',
  notes           text,
  evidence_sha256 text,
  data_quality_pct int default 100,
  meter_serial    text,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- BDN RECORDS
-- ============================================================

create table bdn_records (
  bdn_ref           text primary key,
  session_id        text references sessions(session_id),
  vessel_name       text,
  vessel_imo        text,
  supplier_name     text,
  mpa_licence       text,
  barge_name        text,
  barge_imo         text,
  port              text,
  delivery_date     date,
  start_time        time,
  end_time          time,
  fuel_grade        text,
  sulphur_pct       numeric(6,4),
  density_15c       numeric(8,2),
  viscosity_50c     numeric(8,2),
  flash_point_c     numeric(6,1),
  qty_mt            numeric(10,3),
  sample_seal       text,
  supp_signed       boolean default false,
  officer_signed    boolean default false,
  biofuel_pct       numeric(6,4) default 0,
  ebdn_status       ebdn_status_type default 'PENDING',
  ebdn_qr_sha256    text,
  created_at        timestamptz default now()
);

-- ============================================================
-- ANOMALIES
-- ============================================================

create table anomalies (
  anomaly_id      text primary key,
  session_id      text references sessions(session_id),
  rule            text not null,
  rule_name       text,
  severity        severity_type not null,
  triggered_at    timestamptz,
  source_a        text,
  source_b        text,
  dev_value       numeric(12,4),
  dev_pct         numeric(8,4),
  unit            text,
  description     text,
  acknowledged    boolean default false,
  resolved        boolean default false,
  created_at      timestamptz default now()
);

-- ============================================================
-- RISK SCORES
-- ============================================================

create table risk_scores (
  session_id              text primary key references sessions(session_id),
  anomaly_severity_0_100  int,
  supplier_history_0_100  int,
  doc_completeness_0_100  int,
  dev_severity_0_100      int,
  anomaly_score           numeric(6,2),
  supplier_score          numeric(6,2),
  doc_score               numeric(6,2),
  dev_score               numeric(6,2),
  final_risk_score        int,
  risk_category           risk_category_type,
  verdict                 verdict_type,
  estimated_impact_usd    numeric(12,2),
  similar_sessions_30d    int default 0,
  created_at              timestamptz default now()
);

-- ============================================================
-- MFM STREAM
-- ============================================================

create table mfm_stream (
  id              bigint generated always as identity primary key,
  session_id      text references sessions(session_id),
  seq_no          int not null,
  recorded_at     timestamptz not null,
  flow_rate_mt_h  numeric(10,3),
  cumulative_mt   numeric(10,3),
  density_op      numeric(8,2),
  density_15c     numeric(8,2),
  temp_c          numeric(6,2),
  drive_gain_pct  numeric(6,2),
  tube_freq_hz    numeric(8,3),
  direction       text,
  status_code     int default 0,
  meter_serial    text,
  expected_mt     numeric(10,3),
  deviation_pct   numeric(8,4),
  packet_sha256   text,
  created_at      timestamptz default now(),
  unique (session_id, seq_no)
);

-- ============================================================
-- HISTORICAL TRANSACTIONS
-- ============================================================

create table historical_transactions (
  id              bigint generated always as identity primary key,
  session_id      text,
  supplier_id     text references suppliers(id),
  supplier_name   text,
  vessel_imo      text,
  vessel_name     text,
  delivery_date   date,
  bdn_qty_mt      numeric(10,3),
  mfm_qty_mt      numeric(10,3),
  discrepancy_mt  numeric(10,3),
  discrepancy_pct numeric(8,4),
  risk_score      int,
  verdict         verdict_type,
  lop_issued      boolean default false,
  anomaly_codes   text[],
  blockchain_tx   text,
  created_at      timestamptz default now()
);

-- ============================================================
-- ANCHORAGE GEOFENCES
-- ============================================================

create table anchorage_geofences (
  id              bigint generated always as identity primary key,
  anchorage_name  text not null,
  latitude_n      numeric(10,7),
  longitude_e     numeric(10,7),
  vtis_sector     text,
  geofence_radius_m int default 2000,
  verification_status text,
  created_at      timestamptz default now()
);

-- ============================================================
-- FUEL PARAMETERS
-- ============================================================

create table fuel_parameters (
  grade                   text primary key,
  category                text,
  max_density_kg_m3       numeric(8,2),
  max_viscosity_50c_cst   numeric(8,2),
  max_sulphur_pct         numeric(6,4),
  min_flash_point_c       numeric(6,1),
  marpol_applicable       boolean default true,
  created_at              timestamptz default now()
);

-- ============================================================
-- FUEL PRICES
-- ============================================================

create table fuel_prices (
  id              bigint generated always as identity primary key,
  grade           text not null,
  price_usd_per_mt numeric(10,2),
  source          text,
  update_frequency text,
  verification_status text,
  recorded_at     timestamptz default now()
);

-- ============================================================
-- LLM OUTPUTS  (Stage 4 / 5 / 6)
-- ============================================================

create table llm_outputs (
  id              bigint generated always as identity primary key,
  session_id      text references sessions(session_id),
  stage           int not null,
  model           text default 'claude-sonnet-4-6',
  prompt_tokens   int,
  output_tokens   int,
  payload         jsonb,
  created_at      timestamptz default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_sessions_supplier      on sessions(supplier_id);
create index idx_sessions_date          on sessions(delivery_date);
create index idx_sessions_vessel_imo    on sessions(vessel_imo);
create index idx_sessions_verdict       on sessions(verdict);
create index idx_anomalies_session      on anomalies(session_id);
create index idx_anomalies_severity     on anomalies(severity);
create index idx_mfm_session_seq        on mfm_stream(session_id, seq_no);
create index idx_history_supplier       on historical_transactions(supplier_id);
create index idx_llm_outputs_session    on llm_outputs(session_id, stage);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger sessions_updated_at
  before update on sessions
  for each row execute function set_updated_at();
