-- ─── Bunker-vessel real-time status ──────────────────────────────────────
-- Distinct from `sessions`. A `session` is the audit trail of a single
-- delivery (BDN, MFM, anomalies, risk score, verdict). A `vessel_status`
-- row is what the vessel is doing *right now*: where it's berthed, what
-- cargo it's carrying, what state it's in (IDLE/LOADING/STANDBY/EN_ROUTE/
-- DELIVERING/MAINTENANCE), and what delivery it's preparing for next.
--
-- The 3D vessel HUD in Terminal3DViewer reads this when the user zooms
-- in on a bunker barge that is sitting at port — instead of guessing
-- by re-using session fields that only make sense mid-delivery.

create table if not exists public.vessel_status (
  vessel_id           text primary key,        -- V01, V02, V03 …
  vessel_name         text not null,
  vessel_imo          text,
  current_status      text not null
    check (current_status in ('IDLE','LOADING','STANDBY','EN_ROUTE','DELIVERING','MAINTENANCE')),
  current_terminal_id text,                    -- T07, T05, etc. (NULL if at anchor)
  berth_label         text,                    -- 'Jetty 1', 'Berth 4', etc.
  cargo_grade         text,                    -- 'VLSFO 380 cSt'
  cargo_loaded_mt     numeric,                 -- 480 (current onboard)
  cargo_capacity_mt   numeric,                 -- 1200 (tank capacity)
  loading_rate_m3h    numeric,                 -- 240 (only meaningful when LOADING)
  etd_local           text,                    -- '14:30 SGT' (next departure ETA)
  next_session_id     text,                    -- 'SES-2026-001' — upcoming delivery this vessel is committed to
  next_customer       text,                    -- 'MAERSK HONAM' (denormalised for fast HUD render)
  last_session_id     text,                    -- last completed delivery
  crew_verified       boolean default true,
  mpa_tag_verified    boolean default true,
  recommended_action  text,                    -- 'Standard end-of-pump check'
  last_event          text,                    -- 'A02 density sample within spec'
  updated_at          timestamptz default now()
);

create index if not exists vessel_status_terminal_idx on public.vessel_status (current_terminal_id);
create index if not exists vessel_status_status_idx   on public.vessel_status (current_status);

comment on table public.vessel_status is
  'Per-vessel current operational state. Driven by AIS + IoT + terminal-side telemetry. Separate from `sessions` which is the per-delivery audit record.';

-- ─── Seed data — the three Stolthaven T07 bunker barges ───────────────────
insert into public.vessel_status
  (vessel_id, vessel_name, vessel_imo, current_status, current_terminal_id, berth_label,
   cargo_grade, cargo_loaded_mt, cargo_capacity_mt, loading_rate_m3h, etd_local,
   next_session_id, next_customer, crew_verified, mpa_tag_verified,
   recommended_action, last_event)
values
  ('V01', 'BUNKER KING I',   '9876511', 'LOADING',  'T07', 'Jetty 1',
   'VLSFO 380 cSt', 480, 1200, 240, '14:30 SGT',
   'SES-2026-001', 'MAERSK HONAM',  true, true,
   'Standard end-of-pump check', 'A02 density sample within spec'),
  ('V02', 'BUNKER KING II',  '9876522', 'IDLE',     'T07', 'Berth 4',
   'MGO DMA', 220, 1000, null, null,
   null, null, true, true,
   'Awaiting next nomination', 'Cargo discharged 02:14 SGT'),
  ('V03', 'BUNKER KING III', '9876533', 'EN_ROUTE', 'T07', 'Departing',
   'HSFO 380 cSt', 640, 1500, null, '12:15 SGT',
   'SES-2026-016', 'EVER GIVEN',    true, true,
   'Tug coordination in progress', 'Transit to berth 6 · +35 min drift')
on conflict (vessel_id) do update set
  current_status      = excluded.current_status,
  current_terminal_id = excluded.current_terminal_id,
  berth_label         = excluded.berth_label,
  cargo_grade         = excluded.cargo_grade,
  cargo_loaded_mt     = excluded.cargo_loaded_mt,
  cargo_capacity_mt   = excluded.cargo_capacity_mt,
  loading_rate_m3h    = excluded.loading_rate_m3h,
  etd_local           = excluded.etd_local,
  next_session_id     = excluded.next_session_id,
  next_customer       = excluded.next_customer,
  recommended_action  = excluded.recommended_action,
  last_event          = excluded.last_event,
  updated_at          = now();
