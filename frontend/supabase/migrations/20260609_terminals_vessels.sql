-- ───────────────────────────────────────────────────────────────────────────
-- Terminals + Vessels schema for BunkerGuard FE
-- Run this once in Supabase Studio → SQL editor for project jdnzznxwdczcktfqwxmj.
--
-- Mirrors the existing TerminalInfo / VesselSpot TypeScript types in
-- src/data/terminals.ts. Once present, the FE can drop its hard-coded
-- TERMINALS array + VESSELS_BY_TERMINAL dict and read from these tables.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Terminal status enum mirrors the FE's TerminalStatus union.
do $$
begin
  if not exists (select 1 from pg_type where typname = 'terminal_status') then
    create type public.terminal_status as enum
      ('online', 'degraded', 'offline', 'unavailable');
  end if;
end
$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'vessel_status') then
    create type public.vessel_status as enum
      ('loading', 'idle', 'transit', 'maintenance');
  end if;
end
$$;

-- 2) Terminals table.
create table if not exists public.terminals (
  id                   text primary key,                  -- "T01" .. "T10"
  name                 text not null,
  operator             text not null,
  location             text not null,
  lat                  numeric(9,6) not null,
  lng                  numeric(9,6) not null,
  status               public.terminal_status not null default 'online',

  -- Model + bbox (from the source .blend export)
  glb_path             text,                              -- e.g. /models/Terminal_07_Stolthaven.glb
  bbox_x_m             numeric(8,2) not null,
  bbox_y_m             numeric(8,2) not null,            -- height
  bbox_z_m             numeric(8,2) not null,
  center_x_m           numeric(8,2) not null default 0,
  center_y_m           numeric(8,2) not null default 0,
  center_z_m           numeric(8,2) not null default 0,
  mesh_count           integer not null default 0,

  -- Camera framing override (default 0.38 lives in FE code; set per-terminal here when needed)
  frame_ratio          numeric(4,3),

  -- Display-only metadata
  throughput           text,                              -- e.g. "7.1 MT/yr"
  vessels_berthed      integer not null default 0,

  created_at           timestamp with time zone not null default now(),
  updated_at           timestamp with time zone not null default now()
);

create index if not exists terminals_status_idx on public.terminals (status);

-- 3) Vessels table.
create table if not exists public.vessels (
  id                   text primary key,                  -- "T07:V01" or similar; FE used "V01" scoped to a terminal
  terminal_id          text not null
                         references public.terminals(id) on delete cascade,
  name                 text not null,                     -- e.g. "BUNKER KING I"
  imo                  text unique,                       -- IMO number when known

  -- Scene-local placement in the terminal's 3D viewer (meters, Y-up)
  pos_x                numeric(8,2) not null,
  pos_y                numeric(8,2) not null default 0,
  pos_z                numeric(8,2) not null,
  rot_y_deg            numeric(6,2) not null default 0,
  scale                numeric(5,3) not null default 0.6,

  status               public.vessel_status not null default 'idle',
  cargo                text,                              -- "VLSFO 380 cSt · 480 MT"

  -- For visual tinting, NULL = use GLB baked materials (current default)
  hull_tint            text,

  created_at           timestamp with time zone not null default now(),
  updated_at           timestamp with time zone not null default now()
);

create index if not exists vessels_terminal_id_idx on public.vessels (terminal_id);
create index if not exists vessels_status_idx       on public.vessels (status);

-- 4) Optional: link sessions.vessel_imo back to vessels.imo for joins later.
-- (We don't add the FK yet because sessions.vessel_imo currently has values
--  that aren't in the vessels table; uncomment once aligned.)
-- alter table public.sessions
--   add constraint sessions_vessel_imo_fkey
--   foreign key (vessel_imo) references public.vessels (imo);

-- ───────────────────────────────────────────────────────────────────────────
-- Seed data
-- ───────────────────────────────────────────────────────────────────────────

insert into public.terminals
  (id, name, operator, location, lat, lng, status, glb_path,
   bbox_x_m, bbox_y_m, bbox_z_m,
   center_x_m, center_y_m, center_z_m,
   mesh_count, frame_ratio, throughput, vessels_berthed)
values
  ('T01', 'Jurong Port Universal Terminal',     'JPUT',       'Jurong Port',     1.3155, 103.7100, 'online',
   '/models/Terminal_01_JPUT.glb',              1833.3, 26.5, 1833.3, 0, 9.3, 0, 4847, NULL, '12.4 MT/yr', 4),
  ('T02', 'Jurong Petrochemical Tank Terminal', 'JPTT',       'Jurong Island',   1.2705, 103.6925, 'online',
   '/models/Terminal_02_JPTT.glb',               800.0, 27.5,  800.0, 0, 7.8, 0, 2373, NULL,  '6.8 MT/yr', 2),
  ('T03', 'Vopak Banyan Terminal',              'Vopak',      'Banyan Basin',    1.2570, 103.7035, 'online',
   '/models/Terminal_03_Vopak_Banyan.glb',      1000.0, 26.5, 1000.0, 0, 7.3, 0, 3212, NULL,  '9.1 MT/yr', 3),
  ('T04', 'Horizon Banyan Terminal',            'Horizon',    'Banyan Basin',    1.2598, 103.7090, 'degraded',
   '/models/Terminal_04_Horizon_Banyan.glb',     800.0, 25.5,  800.0, 0, 6.8, 0, 2268, NULL,  '5.4 MT/yr', 1),
  ('T05', 'Shell Bukom Refinery Terminal',      'Shell',      'Pulau Bukom',     1.2378, 103.7720, 'online',
   '/models/Terminal_05_Shell_Bukom.glb',       2750.0, 33.6, 2750.0, 0,12.8, 0, 7218, NULL, '23.7 MT/yr', 6),
  ('T06', 'Tankstore Busing Terminal',          'Tankstore',  'Pulau Busing',    1.2178, 103.7461, 'online',
   '/models/Terminal_06_Tankstore_Busing.glb',  2291.7, 26.2, 2291.7, 0, 9.1, 0, 5672, NULL, '14.2 MT/yr', 4),
  ('T07', 'Stolthaven Terminal',                'Stolthaven', 'Jurong Island',   1.2672, 103.6730, 'online',
   '/models/Terminal_07_Stolthaven.glb',         733.3, 42.1,  733.3, 0,15.0, 0, 4903, 0.55,  '7.1 MT/yr', 2),
  ('T08', 'SPC Sebarok Terminal',               'SPC',        'Pulau Sebarok',   1.2046, 103.8070, 'online',
   '/models/Terminal_08_SPC_Sebarok.glb',        600.0, 23.5,  600.0, 0, 5.8, 0,  947, NULL,  '3.2 MT/yr', 1),
  ('T09', 'Vopak Sebarok Terminal',             'Vopak',      'Pulau Sebarok',   1.2030, 103.7995, 'online',
   '/models/Terminal_09_Vopak_Sebarok.glb',      900.0, 25.5,  900.0, 0, 6.8, 0, 3938, NULL, '10.6 MT/yr', 3),
  ('T10', 'Vopak Penjuru Terminal',             'Vopak',      'Penjuru, Jurong', 1.3097, 103.7275, 'online',
   '/models/Terminal_10_Vopak_Penjuru.glb',      800.0, 24.5,  800.0, 0, 6.3, 0, 1907, NULL,  '4.9 MT/yr', 2)
on conflict (id) do update set
  name             = excluded.name,
  operator         = excluded.operator,
  location         = excluded.location,
  lat              = excluded.lat,
  lng              = excluded.lng,
  status           = excluded.status,
  glb_path         = excluded.glb_path,
  bbox_x_m         = excluded.bbox_x_m,
  bbox_y_m         = excluded.bbox_y_m,
  bbox_z_m         = excluded.bbox_z_m,
  center_x_m       = excluded.center_x_m,
  center_y_m       = excluded.center_y_m,
  center_z_m       = excluded.center_z_m,
  mesh_count       = excluded.mesh_count,
  frame_ratio      = excluded.frame_ratio,
  throughput       = excluded.throughput,
  vessels_berthed  = excluded.vessels_berthed,
  updated_at       = now();

-- T07 berthed vessels — V01 and V02 share the middle jetty, V03 alone at the right.
insert into public.vessels
  (id, terminal_id, name, pos_x, pos_y, pos_z, rot_y_deg, scale, status, cargo)
values
  ('T07:V01', 'T07', 'BUNKER KING I',   -25, 3, 70, 270, 0.6, 'loading', 'VLSFO 380 cSt · 480 MT'),
  ('T07:V02', 'T07', 'BUNKER KING II',   85, 3, 70, 270, 0.6, 'idle',    'MGO DMA · 220 MT'),
  ('T07:V03', 'T07', 'BUNKER KING III', 200, 3, 70, 270, 0.6, 'transit', 'HSFO 380 cSt · 640 MT')
on conflict (id) do update set
  pos_x      = excluded.pos_x,
  pos_y      = excluded.pos_y,
  pos_z      = excluded.pos_z,
  rot_y_deg  = excluded.rot_y_deg,
  scale      = excluded.scale,
  status     = excluded.status,
  cargo      = excluded.cargo,
  updated_at = now();
