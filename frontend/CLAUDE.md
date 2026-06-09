# BunkerGuard FE — Working Notes

Maritime fraud-intelligence dashboard for Singapore bunkering operations.
Built in React 18 + Vite + Three.js (R3F + drei) + MapLibre + Supabase.

## Where things live

- **Project root**: `D:\next-bunker-fe` (moved from C:\Users\xuziy\Downloads\Marine bunkering fe after C: hit 100% disk full)
- **Run from**: `D:\next bunker` cwd. Dev server is the preview-tool `marine-bunkering-fe` (port 5173). Vite reads `D:/next-bunker-fe/package.json` via `--prefix` in `D:/next bunker/.claude/launch.json`.
- **Blender source models**: `D:/SG_Terminals/Terminal_*.blend` + `D:/bunkering_vessel_complete.blend`.
- **Terminal GLB exports**: `D:/next-bunker-fe/public/models/Terminal_*.glb` (T01-T06, T08-T10) — these are baked at full fidelity (3-32 MB each).
- **T07 + vessel GLB exports**: `D:/bunker_t7/Terminal_07_Stolthaven.glb` + `D:/bunker_t7/bunkering_vessel_complete.glb`. Served via a custom Vite middleware in `vite.config.ts` (`externalModelServer`) that maps `/models/<basename>` to that directory. Path-traversal-safe via `path.basename` only.

## Key features built so far

### Dashboard map → terminal 3D → vessel 3D
1. **`src/app/pages/DashboardPage.tsx`** is the Mission Control screen. Header chip shows current scope (`Terminal · T07` or `Vessel · V02`). Three nested states:
   - Map view → click pin → `selectedTerminal` set → SingaporeMap fades, Terminal3DViewer fades in.
   - Terminal view → click vessel green dot → `selectedVessel` set, fires `onVesselChange` → camera dive to vessel.
   - Vessel view → BACK TO TERMINAL → returns to terminal camera.
2. **`src/app/components/terminals/SingaporeMap.tsx`** — MapLibre GL JS with `https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json` (free, no key). 10 terminal pins overlaid as DOM via `map.project` per render frame. `dive()` does a cinematic `flyTo` to the pin before triggering `onSelect`. `resetSignal` from Dashboard flies back to overview on BACK TO MAP. Loading shows `CloudLoadingBackdrop` (10 wispy radial-gradient puffs drifting).
3. **`src/app/components/terminals/Terminal3DViewer.tsx`** — R3F Canvas. Key innards:
   - `CameraIntro` — fit-to-viewport calculation: `framingRadius = bbox.r × terminal.frameRatio ?? 0.38`, distance = `framingRadius / tan(fov/2)` (uses `max(dX, dY)` for aspect). Captures `startCam` once on `triggerKey` change so resize-during-intro doesn't restart the animation. Initial camera position seeded via `bootCam` so first paint isn't a "model fills the screen" flash.
   - `WaterPlane`, `Sky`, `directionalLight` at fixed morning sun (~8 AM SGT — `sunStateForHour(8.0)`). Drei `Environment` with preset matched to `sun.label`.
   - `Vessel` component renders a clone of the shared GLB (`gltf.scene.clone(true)`), centers XZ at origin and min Y at 0, disables shadows on its meshes (3 × 480 meshes was killing the GPU shadow pass), no tint applied (was breaking the GLB's baked livery).
   - Each vessel has a clickable green `<Html>` dot above it. Hidden when `isFocused || dimmed` (Html portal lives outside the 3D group so `group.visible = false` doesn't kill it).
   - `VesselCameraIntro` — uses `fwdDir = (cos θ, 0, -sin θ)` and `sideDir = (sin θ, 0, cos θ)` because the GLB's long axis is local `+X`. Iso angle: `sideOffset = 0.42 × vesselLen`, `fwdOffset = +0.28 × vesselLen` (bow side), `eyeHeight = 0.30 × vesselLen`.
   - Top-right button auto-swaps `BACK TO MAP ↔ BACK TO TERMINAL` based on `selectedVessel`.
4. **Vessel-scoped dashboard** — when a vessel is open, KPI strip + AI Recommendation + Top Risk Session + Supplier Signals + Critical Events + Supplier Watchlist all swap to data from `VESSEL_DASHBOARDS[terminalId:vesselId]`. Terminal-scoped uses `TERMINAL_DASHBOARDS[terminalId]`. Both fall back to network-wide live data.

### T07 vessel positioning (current state)
Defined in `src/data/terminals.ts > VESSELS_BY_TERMINAL.T07`:
- V01 BUNKER KING I  — `pos: [-25, 3, 70]`, `rotY: 270`, scale 0.6, status `loading`. West side of middle jetty.
- V02 BUNKER KING II — `pos: [ 85, 3, 70]`, `rotY: 270`, scale 0.6, status `idle`. East side of middle jetty.
- V03 BUNKER KING III — `pos: [200, 3, 70]`, `rotY: 270`, scale 0.6, status `transit`. Alone at right jetty.
V01 + V02 share one jetty (left and right of it). V03 is the "third ship a bit far from the port" — the user wants its info used on the Live Session tab. `rotY = 270` because the GLB hull's long axis is X, so a 270° rotation puts the bow pointing south (+Z = open water), giving the bow-side iso camera a clear shot from offshore instead of from inside the land mass.

### Supabase wiring (in flight at the cut-off)
- **Project**: `jdnzznxwdczcktfqwxmj`. Service-role JWT in `.env.local` (`VITE_SUPABASE_ANON_KEY`). Pre-prod swap for anon + RLS.
- **11 tables exist**: `sessions` (11 rows), `bdn_records` (11), `suppliers` (4), `anomalies` (16), `risk_scores` (11), `historical_transactions` (22), `anchorage_geofences` (4), `fuel_prices` (4), `fuel_parameters`, `mfm_stream` (0 rows!), `llm_outputs` (0 rows!).
- **No `vessels` or `terminals` table yet** — wrote `supabase/migrations/20260609_terminals_vessels.sql` with DDL + seed for T01-T10 and V01-V03. Needs running in Supabase Studio SQL editor.
- **`src/lib/supabase.ts`** — single client + typed row interfaces (`SessionRow`, `AnomalyRow`, `SupplierRow`, `RiskScoreRow`).
- **`src/lib/useLiveDashboard.ts`** — `useLiveDashboard(portFragments?)` hook. Pulls 8 most-recent anomalies joined to sessions and 6 worst-reputation suppliers. Filters anomalies by `sessions.port ILIKE %fragment%` when a terminal is open. Skeleton fallback while loading.
- **Wired in `DashboardPage.tsx`** — Critical Events panel and Supplier Watchlist read from `useLiveDashboard()` when no terminal is open. T07-scoped swap (TERMINAL_DASHBOARDS) still wins when T07 is open. Vessel-scoped swap (VESSEL_DASHBOARDS) wins inside a vessel.

## The 10/10 plan (locked 2026-06-09 after schema audit + judge-criteria review)

Backend agent pipeline already exists at `D:/next bunker`:
- `anomaly/` — 26 deterministic detection rules with regulatory citations
- `risk/` — weighted score (40 anomaly / 25 supplier / 15 doc / 20 dev) with floors
- `policy/` — thresholds that trigger Exa / LOP / refuse-sign / escalate decisions
- `llm/stage4_copilot.py` — Claude-powered explanation
- `llm/stage5_report.py` — evidence package + blockchain anchor
- `llm/stage6_reputation.py` — supplier reputation update
- `llm/pipeline_runner.py` — end-to-end driver
- Output JSON lands in `pipeline_out/<session_id>_<utc>.json`

**Strategy: don't rebuild the agent — visualize it.** Five phases, ordered by judge-ROI ÷ token cost.

### Phase 1 — Vessels → Supabase sessions
- Add `sessionId?: string` to `VesselSpot` in `src/data/terminals.ts`:
  - V01 → SES-2026-001 (clean delivery, low risk, MAERSK HONAM + ALLI barge + Alpha supplier)
  - V02 → null (idle, no active session)
  - V03 → SES-2026-016 (top risk, 18.8 MT shortage — used by Live Session tab)
- Update `Vessel HUD` (the vessel-view info card in Terminal3DViewer) to query sessions + bdn_records + suppliers by `session_id` and display vessel_name, barge_name + IMO, supplier_name, fuel_grade, bdn_qty_mt vs mfm_qty_mt, dev_pct.

### Phase 2 — Live Session tab: 3D top-down + virtual hose
- Rewrite `src/app/pages/LiveSessionPage.tsx`.
- R3F Canvas, top-down ortho-ish view at Singapore Eastern Anchorage.
- Two GLBs: `bunkering_vessel_complete.glb` for the BUNKER KING III barge + same GLB scaled 1.6× for the commercial vessel (MAERSK HONAM).
- Between them: `tubeGeometry` along a Bezier curve, animated yellow "flow segments" texture-scroll. Speed driven by `mfm_stream.flow_rate_mt_h` (when empty, use a slow constant baseline).
- Right column: AI Verdict (risk_scores), Telemetry block (latest mfm_stream packet, fallback synthetic), Activity Feed (anomalies filtered to session_id, desc by triggered_at, limit 8).
- Filter all data by V03's session_id (SES-2026-016).

### Phase 3 — Autonomous decision-chain panel
- New `<AgentDecisionChain />` component in Live Session right column, above AI Verdict.
- Vertical timeline of branches:
  - `score >= 40` → "Enrich via Exa search"
  - `score >= 70` → "Generate Letter of Protest"
  - `score >= 75` → "Recommend REFUSE TO SIGN"
  - `score >= 90` → "Escalate to MPA"
- Triggered nodes pulse green; skipped nodes are grey with "(not triggered)" label.
- Data source: a Supabase view `agent_decisions` (one CREATE VIEW SQL in `supabase/migrations/`). FE reads `agent_decisions` for the session_id.
- This is the headline "Reasoning + Tool Use" piece for Autonomy & Decision-Making judging dimension.

### Phase 4 — GPS Geofence overlay
- In the Live Session 3D view, render each `anchorage_geofences` row as a translucent ring on the water plane (radius from `geofence_radius_m`, position from `latitude_n` / `longitude_e` projected to scene coords).
- Inside zone → ring green; outside zone → ring red + floating "🚢 OUTSIDE ZONE" tag above the barge.
- Eastern Anchorage geofence is already in Supabase (1.25°N, 103.8833°E, radius 2000 m).

### Phase 5 — Dashboard copilot (if time)
- `<PortCopilot />` floating button bottom-right of Dashboard, opens a side drawer chat.
- New `vite.config.ts` middleware `/api/copilot` POSTs to Anthropic with system prompt + recent anomalies as context.
- **Swappable LLM provider interface** in `src/lib/llm-provider.ts` — Anthropic today, AWS Bedrock Sonnet later. User confirmed AWS migration is planned.
- Lowest priority; skip cleanly if running out of budget.

### Seed-data state (post-seed for V03)

V03's session SES-2026-016 has full data in Supabase, ready for Phase 2:

| Table | SES-2026-016 (V03) | SES-2026-001 (V01) |
|---|---|---|
| sessions | ✅ EVER GIVEN · ALLI barge · Supplier Gamma · 500/481.2 MT · -3.76% · risk 78 CRITICAL · REFUSE_TO_SIGN | ✅ MAERSK HONAM · ALLI · Supplier Alpha · 850/848.3 · -0.2% · risk 12 LOW · SIGN |
| bdn_records | ✅ | ✅ |
| risk_scores | ✅ score 78 CRITICAL | ✅ score 12 LOW |
| anomalies | ✅ 2 rows (A01 trajectory @ 11:45, A02 final mismatch @ 14:32) | ✗ (clean delivery, zero anomalies — correct) |
| mfm_stream | ✅ **26 packets seeded** 10:15-14:25 SGT, drive_gain spikes 22% at A01 trigger, ends exactly 481.2 MT | ✗ not seeded (V01 isn't a Live Session demo) |
| llm_outputs | ✅ **1 row seeded** Stage 4, payload contains summary + 4 concerns + 4-step `tool_use_chain` | ✗ |
| anchorage_geofences | ✅ Eastern Anchorage row (1.25°N 103.8833°E radius 2000m) covers V03 | n/a |
| historical_transactions | ✅ | ✅ |

The mfm_stream packets:
- Phase 1 (0-60 min): flow 112 ± 3 MT/h, drive_gain 9-11% (normal)
- Phase 2 (60-90 min): flow drops 112 → 82 MT/h, drive_gain climbs 9.5 → 23.5% (aeration onset)
- Phase 3 (90-180 min): flow ~100 MT/h with cycles, drive_gain sustained 18-24% (cappuccino bunker)
- Phase 4 (180-257 min): final ramp-down to 45 MT/h, cumulative lands **exactly at 481.2 MT** matching session.mfm_qty_mt
- `packet_sha256` is a SHA-256 hash chain (each packet hashes its payload + prev_sha) — tamper-evident
- `meter_serial` = '13228354' matching session.meter_serial

The llm_outputs payload (JSONB) contains:
```
{
  "summary": "EVER GIVEN delivery shows systematic short delivery...",
  "concerns": [4 items],
  "recommended_action": "REFUSE_TO_SIGN",
  "confidence": 0.92,
  "tool_use_chain": [
    {step:1, tool:"risk_engine",                 output: {final_risk_score: 78, ...}},
    {step:2, tool:"exa_search",                  trigger:"risk >= 40"},
    {step:3, tool:"letter_of_protest_generator", trigger:"risk >= 70"},
    {step:4, tool:"verdict_engine",              trigger:"risk >= 75"}
  ]
}
```
Phase 3's `<AgentDecisionChain />` can render `tool_use_chain` directly.

Seed script lives at `D:/next-bunker-fe/supabase/seed/v03_telemetry.py` — re-runnable (DELETE the rows first, then run, env var `SUPABASE_KEY=...`).

### Locked decisions
- **No pipeline run** for `mfm_stream` / `llm_outputs`. Use what's in Supabase; degrade gracefully when those are empty.
- **No rule-library UI**. Tight to the 5 phases.
- **No new Supabase tables** beyond the migration already written (`20260609_terminals_vessels.sql`) + one new view (`agent_decisions`, written in Phase 3).
- **`vessels` + `terminals` tables** stay deferred until the user runs the migration in Studio. Phases 1-5 don't require them — Phase 1 just adds a `sessionId` field to the FE's existing `VesselSpot` constant.

## Pending — what the user asked for last (NOT done yet)

The user's last instruction (which the session-limit interruption blocks):
1. **Assign each of V01/V02/V03 a Supabase session** so their HUDs show real barge name / IMO / MPA licence / supplier from the `sessions` + `bdn_records` rows.
2. **V03 specifically powers the Live Session tab** — V03 is the "barge a bit far from the port" representing an at-sea bunkering operation.
3. **Replace Live Session's placeholder map** (the current view shows "HONAM" + "MT FUEL STAR 7" labels with a dashed connecting line over Singapore Eastern Anchorage). Build a top-down R3F scene with:
   - The bunkering barge (BUNKER KING III GLB)
   - A receiving commercial vessel (use the same GLB scaled up, or another model)
   - A virtual line between them = the fuel hose / piping
4. **Wire Supabase to the Live Session right column**:
   - AI Verdict + Confidence + signals — from `risk_scores` joined to `sessions` for V03's session
   - Telemetry (Flow Rate / Temperature / Density) — from `mfm_stream` for the session (empty right now)
   - Activity Feed — from `anomalies` for the session, ordered by `triggered_at` desc

## Things to remember when resuming

- **Disk pressure**: C: was 100% full → moved project to D: → C: copy deleted. `DashboardPage.tsx` was truncated to 0 bytes mid-edit before the move; current version on D: is the rebuild. If C: fills again, this is why.
- **Heavy GLBs + screenshot tool**: When the 3D viewer is rendering ~5k-7k meshes the preview-tool's `preview_screenshot` often times out (30 s). The page is fine, the tool just can't grab a stable frame. Use `preview_eval` to verify state when screenshots fail.
- **HMR resets vessel/terminal state**: Saving edits to Terminal3DViewer or terminals.ts unmounts components, which clears `selectedTerminal` and `selectedVessel`. To reverify, the eval helper has to click T07 pin again before clicking V02 dot.
- **GLB coordinate gotcha**: The vessel GLB's hull long axis is local +X (137 m), not +Z. That's why `rotY = 90` makes the vessel run N↔S (parallel to jetty) and `rotY = 0` actually makes it run E↔W. The camera math in `VesselCameraIntro` uses `fwdDir = (cos θ, 0, -sin θ)` to match this.
- **`sessions.port` is free text** — currently filtered with a fuzzy `ILIKE %operator% OR %location%`. Once the `terminals` table is in via the migration, switch to a clean FK.
- **Two columns in `useLiveDashboard` show "in future"** — some seed-data `triggered_at` values are after today (2026-06-09). Either fix the seed, or remove the negative-delta clamp in `relativeTime()`.
- **No icons missing**: Lucide is the icon lib. `ArrowLeft`, `Ship`, `Shield`, etc. all imported per page.

## Feature audit from earlier check (P0-P3)

| P | Feature | FE status |
|---|---------|-----------|
| P0 | GPS Geofence Detection | ✅ `SessionDetailPage`, `SettingsPage` (mocked) |
| P0 | Live AIS + MFM + IoT correlation | ⚠️ separate AIS/MFM tabs, no unified correlation view |
| P0 | Digital Surveyor Narrative | ❌ not built |
| P1 | Exa Supplier Intelligence | ❌ not built |
| P1 | Green Fuel Compliance | ❌ not built |
| P2 | Ship Age Risk Factor | ❌ not built |
| P3 | Fuel Consumption Analytics | ❌ not built |
| P3 | Carbon Dashboard | ❌ not built |
