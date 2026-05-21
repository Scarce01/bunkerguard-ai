"""BunkerGuard Live — Stage 4 demo dashboard.

Interactive operator console for Singapore bunker fraud surveillance.
Run:   streamlit run dashboard/app.py
"""
from __future__ import annotations

import sys
from pathlib import Path
from datetime import timedelta

import pandas as pd
import streamlit as st

# NOTE: This dashboard is **NOT** part of Stage 2/3 scope. It lives under
# _other_stages/ because the official Stage 4 (LLM Copilot) and Stage 5
# (Evidence Report dashboard) are owned by other teammates. This file is a
# Stage 2/3 evaluation harness for judges — it exercises our detect+score
# engine through real-case replay and live attack injection.
#
# Path setup: insert REPO ROOT (for stage 2/3 modules anomaly/risk/contracts)
# and _other_stages/ (for borrowed Stage 1 ingest + Stage 5 pipeline).
_HERE = Path(__file__).resolve().parent
_OTHER = _HERE.parent             # .../NEXT/_other_stages
_ROOT = _OTHER.parent             # .../NEXT
sys.path.insert(0, str(_OTHER))
sys.path.insert(0, str(_ROOT))

from anomaly import detect
from contracts import RULE_REGISTRY, Severity
from ingest import load_sessions
from pipeline.attack import inject_cappuccino, inject_short_delivery, inject_meter_tamper
from pipeline.billing import compute_fee
from pipeline.narrative import generate_lop_draft, generate_master_brief
from replay import CASES as REPLAY_CASES, load_case
from risk import score as risk_score

# ------------------------------------------------------------------ page
st.set_page_config(
    page_title="BunkerGuard Live · Singapore",
    page_icon="⚓",
    layout="wide",
    initial_sidebar_state="expanded",
)

SEVERITY_COLOR = {
    Severity.CRITICAL: "#d62728",
    Severity.HIGH: "#ff7f0e",
    Severity.MEDIUM: "#fbc02d",
    Severity.LOW: "#2ca02c",
}
CATEGORY_COLOR = {
    "LOW": "#2ca02c",
    "MODERATE": "#fbc02d",
    "HIGH": "#ff7f0e",
    "CRITICAL": "#d62728",
    "INSUFFICIENT_DATA": "#9e9e9e",
}


# ------------------------------------------------------------------ data
@st.cache_data(show_spinner=False)
def _load_all():
    return load_sessions()


def _evaluate(session):
    report = detect.run(session)
    pkg = risk_score.run(report, session)
    return report, pkg


# ------------------------------------------------------------------ sidebar
st.sidebar.title("⚓ BunkerGuard")
st.sidebar.caption("Singapore • Stage 4 console")
st.sidebar.markdown(
    "Real-time fraud surveillance for marine bunkering ops.\n\n"
    "**Standards:** MARPOL Annex VI · MEPC.1/Circ.891 · "
    "ISO 8217:2024 · SS 648:2019 · OIML R 117-1 · BIMCO BunkerVoy."
)

sessions = _load_all()
ids = [s.session_id for s in sessions]

mode = st.sidebar.radio(
    "Mode",
    options=["🟢 Live surveillance", "📼 Replay real case"],
    index=0,
    help="Live = today's bunkering ops. Replay = historical fraud cases reconstructed from public reports.",
)

if mode == "📼 Replay real case":
    case_id = st.sidebar.selectbox(
        "Historical case",
        options=list(REPLAY_CASES.keys()),
        format_func=lambda k: f"{REPLAY_CASES[k].title} ({REPLAY_CASES[k].incident_date})",
    )
    session = load_case(case_id)
    case_meta = REPLAY_CASES[case_id]
    st.sidebar.success(f"Replaying: **{case_meta.title}**")
    st.sidebar.caption(case_meta.one_liner)
    attack_choice = "None"
else:
    case_meta = None
    selected_id = st.sidebar.selectbox("Session", ids, index=0)
    session = next(s for s in sessions if s.session_id == selected_id)

    st.sidebar.divider()
    st.sidebar.markdown("### 🔴 Attack injection (live demo)")
    st.sidebar.caption("Mutates the in-memory stream for this session only.")
    attack_choice = st.sidebar.radio(
        "Inject attack",
        options=["None", "Cappuccino (air injection)", "Short delivery (-2.5%)", "Meter tamper (HMAC break)"],
        index=0,
    )
    if attack_choice == "Cappuccino (air injection)":
        session = inject_cappuccino(session)
    elif attack_choice == "Short delivery (-2.5%)":
        session = inject_short_delivery(session, pct=2.5)
    elif attack_choice == "Meter tamper (HMAC break)":
        session = inject_meter_tamper(session)

# ------------------------------------------------------------------ run pipeline
report, pkg = _evaluate(session)


# ------------------------------------------------------------------ header
def _headline_row():
    cat = pkg.risk_category.value
    color = CATEGORY_COLOR.get(cat, "#9e9e9e")
    score_txt = pkg.risk_score if pkg.risk_score is not None else "—"
    cols = st.columns([1.4, 1, 1, 1, 1.2])
    with cols[0]:
        st.markdown(
            f"<div style='padding:14px 18px;border-radius:12px;background:{color}1a;border:1px solid {color}'>"
            f"<div style='font-size:11px;letter-spacing:.1em;color:{color}'>RISK CATEGORY</div>"
            f"<div style='font-size:30px;font-weight:700;color:{color}'>{cat}</div>"
            f"<div style='font-size:13px;color:#444'>Score {score_txt}/100 · {pkg.verdict.value}</div>"
            f"</div>", unsafe_allow_html=True)
    cols[1].metric("Vessel", session.vessel.name, f"IMO {session.vessel.imo}")
    cols[2].metric("Supplier", session.supplier.name,
                   f"MPA {'✓' if session.supplier.in_mpa_registry else '✗'}")
    cols[3].metric("BDN qty", f"{session.bdn_qty_mt:,.1f} MT", f"{session.bdn.grade.value}")
    if pkg.estimated_impact_usd is not None:
        cols[4].metric("USD exposure", f"${pkg.estimated_impact_usd:,.0f}",
                       f"{(session.deviation_pct or 0):+.2f}%")
    else:
        cols[4].metric("USD exposure", "—", "no qty data")


st.markdown("## 🛢️ BunkerGuard Live — Singapore Bunker Surveillance")
st.caption(
    f"Session **{session.session_id}** · {session.start_ts:%Y-%m-%d %H:%M}–"
    f"{session.end_ts:%H:%M UTC} · {session.duration_h:.1f}h · "
    f"Anchorage: **{session.geofence.name if session.geofence else '—'}**"
)

# ---- Replay-mode banner: dramatic "this was real" reveal ----
if case_meta is not None:
    published = case_meta.published_loss_usd
    st.markdown(
        f"<div style='padding:18px 22px;border-radius:14px;"
        f"background:linear-gradient(90deg,#1a1a2e,#16213e);color:#fff;"
        f"border:2px solid #d62728;margin:8px 0 18px 0;'>"
        f"<div style='font-size:11px;letter-spacing:.2em;color:#ff6b6b'>📼 HISTORICAL REPLAY · REAL CASE</div>"
        f"<div style='font-size:26px;font-weight:800;margin:4px 0'>{case_meta.title}</div>"
        f"<div style='font-size:14px;opacity:.85;margin-bottom:8px'>"
        f"📍 {case_meta.location} · 🗓️ {case_meta.incident_date}<br>"
        f"{case_meta.one_liner}</div>"
        f"<div style='font-size:12px;opacity:.7'>"
        f"Industry-wide published loss: <b>USD {published:,.0f}</b> · "
        f"Sources: {' · '.join(case_meta.sources)}"
        f"</div></div>",
        unsafe_allow_html=True,
    )

_headline_row()

# ------------------------------------------------------------------ tabs
tab_overview, tab_stream, tab_anom, tab_evidence, tab_lop, tab_audit, tab_billing = st.tabs(
    ["📊 Overview", "📈 MFM Stream", "🚨 Anomalies", "🗂️ Evidence",
     "📝 LOP & Brief", "🔐 Audit & Chain", "💰 Recovery Fee"]
)

# ---------------------------------------------------------------- overview
with tab_overview:
    left, right = st.columns([1.3, 1])
    with left:
        st.markdown("#### Why this score?")
        for line in pkg.because[:8]:
            if line.startswith("[CRITICAL]"):
                st.error(line)
            elif line.startswith("[HIGH]"):
                st.warning(line)
            elif line.startswith("[MEDIUM]"):
                st.info(line)
            else:
                st.write("• " + line)
        if len(pkg.because) > 8:
            with st.expander(f"+ {len(pkg.because) - 8} more reasoning lines"):
                for line in pkg.because[8:]:
                    st.write(line)
    with right:
        st.markdown("#### Required actions")
        flag = lambda b, label: st.markdown(f"- {'✅' if b else '⬜'} {label}")
        flag(pkg.requires_lop, "Letter of Protest")
        flag(pkg.requires_surveyor, "Independent surveyor")
        flag(pkg.requires_resample, "MARPOL fuel resample")
        st.markdown("#### Escalation path")
        for i, role in enumerate(pkg.escalation_path, 1):
            st.markdown(f"`{i}.` **{role}**")
        st.markdown(f"#### Dispute window\n**{pkg.dispute_window_hours}h** (BIMCO standard)")

# ---------------------------------------------------------------- stream
with tab_stream:
    if session.mfm_stream:
        df = pd.DataFrame([p.model_dump(mode="json") for p in session.mfm_stream])
        df["timestamp"] = pd.to_datetime(df["timestamp"])
        c1, c2 = st.columns(2)
        with c1:
            st.markdown("**Cumulative delivery (MT) vs expected**")
            st.line_chart(df.set_index("timestamp")[["cumulative_mt", "expected_mt"]])
        with c2:
            st.markdown("**Flow rate (MT/h)**")
            st.line_chart(df.set_index("timestamp")[["flow_rate_mt_h"]])
        c3, c4 = st.columns(2)
        with c3:
            st.markdown("**Density: op vs 15°C (kg/m³)** — divergence = cappuccino signature")
            st.line_chart(df.set_index("timestamp")[["density_op_kg_m3", "density_15c_kg_m3"]])
        with c4:
            st.markdown("**Drive-gain (%) & tube freq (Hz)** — sensor health")
            st.line_chart(df.set_index("timestamp")[["drive_gain_pct"]])
            st.line_chart(df.set_index("timestamp")[["tube_freq_hz"]])
        with st.expander("Raw packet table (last 30)"):
            st.dataframe(df.tail(30), width="stretch", height=320)
    else:
        st.info("No MFM packets in this session.")

# ---------------------------------------------------------------- anomalies
with tab_anom:
    if not report.anomalies:
        st.success("No anomalies detected. ✅")
    else:
        for a in sorted(report.anomalies, key=lambda x: -{"CRITICAL":4,"HIGH":3,"MEDIUM":2,"LOW":1}[x.severity.value]):
            spec = RULE_REGISTRY[a.rule]
            color = SEVERITY_COLOR[a.severity]
            st.markdown(
                f"<div style='border-left:4px solid {color};padding:10px 14px;margin:8px 0;background:{color}0d'>"
                f"<div style='font-size:12px;color:{color};letter-spacing:.05em'><b>{a.severity.value}</b> · {a.rule.value}</div>"
                f"<div style='font-size:16px;font-weight:600;margin:2px 0'>{spec.name}</div>"
                f"<div style='color:#222'>{a.description}</div>"
                f"<div style='font-size:11px;color:#666;margin-top:6px'>"
                f"Basis: {spec.regulatory_basis} · Citation: <i>{spec.citation}</i> · "
                f"Confidence {a.confidence:.0%}"
                f"</div>"
                f"</div>", unsafe_allow_html=True)

# ---------------------------------------------------------------- evidence
with tab_evidence:
    st.markdown("### Independent evidence sources used in this verdict")
    rows = []
    if session.geofence:
        rows.append(("Anchorage geofence",
                     f"{session.geofence.name} ({session.geofence.center_lat:.4f}°N, "
                     f"{session.geofence.center_lon:.4f}°E, r={session.geofence.radius_m:.0f}m)"))
    if session.barge_ais:
        rows.append((f"Barge AIS ({len(session.barge_ais)} pings)",
                     f"MMSI {session.barge_ais[0].mmsi}, lat={session.barge_ais[0].lat}, lon={session.barge_ais[0].lon}"))
    if session.meter_calibration:
        c = session.meter_calibration
        rows.append(("Meter calibration",
                     f"{c.cert_id} · {c.issuer} · class {c.accuracy_class} · due {c.next_due:%Y-%m-%d}"))
    if session.sounding:
        s = session.sounding
        rows.append(("Vessel sounding (ISGOTT §11.1)",
                     f"ROB before {s.rob_before_mt} MT → after {s.rob_after_mt} MT = "
                     f"**{s.delivered_mt:.1f} MT delivered** ({s.method}, by {s.measured_by})"))
    if session.vef_history:
        avg = sum(session.vef_history) / len(session.vef_history)
        rows.append((f"VEF history (n={len(session.vef_history)})",
                     f"baseline μ={avg:.4f} · current={session.bdn.vef_factor:.4f}"))
    if session.bdn.ebdn_qr_sha256:
        rows.append(("e-BDN QR signature", f"SHA256 {session.bdn.ebdn_qr_sha256[:24]}…"))
    if session.bdn.sample_seal:
        rows.append(("MARPOL fuel sample seal", session.bdn.sample_seal))
    rows.append(("Supplier registry",
                 f"{session.supplier.name} · MPA licence {session.supplier.mpa_licence or 'NONE'} · "
                 f"in registry: {'YES' if session.supplier.in_mpa_registry else 'NO'} · "
                 f"reputation {session.supplier.reputation_score or 'N/A'}/100"))
    st.table(pd.DataFrame(rows, columns=["Source", "Detail"]))

# ---------------------------------------------------------------- LOP
with tab_lop:
    if pkg.requires_lop or pkg.verdict.value in ("REFUSE_TO_SIGN", "SIGN_WITH_LOP"):
        st.markdown("### Auto-generated Letter of Protest (draft)")
        st.caption("Template-based; review with Master before serving.")
        st.code(generate_lop_draft(session, report, pkg), language="markdown")
    st.markdown("### Master's brief (plain English)")
    st.markdown(generate_master_brief(session, report, pkg))

# ---------------------------------------------------------------- audit
with tab_audit:
    st.markdown("### Cryptographic chain of custody")
    st.markdown(
        f"- **Stage 1 → Stage 2 link**: report.parent_sha256 = `{report.parent_sha256[:32] if report.parent_sha256 else '—'}…`\n"
        f"- **Stage 2 → Stage 3 link**: pkg.parent_sha256 = `{pkg.parent_sha256[:32] if pkg.parent_sha256 else '—'}…`\n"
        f"- **Stage 3 payload SHA-256**: `{pkg.payload_sha256[:32] if pkg.payload_sha256 else '—'}…`\n"
        f"- **Policy version**: `{pkg.audit.components.__class__.__module__}` · weights enforced server-side\n"
        f"- **HMAC**: per-meter shared secret · canonical packet form · `hmac.compare_digest`\n"
        f"- **Stream chain**: each MFM packet contains SHA-256 of the previous (tamper-evident)\n"
    )
    with st.expander("Full risk audit trace (JSON)"):
        st.json(pkg.audit.model_dump(mode="json"))
    with st.expander("Anomaly report (JSON)"):
        st.json(report.model_dump(mode="json"))
    with st.expander("Risk package (JSON)"):
        st.json(pkg.model_dump(mode="json"))

# ---------------------------------------------------------------- billing
with tab_billing:
    st.markdown("### 💰 Recovery-as-a-Service")
    st.caption("We don't sell software. We collect 5% of recovered fraud value. "
               "**No save → no fee.**")
    quote = compute_fee(pkg)

    if quote.fee_usd > 0 and quote.base_recovery_usd > 0:
        c1, c2, c3 = st.columns(3)
        c1.metric("Recoverable exposure", f"${quote.base_recovery_usd:,.0f}",
                  f"{session.deviation_pct or 0:+.2f}%")
        c2.metric(f"Our fee ({quote.rate_pct:.0f}%)", f"${quote.fee_usd:,.0f}",
                  "billed only on enforced LOP")
        c3.metric("Customer net benefit", f"${quote.customer_keeps_usd:,.0f}",
                  f"{(quote.customer_keeps_usd / quote.base_recovery_usd * 100):.0f}% kept")
        st.success(quote.rationale)
    elif quote.fee_usd > 0:
        st.info(f"**Audit-trail fee:** USD {quote.fee_usd:,.0f}\n\n{quote.rationale}")
    else:
        st.success(quote.rationale)

    st.divider()
    st.markdown("#### Why this beats SaaS subscription")
    st.markdown(
        "- **Aligned incentives** — we don't get paid unless the customer recovers value.\n"
        "- **Zero CAPEX for shipowners** — install the meter agent, no licence fees.\n"
        "- **Transparent unit economics** — every fee ties to a chained, citable evidence package.\n"
        "- **Scales with TAM** — 750k bunkerings/yr × 12% disputed × USD 25k avg × 5% take = "
        "**USD 112M/yr addressable** in just the global merchant fleet."
    )

    if case_meta is not None:
        st.divider()
        st.markdown("#### 📊 Industry vs single-vessel economics for this case")
        published = case_meta.published_loss_usd
        per_vessel_fee = quote.fee_usd
        cs1, cs2, cs3 = st.columns(3)
        cs1.metric("Published industry loss", f"${published:,.0f}",
                   case_meta.incident_date)
        cs2.metric("Our fee (this vessel)", f"${per_vessel_fee:,.0f}",
                   "5% of single-vessel exposure")
        # Estimate industry-wide fee at 5% (caps at published loss)
        industry_fee = min(published * 0.05, published)
        cs3.metric("Industry-wide TAM (this case)", f"${industry_fee:,.0f}",
                   "if every affected vessel had used PortSight")
