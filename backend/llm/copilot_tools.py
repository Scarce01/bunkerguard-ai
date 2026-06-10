"""Officer-facing copilot tools.

The Chief Engineer Copilot answers in chat. These tools are what it calls
when the officer asks a question — the answer comes back with the proof
attached (chart, citation, action), not "open tab 2."

Each tool here is a pure function bound to one session's (session, report,
package). The Anthropic tool-use schemas live alongside the implementation
so the wiring stays in one place.

Surface (seven officer tools, one navigation escape hatch):

    Tier 1 — answer-shaped
        get_verdict_brief()          verdict + score + top reasons + checklist
        show_anomaly(rule_id)        one finding card, measured vs expected
        show_chart(kind)             generates a PNG, returns path + caption
        cite(rule_id)                verbatim regulatory citation

    Tier 2 — action
        draft_lop()                  Letter of Protest draft
        generate_evidence_pdf()      full audit bundle for handoff
        mark_action_done(key)        ticks the on-deck checklist

    Tier 3 — navigation (only when officer asks to *show* on dashboard)
        open_tab(tab_id)             hint the dashboard to focus a tab

Returns are JSON-safe dicts. ``path`` keys point to artifacts on disk that
the chat UI renders inline (PNG, PDF, MD).
"""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Any, Optional

from contracts import RULE_REGISTRY, RuleId
from outputs._extract import ViewBundle, extract_view, mfm_timeline
from outputs.config import session_dir

if TYPE_CHECKING:
    from contracts import AnomalyReport, RiskPackage, SessionInput

log = logging.getLogger("bunkerguard.llm.copilot_tools")

# ---------------------------------------------------------------- tab catalog
# Stable IDs the dashboard reads from the tab-hint state file. Must match the
# tabs declared in _other_stages/dashboard/app.py:180.
TAB_IDS = {
    "overview": "📊 Overview",
    "mfm_stream": "📈 MFM Stream",
    "anomalies": "🚨 Anomalies",
    "evidence": "🗂️ Evidence",
    "lop_brief": "📝 LOP & Brief",
    "audit_chain": "🔐 Audit & Chain",
    "recovery_fee": "💰 Recovery Fee",
}

# Chart kinds the officer can ask for. Each maps to a renderer in outputs.charts.
CHART_KINDS = ("quantity", "mfm_flow", "risk_breakdown", "supplier_history")

# Action keys mirror outputs/decision_console.py:_actions_block
ACTION_KEYS = ("hold", "lop", "resample", "surveyor", "seal", "countersign", "ok")


# ---------------------------------------------------------------- tool runtime

@dataclass
class CopilotTools:
    """One instance per session. The LLM calls ``dispatch(name, args)``.

    Two construction modes:
      * Typed pipeline: pass ``session``, ``report``, ``package`` and the
        ``ViewBundle`` is derived on demand. This is what Streamlit uses.
      * Pre-built view: pass ``view=`` (and optional ``mfm_timeline_data``)
        when the typed contracts aren't available — e.g. the web copilot
        hydrates a ``ViewBundle`` directly from Supabase rows. The typed
        fields can then be ``None``; tools that need them
        (``generate_evidence_pdf``) return a friendly fallback.
    """
    session: Optional["SessionInput"] = None
    report: Optional["AnomalyReport"] = None
    package: Optional["RiskPackage"] = None
    view: Optional[ViewBundle] = None
    mfm_timeline_data: Optional[list[dict]] = None
    output_dir: Optional[Path] = None

    def __post_init__(self) -> None:
        if self.view is None and self.session is None:
            raise ValueError(
                "CopilotTools needs either `view=` or `session=/report=/package=`.")
        if self.view is None:
            self.view = extract_view(self.session, self.report, self.package)
        sid = self.view.session_id
        self.output_dir = Path(self.output_dir or session_dir(sid))
        self.output_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------ dispatch
    def dispatch(self, name: str, args: dict[str, Any]) -> dict[str, Any]:
        fn = getattr(self, name, None)
        if fn is None or not callable(fn) or name.startswith("_"):
            return {"error": f"unknown tool: {name}"}
        try:
            return fn(**(args or {}))
        except TypeError as e:
            return {"error": f"bad arguments for {name}: {e}"}
        except Exception as e:
            log.exception("tool_failed", extra={"tool": name})
            return {"error": f"{type(e).__name__}: {e}"}

    # ------------------------------------------------------------ Tier 1

    def get_verdict_brief(self) -> dict:
        """Verdict + score + top 2 reasons + the on-deck checklist."""
        v = self.view
        risk = v.risk
        # top-2 reasons by severity
        sev_rank = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
        top = sorted(
            v.anomalies,
            key=lambda a: (-sev_rank.get(str(a.get("severity")), 0),
                           -(a.get("confidence") or 0)),
        )[:2]
        checklist = _build_checklist(v)
        return {
            "verdict": risk.get("verdict"),
            "category": risk.get("category"),
            "risk_score": risk.get("risk_score"),
            "headline": _headline(risk.get("verdict")),
            "exposure_usd": risk.get("financial_impact"),
            "dispute_window_hours": risk.get("dispute_window_hours", 72),
            "top_reasons": [
                {
                    "rule_id": a.get("rule_id"),
                    "name": a.get("name"),
                    "severity": a.get("severity"),
                    "one_line": a.get("description"),
                } for a in top
            ],
            "checklist": checklist,
            "vessel": v.bdn.get("vessel_name"),
            "imo": v.bdn.get("vessel_imo"),
            "supplier": v.bdn.get("supplier_name"),
        }

    def show_anomaly(self, rule_id: str) -> dict:
        """One finding card: measured vs expected + the citation."""
        rid = str(rule_id).upper()
        match = next((a for a in self.view.anomalies
                      if str(a.get("rule_id", "")).upper() == rid), None)
        if not match:
            # Richer error: include enough context that the UI can render the
            # available anomalies as clickable chips, not just a text fallback.
            return {
                "error": f"no anomaly with rule_id={rid} in this session",
                "requested": rid,
                "available_anomalies": [
                    {"rule_id": a.get("rule_id"),
                     "name": a.get("name"),
                     "severity": a.get("severity")}
                    for a in self.view.anomalies
                ],
                "hint": ("This session has these findings — pick one to drill in, "
                         "or ask 'do I sign?' for the full picture."),
            }
        return {
            "rule_id": match.get("rule_id"),
            "name": match.get("name"),
            "severity": match.get("severity"),
            "description": match.get("description"),
            "measured": match.get("measured"),
            "reference": match.get("reference"),
            "unit": match.get("unit"),
            "deviation_pct": match.get("deviation_pct"),
            "confidence": match.get("confidence"),
            "regulatory_basis": match.get("regulatory_basis"),
        }

    def show_chart(self, kind: str) -> dict:
        """Render a chart PNG. Officer reads it inline; no tab-jumping."""
        if kind not in CHART_KINDS:
            return {
                "error": f"unknown chart kind: {kind}",
                "available_kinds": [
                    {"kind": "quantity",
                     "label": "Quantity comparison",
                     "desc": "BDN vs MFM totals as bars"},
                    {"kind": "mfm_flow",
                     "label": "Flow curve",
                     "desc": "Cumulative delivery + flow rate over time"},
                    {"kind": "risk_breakdown",
                     "label": "Risk breakdown",
                     "desc": "Weighted score components"},
                    {"kind": "supplier_history",
                     "label": "Supplier history",
                     "desc": "Prior sessions for this supplier"},
                ],
            }
        from outputs import charts  # heavy import; deferred

        v = self.view
        out = self.output_dir
        try:
            if kind == "quantity":
                path = charts.chart_quantity_comparison(
                    bdn_qty=float(v.bdn.get("quantity_mt") or 0),
                    mfm_qty=float(v.mfm.get("cumulative_mass") or 0),
                    output_path=out / "chart_quantity.png",
                )
                caption = (f"BDN {v.bdn.get('quantity_mt')} MT vs MFM "
                           f"{v.mfm.get('cumulative_mass'):.1f} MT.")
            elif kind == "mfm_flow":
                timeline = (self.mfm_timeline_data
                            if self.mfm_timeline_data is not None
                            else (mfm_timeline(self.session) if self.session else []))
                path = charts.chart_mfm_flow_profile(
                    timeline, bdn_qty=float(v.bdn.get("quantity_mt") or 0),
                    output_path=out / "chart_mfm_flow.png",
                )
                if path is None:
                    # When telemetry is missing, point at the chart that DOES
                    # work — quantity comparison only needs BDN + final MFM,
                    # which the BDN row provides even if the stream is empty.
                    return {
                        "error": "no MFM stream in this session",
                        "fallback_kind": "quantity",
                        "fallback_label": "Show quantity comparison instead",
                        "hint": ("No real-time MFM packets were recorded for "
                                 "this session. The quantity-comparison chart "
                                 "still works — it uses the final BDN vs MFM "
                                 "totals."),
                    }
                caption = "Cumulative delivery vs BDN target + per-tick flow rate."
            elif kind == "risk_breakdown":
                path = charts.chart_risk_breakdown(
                    v.risk, output_path=out / "chart_risk_breakdown.png")
                caption = f"Weighted risk components — score {v.risk.get('risk_score')}/100."
            else:  # supplier_history
                rows = v.history.get("rows") or []
                if not rows:
                    return {"error": "no supplier history available"}
                path = charts.chart_supplier_history(
                    rows, output_path=out / "chart_supplier_history.png")
                caption = f"Supplier {v.supplier.get('name')} — last {len(rows)} sessions."
            return {"kind": kind, "path": str(path), "caption": caption}
        except ImportError as e:
            return {"error": f"matplotlib not installed: {e}"}

    def cite(self, rule_id: str) -> dict:
        """Verbatim regulatory citation for one rule."""
        try:
            rid = RuleId(str(rule_id).upper())
        except ValueError:
            return {"error": f"unknown rule_id: {rule_id}",
                    "known": [r.value for r in RuleId]}
        spec = RULE_REGISTRY[rid]
        return {
            "rule_id": rid.value,
            "name": spec.name,
            "default_severity": spec.default_severity.value,
            "regulatory_basis": spec.regulatory_basis,
            "citation": spec.citation,
        }

    # ------------------------------------------------------------ Tier 2

    def draft_lop(self) -> dict:
        """Letter of Protest draft. Officer reviews then signs and serves."""
        body: Optional[str] = None
        if self.session is not None:
            try:
                from _other_stages.dashboard import app as _dash  # noqa: F401
                from pipeline.narrative import generate_lop_draft  # type: ignore
                body = generate_lop_draft(self.session, self.report, self.package)
            except Exception:
                body = None
        if body is None:
            body = _fallback_lop(self.view)
        path = self.output_dir / f"LOP_{self.view.session_id}.md"
        path.write_text(body, encoding="utf-8")
        return {"path": str(path), "body": body,
                "guidance": "Review with Master, sign, and serve to the barge "
                            "before disconnection."}

    def generate_evidence_pdf(self) -> dict:
        """Full audit bundle. Emailable, court-admissible.

        Two paths:
          * Typed pipeline (Streamlit / in-process) → outputs.report_bundle.
          * Supabase-mode (web copilot) → llm.evidence_report_service.
        Both end up returning ``{"path": "...", "caption": "..."}`` so the
        frontend renders the same download chip regardless.
        """
        sid = self.view.session_id
        # Path A — typed pipeline available.
        if self.session is not None:
            try:
                from outputs.report_bundle import generate_all
                results = generate_all(
                    self.session, self.report, self.package,
                    output_dir=self.output_dir, verbose=False,
                )
                pdf = results.get("pdf_report") or results.get("decision_console")
                return {
                    "path": pdf,
                    "caption": f"Evidence report · {sid}",
                    "all_artifacts": {k: v for k, v in results.items()
                                      if k != "output_dir"},
                }
            except Exception as e:
                log.warning("report_bundle failed, falling back: %s", e)

        # Path B — Supabase-mode. Use the same service the dashboard's
        # /api/evidence-report endpoint calls so the PDF is identical.
        try:
            from llm.evidence_report_service import (
                generate_evidence_report,
                render_evidence_report_pdf,
            )
        except ImportError as e:
            return {"error": f"evidence_report_service unavailable: {e}"}
        try:
            report = generate_evidence_report(sid)
            pdf_path = render_evidence_report_pdf(report, out_dir=self.output_dir)
            return {
                "path": str(pdf_path),
                "caption": f"Evidence report · {sid}",
                "report_id": report.get("report_id"),
                "sign_off_status": report.get("sign_off_status"),
            }
        except Exception as e:
            log.exception("evidence_pdf_supabase_failed")
            return {
                "error": f"{type(e).__name__}: {e}",
                "session_id": sid,
                "hint": ("The Supabase-mode PDF needs ANTHROPIC_API_KEY, "
                         "SUPABASE_URL, and SUPABASE_SERVICE_KEY in the Vite "
                         "server env, plus the session rows populated."),
            }

    def mark_action_done(self, action_key: str) -> dict:
        """Tick the on-deck checklist. Survives screen-sleep via state file."""
        if action_key not in ACTION_KEYS:
            return {"error": f"unknown action: {action_key}",
                    "available": list(ACTION_KEYS)}
        state_path = self.output_dir / f"checklist_{self.view.session_id}.json"
        state: dict = {}
        if state_path.exists():
            try:
                state = json.loads(state_path.read_text())
            except json.JSONDecodeError:
                state = {}
        state[action_key] = True
        state_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
        return {"action_key": action_key, "done": True,
                "completed": sorted(k for k, v in state.items() if v)}

    # ------------------------------------------------------------ Tier 3

    def open_tab(self, tab_id: str) -> dict:
        """Hint the dashboard to focus a tab. Use only when officer asks."""
        if tab_id not in TAB_IDS:
            return {"error": f"unknown tab: {tab_id}",
                    "available": list(TAB_IDS)}
        hint_path = self.output_dir / "tab_hint.json"
        hint_path.write_text(
            json.dumps({"session_id": self.view.session_id,
                        "tab_id": tab_id, "label": TAB_IDS[tab_id]}),
            encoding="utf-8")
        return {"tab_id": tab_id, "label": TAB_IDS[tab_id],
                "hint_path": str(hint_path)}


# ---------------------------------------------------------------- helpers

_HEADLINES = {
    "SIGN": "No material issues. Sign the BDN.",
    "SIGN_WITH_NOTES": "Sign, but annotate the exceptions on the BDN.",
    "SIGN_WITH_LOP": "Sign only with a Letter of Protest served to the barge.",
    "REFUSE_TO_SIGN": "Do not sign. Hold the barge and escalate.",
    "INSUFFICIENT_DATA": "Hold. Evidence is missing; resolve gaps first.",
}


def _headline(verdict: Optional[str]) -> str:
    return _HEADLINES.get(str(verdict), "Verdict pending.")


def _build_checklist(v: ViewBundle) -> list[dict]:
    risk = v.risk
    items: list[dict] = []
    verdict = str(risk.get("verdict", ""))
    if verdict == "REFUSE_TO_SIGN":
        items.append({"key": "hold",
                      "text": "Do not sign — hold the barge alongside."})
    if risk.get("requires_lop"):
        items.append({"key": "lop",
                      "text": "Serve Letter of Protest before disconnection."})
    if risk.get("requires_resample"):
        items.append({"key": "resample",
                      "text": "Witness a fresh MARPOL fuel sample; seal it."})
    if risk.get("requires_surveyor"):
        items.append({"key": "surveyor",
                      "text": "Call an independent surveyor before settlement."})
    if any(a.get("rule_id") == "A21" for a in v.anomalies):
        items.append({"key": "seal",
                      "text": "Verify sample seal number against BDN; photograph."})
    if not v.bdn.get("officer_signed", True):
        items.append({"key": "countersign",
                      "text": "Confirm receiving officer's signature block."})
    if not items:
        items.append({"key": "ok",
                      "text": "No exceptions. Confirm quantity with barge and sign."})
    return items


def _fallback_lop(v: ViewBundle) -> str:
    bdn = v.bdn
    return (
        f"LETTER OF PROTEST (draft)\n\n"
        f"To: Master, {bdn.get('barge_name') or 'Bunker Barge'}\n"
        f"From: Master, {bdn.get('vessel_name')} (IMO {bdn.get('vessel_imo')})\n"
        f"Date: {bdn.get('date')}\n"
        f"Subject: Bunker delivery discrepancy — BDN {bdn.get('bdn_ref') or '—'}\n\n"
        f"We hereby protest the bunker delivery of {bdn.get('quantity_mt')} MT "
        f"{bdn.get('grade')} on the grounds documented in the attached BunkerGuard "
        f"evidence report. Sample seal {bdn.get('sample_seal_no')} is to be retained "
        f"per MARPOL Annex VI Reg. 18(8.2) pending resolution.\n\n"
        f"This protest is served without prejudice to any further rights.\n"
    )


# ---------------------------------------------------------------- tool specs
# Anthropic tool-use schemas. Names match CopilotTools method names exactly.

TOOL_SPECS: list[dict] = [
    {
        "name": "get_verdict_brief",
        "description": "Return the verdict, risk score, top two findings, and the on-deck action checklist for this session. Call this FIRST when the officer asks 'do I sign?', 'what's the verdict?', or any opening question.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "show_anomaly",
        "description": "Return one finding card with measured vs expected values, deviation %, and the regulatory basis. Use when the officer asks 'why?' about a specific rule, or to back up a number you cited.",
        "input_schema": {
            "type": "object",
            "properties": {
                "rule_id": {"type": "string",
                            "description": "Rule code like A02, A_CAP, SEC01."}},
            "required": ["rule_id"],
        },
    },
    {
        "name": "show_chart",
        "description": "Generate a chart PNG and return its path so the chat UI can render it inline. Use when the officer asks to 'see', 'show me', or when a number is easier to grasp visually.",
        "input_schema": {
            "type": "object",
            "properties": {
                "kind": {"type": "string", "enum": list(CHART_KINDS),
                         "description": "quantity = BDN vs MFM bars; mfm_flow = "
                                        "delivery curve + flow rate; risk_breakdown "
                                        "= weighted score components; supplier_history "
                                        "= prior sessions for this supplier."}},
            "required": ["kind"],
        },
    },
    {
        "name": "cite",
        "description": "Return the exact regulatory citation for a rule. Use when the barge master pushes back and the officer needs to quote the regulation verbatim.",
        "input_schema": {
            "type": "object",
            "properties": {"rule_id": {"type": "string"}},
            "required": ["rule_id"],
        },
    },
    {
        "name": "draft_lop",
        "description": "Draft a Letter of Protest based on this session's findings. Use only when the verdict requires a LOP (SIGN_WITH_LOP or REFUSE_TO_SIGN).",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "generate_evidence_pdf",
        "description": "Generate the full evidence bundle (PDF + charts + JSON + decision console) for legal handoff. Use when the officer is ready to share with the Master, surveyor, or MPA.",
        "input_schema": {"type": "object", "properties": {}, "required": []},
    },
    {
        "name": "mark_action_done",
        "description": "Tick one item on the on-deck checklist. Use after the officer confirms they completed an action.",
        "input_schema": {
            "type": "object",
            "properties": {
                "action_key": {"type": "string", "enum": list(ACTION_KEYS)}},
            "required": ["action_key"],
        },
    },
    {
        "name": "open_tab",
        "description": "Focus a dashboard tab. Use ONLY when the officer explicitly asks to see something on the dashboard — never volunteer navigation.",
        "input_schema": {
            "type": "object",
            "properties": {
                "tab_id": {"type": "string", "enum": list(TAB_IDS)}},
            "required": ["tab_id"],
        },
    },
]
