"""Technician Decision Console — the on-deck go/no-go surface.

This is the artifact a *bunker surveyor / chief engineer* actually uses at the
moment that matters: the delivery just ended, the BDN is in front of them, and
they have minutes to decide whether to sign. The legal evidence PDF and the
judge dashboard both answer "explain everything"; this answers one question —

    "Do I sign this, and what do I do in the next ten minutes?"

Design constraints (they come from the deck, not from us):
  * One screen, glanceable from arm's length. The verdict is the biggest thing
    on the page; colour carries it before any word is read.
  * Works **offline on a tablet** — a barge has no reliable connectivity. So:
    pure stdlib, zero Python deps (never skipped for a missing lib), and the
    HTML is fully self-contained (inline CSS/JS, no CDN, no fonts to fetch).
  * Action over explanation. "Do this now" is a real checklist the surveyor
    works through; progress survives the screen sleeping (localStorage).
  * Honest about uncertainty. A confidence/data-quality strip says plainly how
    much to trust the call, instead of hiding thin coverage behind a number.
  * Audit-ready. The tamper-evident chain hashes and policy version sit in the
    footer so the same screen doubles as proof later.

Consumes the shared ``ViewBundle`` so it stays byte-consistent with the PDF and
CSV renderers — one verdict, one set of numbers, three surfaces.
"""
from __future__ import annotations

import html
from pathlib import Path
from typing import TYPE_CHECKING, Optional

if TYPE_CHECKING:
    from ._extract import ViewBundle

# ---------------------------------------------------------------- presentation

# Verdict -> (label, plain instruction, accent colour, glyph)
_VERDICT = {
    "SIGN": (
        "SIGN",
        "No material issues found. The BDN may be signed.",
        "#2ecc71", "✓",
    ),
    "SIGN_WITH_NOTES": (
        "SIGN — WITH NOTES",
        "Sign, but annotate the noted exceptions on the BDN before it leaves the deck.",
        "#f4c20d", "✎",
    ),
    "SIGN_WITH_LOP": (
        "SIGN — UNDER PROTEST",
        "Sign only with a Letter of Protest served to the barge before disconnection.",
        "#ff7f0e", "⚠",
    ),
    "REFUSE_TO_SIGN": (
        "DO NOT SIGN",
        "Refuse signature. Hold the barge, preserve the sample, and escalate now.",
        "#e84118", "✕",
    ),
    "INSUFFICIENT_DATA": (
        "HOLD — INSUFFICIENT DATA",
        "Do not sign yet. Key evidence is missing; resolve the gaps below first.",
        "#9aa0a6", "?",
    ),
}

_CATEGORY_COLOR = {
    "LOW": "#2ecc71",
    "MODERATE": "#f4c20d",
    "HIGH": "#ff7f0e",
    "CRITICAL": "#e84118",
    "INSUFFICIENT_DATA": "#9aa0a6",
}

_SEV_COLOR = {
    "CRITICAL": "#e84118",
    "HIGH": "#ff7f0e",
    "MEDIUM": "#f4c20d",
    "LOW": "#2ecc71",
}
_SEV_RANK = {"CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}


def _e(v) -> str:
    """HTML-escape any value to text (never trust free-text descriptions)."""
    return html.escape("" if v is None else str(v))


def _num(v, fmt: str = "{:,.1f}", dash: str = "—") -> str:
    try:
        return fmt.format(float(v))
    except (TypeError, ValueError):
        return dash


# ---------------------------------------------------------------- public API

def generate_decision_console(
    view: "ViewBundle",
    *,
    output_dir: Path,
    blockchain: Optional[dict] = None,
) -> Path:
    """Render the on-deck decision console to a self-contained HTML file.

    Returns the path written. No third-party dependency — always renders.
    """
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    path = out / f"DecisionConsole_{view.session_id}.html"
    path.write_text(_render(view, blockchain or {}), encoding="utf-8")
    return path


# ---------------------------------------------------------------- sections

def _render(v: "ViewBundle", blockchain: dict) -> str:
    risk = v.risk
    verdict = str(risk.get("verdict", "INSUFFICIENT_DATA"))
    label, instruction, accent, glyph = _VERDICT.get(
        verdict, _VERDICT["INSUFFICIENT_DATA"])
    category = str(risk.get("category", "—"))
    cat_color = _CATEGORY_COLOR.get(category, "#9aa0a6")
    score = risk.get("risk_score")
    score_txt = str(score) if score is not None else "—"

    sections = [
        _verdict_block(v, label, instruction, accent, glyph, category,
                       cat_color, score_txt),
        _copilot_brief(v),
        _actions_block(v),
        _reasons_block(v),
        _confidence_block(v),
        _facts_block(v),
        _escalation_block(v),
        _footer(v, blockchain),
    ]
    body = "\n".join(s for s in sections if s)
    return _PAGE.format(
        title=f"BunkerGuard · {_e(v.session_id)}",
        accent=accent,
        css=_CSS,
        body=body,
        js=_JS,
        session=_e(v.session_id),
    )


def _verdict_block(v, label, instruction, accent, glyph, category, cat_color,
                   score_txt) -> str:
    risk = v.risk
    bdn = v.bdn
    impact = risk.get("financial_impact")
    dev = None
    for a in v.anomalies:
        if a.get("rule_id") == "A02" and a.get("deviation_pct") is not None:
            dev = a["deviation_pct"]
            break
    impact_txt = "—" if impact is None else f"${_num(impact, '{:,.0f}')}"
    dev_txt = "" if dev is None else f"{dev:+.2f}% qty"
    window = risk.get("dispute_window_hours", 72)

    return f"""
<section class="verdict" style="--accent:{accent}">
  <div class="verdict-head">
    <div class="glyph">{glyph}</div>
    <div class="verdict-text">
      <div class="verdict-label">{_e(label)}</div>
      <div class="verdict-instruction">{_e(instruction)}</div>
    </div>
  </div>
  <div class="verdict-meta">
    <div class="chip" style="--c:{cat_color}">
      <span class="chip-k">RISK</span>
      <span class="chip-v">{score_txt}<small>/100</small></span>
      <span class="chip-s">{_e(category)}</span>
    </div>
    <div class="chip" style="--c:#5a9bf6">
      <span class="chip-k">EXPOSURE</span>
      <span class="chip-v">{impact_txt}</span>
      <span class="chip-s">{_e(dev_txt)}</span>
    </div>
    <div class="chip" style="--c:#9aa0a6">
      <span class="chip-k">DISPUTE WINDOW</span>
      <span class="chip-v" id="countdown">{window}h</span>
      <span class="chip-s">BIMCO / SS&nbsp;648</span>
    </div>
  </div>
  <div class="ident">
    {_e(bdn.get('vessel_name'))} · IMO {_e(bdn.get('vessel_imo'))} ·
    {_num(bdn.get('quantity_mt'))} MT {_e(bdn.get('grade'))} ·
    {_e(bdn.get('supplier_name'))} · {_e(bdn.get('port'))} · {_e(bdn.get('date'))}
  </div>
</section>"""


def _copilot_brief(v) -> str:
    llm = v.llm_analysis or {}
    summary = (llm.get("summary") or "").strip()
    if not summary or summary == "LLM analysis unavailable.":
        return ""
    conf = llm.get("confidence")
    conf_txt = f" · copilot confidence {float(conf):.0%}" if conf else ""
    concerns = llm.get("concerns") or []
    items = "".join(f"<li>{_e(c)}</li>" for c in concerns[:4])
    concern_html = f"<ul class='brief-concerns'>{items}</ul>" if items else ""
    return f"""
<section class="card brief">
  <div class="card-h">CHIEF ENGINEER COPILOT{_e(conf_txt)}</div>
  <p class="brief-summary">{_e(summary)}</p>
  {concern_html}
</section>"""


def _actions_block(v) -> str:
    risk = v.risk
    verdict = str(risk.get("verdict", ""))
    actions: list[tuple[str, str]] = []

    if verdict == "REFUSE_TO_SIGN":
        actions.append(("hold", "Do not sign the BDN — hold the barge alongside."))
    if risk.get("requires_lop"):
        actions.append(("lop", "Serve the Letter of Protest to the barge before disconnection."))
    if risk.get("requires_resample"):
        actions.append(("resample", "Witness a fresh MARPOL fuel sample; seal and log chain of custody."))
    if risk.get("requires_surveyor"):
        actions.append(("surveyor", "Call an independent surveyor to attend before settlement."))

    # Always-on hygiene steps, ordered after the case-specific ones.
    for a in v.anomalies:
        if a.get("rule_id") == "A21":
            actions.append(("seal", "Verify the sample seal number against the BDN and photograph it."))
            break
    if not v.bdn.get("officer_signed", True):
        actions.append(("countersign", "Confirm the receiving officer's signature block is complete."))

    if not actions:
        actions.append(("ok", "No exceptions. Confirm quantities with the barge and sign."))

    rows = ""
    for key, text in actions:
        rows += (
            f"<label class='act' data-act='{_e(key)}'>"
            f"<input type='checkbox'><span class='box'></span>"
            f"<span class='act-text'>{_e(text)}</span></label>"
        )
    return f"""
<section class="card actions">
  <div class="card-h">DO THIS NOW <span class="prog" id="prog"></span></div>
  {rows}
</section>"""


def _reasons_block(v) -> str:
    anomalies = sorted(
        v.anomalies,
        key=lambda a: (-_SEV_RANK.get(str(a.get("severity")), 0),
                       -(a.get("confidence") or 0)),
    )
    if not anomalies:
        return (
            "<section class='card'><div class='card-h'>WHY</div>"
            "<p class='clean'>All 26 checks passed. No anomalies detected.</p></section>"
        )

    floor_codes = {f["code"]: f for f in v.risk.get("floor_triggers", [])}
    rows = ""
    for a in anomalies:
        sev = str(a.get("severity", "LOW"))
        color = _SEV_COLOR.get(sev, "#9aa0a6")
        meas, ref, unit = a.get("measured"), a.get("reference"), a.get("unit") or ""
        nums = ""
        if meas is not None and ref is not None:
            nums = (f"<div class='nums'>measured <b>{_num(meas, '{:g}')}{_e(unit)}</b> "
                    f"vs expected <b>{_num(ref, '{:g}')}{_e(unit)}</b>"
                    + (f" · <b>{a['deviation_pct']:+.2f}%</b>"
                       if a.get("deviation_pct") is not None else "") + "</div>")
        conf = a.get("confidence")
        conf_txt = f"{float(conf):.0%} confidence" if conf else ""
        floored = "<span class='tag-floor'>policy floor</span>" if a.get("rule_id") in floor_codes \
            or any(a.get("rule_id", "") in c for c in floor_codes) else ""
        rows += f"""
    <div class="reason" style="--sev:{color}">
      <div class="reason-h">
        <span class="sev">{_e(sev)}</span>
        <span class="rule">{_e(a.get('rule_id'))} · {_e(a.get('name'))}</span>
        {floored}
      </div>
      <div class="reason-d">{_e(a.get('description'))}</div>
      {nums}
      <div class="reason-cite">{_e(a.get('regulatory_basis'))}{(' · ' + conf_txt) if conf_txt else ''}</div>
    </div>"""
    return f"""
<section class="card">
  <div class="card-h">WHY — {len(anomalies)} finding{'s' if len(anomalies) != 1 else ''}</div>
  {rows}
</section>"""


def _confidence_block(v) -> str:
    dq = v.data_quality
    cov = dq.get("mfm_coverage_pct")
    insufficient = dq.get("insufficient_data")
    ebdn = str(dq.get("ebdn_status", "—"))

    def pill(ok: bool, label: str, detail: str) -> str:
        c = "#2ecc71" if ok else "#e84118"
        mark = "✓" if ok else "✕"
        return (f"<div class='pill' style='--c:{c}'><span class='pm'>{mark}</span>"
                f"<span><b>{_e(label)}</b><br><small>{_e(detail)}</small></span></div>")

    cov_ok = (cov or 0) >= 70
    pills = "".join([
        pill(cov_ok, f"MFM coverage {_num(cov, '{:.0f}')}%",
             "meter stream complete" if cov_ok else "thin stream — treat with care"),
        pill(ebdn == "VERIFIED", f"e-BDN {ebdn}",
             "crypto signature checks out" if ebdn == "VERIFIED" else "authenticity not confirmed"),
        pill(not insufficient,
             "Data sufficient" if not insufficient else "Data INSUFFICIENT",
             "enough evidence to decide" if not insufficient else "missing essential inputs"),
    ])
    reasons = dq.get("reasons") or []
    note = ""
    if reasons:
        note = "<div class='dq-note'>" + " · ".join(_e(r) for r in reasons) + "</div>"
    return f"""
<section class="card">
  <div class="card-h">HOW SURE ARE WE</div>
  <div class="pills">{pills}</div>
  {note}
</section>"""


def _facts_block(v) -> str:
    s, b, bg = v.supplier, v.bdn, v.barge
    rep = s.get("reputation_score")
    flag = str(s.get("flag", "clear"))
    flag_color = {"watchlist": "#ff7f0e", "blocked": "#e84118"}.get(flag, "#2ecc71")
    rows = [
        ("Supplier", f"{_e(s.get('name'))} · MPA {_e(s.get('mpa_licence'))} · "
         f"reputation {_e(rep) if rep is not None else '—'}/100 · "
         f"<span style='color:{flag_color}'>{_e(flag)}</span>"),
        ("Supplier record", f"{_e(s.get('total_sessions'))} sessions · "
         f"{_e(s.get('mismatch_count'))} mismatches · {_e(s.get('critical_count'))} critical · "
         f"{_e(s.get('lop_count'))} LOPs"),
        ("Barge", f"{_e(bg.get('name'))} · IMO {_e(bg.get('imo'))} · MPA {_e(bg.get('mpa_licence'))}"),
        ("Fuel", f"{_e(b.get('grade'))} · {_num(b.get('density_15c'))} kg/m³ @15°C · "
         f"S {_num(b.get('sulphur_pct'), '{:g}')}% · flash {_num(b.get('flash_point'), '{:g}')}°C"),
        ("Sample seal", _e(b.get('sample_seal_no'))),
        ("MFM", f"{_num(v.mfm.get('cumulative_mass'))} MT over {_num(v.mfm.get('duration_hrs'))} h · "
         f"avg {_num(v.mfm.get('avg_flow_rate'))} MT/h · {_e(v.mfm.get('packet_count'))} packets"),
    ]
    body = "".join(f"<div class='fact'><span class='fk'>{_e(k)}</span>"
                   f"<span class='fv'>{val}</span></div>" for k, val in rows)
    return f"""
<details class="card facts">
  <summary class="card-h">VESSEL · SUPPLIER · FUEL</summary>
  {body}
</details>"""


def _escalation_block(v) -> str:
    path = v.risk.get("escalation_path") or []
    if not path:
        return ""
    # tel: links left as placeholders the operator fills per port — but the
    # ladder itself is the value: who, in what order.
    steps = "".join(
        f"<li><span class='step-n'>{i}</span>{_e(role)}</li>"
        for i, role in enumerate(path, 1))
    return f"""
<details class="card">
  <summary class="card-h">ESCALATION LADDER</summary>
  <ol class="escal">{steps}</ol>
</details>"""


def _footer(v, blockchain: dict) -> str:
    chain = v.chain
    payload = chain.get("payload_sha256") or ""
    parent = chain.get("parent_sha256") or ""
    tx = (blockchain or {}).get("tx_hash") or ""
    explorer = (blockchain or {}).get("explorer") or ""
    pv = ""
    for line in v.risk.get("because", []):
        if "Policy version" in line:
            pv = line.split(":", 1)[-1].strip().rstrip(".")
            break
    bc = ""
    if tx:
        link = f"<a href='{_e(explorer)}'>{_e(tx[:18])}…</a>" if explorer else _e(tx[:18] + "…")
        bc = f"<div>Notarized on-chain · {link}</div>"
    return f"""
<footer class="chain">
  <div class="card-h">TAMPER-EVIDENT CHAIN OF CUSTODY</div>
  <div class="hash">payload sha256 · <code>{_e(payload[:48])}…</code></div>
  <div class="hash">parent sha256 · <code>{_e(parent[:48])}…</code></div>
  {bc}
  <div class="meta">Session {_e(v.session_id)} · generated {_e(v.generated_at)}{(' · policy ' + _e(pv)) if pv else ''}</div>
  <div class="disclaimer">Decision support only. The deterministic Stage 3 verdict is authoritative;
  the attending surveyor signs.</div>
</footer>"""


# ---------------------------------------------------------------- static assets

_CSS = """
:root{--bg:#0d1117;--card:#161b22;--line:#222b36;--ink:#e6edf3;--dim:#8b949e}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
body{margin:0;background:var(--bg);color:var(--ink);
 font:16px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
 padding:14px;max-width:760px;margin:0 auto}
.verdict{border-radius:18px;padding:20px;margin-bottom:14px;
 background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 26%,var(--card)),var(--card));
 border:2px solid var(--accent)}
.verdict-head{display:flex;gap:16px;align-items:center}
.glyph{flex:0 0 64px;height:64px;border-radius:16px;background:var(--accent);color:#0d1117;
 font-size:38px;font-weight:800;display:flex;align-items:center;justify-content:center}
.verdict-label{font-size:30px;font-weight:800;letter-spacing:.5px;line-height:1.1;color:var(--accent)}
.verdict-instruction{margin-top:5px;font-size:15px;color:var(--ink)}
.verdict-meta{display:flex;gap:10px;margin-top:16px;flex-wrap:wrap}
.chip{flex:1 1 150px;background:#0d1117aa;border:1px solid var(--line);border-left:4px solid var(--c);
 border-radius:12px;padding:9px 12px}
.chip-k{display:block;font-size:10px;letter-spacing:.12em;color:var(--dim)}
.chip-v{display:block;font-size:24px;font-weight:800;color:var(--c)}
.chip-v small{font-size:12px;color:var(--dim);font-weight:600}
.chip-s{display:block;font-size:11px;color:var(--dim)}
.ident{margin-top:14px;font-size:12.5px;color:var(--dim);line-height:1.5}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:12px}
.card-h{font-size:11px;letter-spacing:.14em;color:var(--dim);font-weight:700;margin-bottom:10px}
details.card>summary.card-h{cursor:pointer;list-style:none;margin-bottom:0}
details.card[open]>summary.card-h{margin-bottom:12px}
details.card>summary::-webkit-details-marker{display:none}
details.card>summary::after{content:" ▸";color:var(--dim)}
details.card[open]>summary::after{content:" ▾"}
.brief-summary{margin:0;font-size:15px}
.brief-concerns{margin:10px 0 0;padding-left:18px;color:var(--dim);font-size:13px}
.act{display:flex;align-items:center;gap:13px;padding:13px 4px;border-bottom:1px solid var(--line);cursor:pointer}
.act:last-child{border-bottom:none}
.act input{position:absolute;opacity:0;width:0;height:0}
.box{flex:0 0 26px;height:26px;border:2px solid var(--dim);border-radius:7px;display:flex;
 align-items:center;justify-content:center;transition:.12s}
.act input:checked+.box{background:#2ecc71;border-color:#2ecc71}
.act input:checked+.box::after{content:"✓";color:#0d1117;font-weight:800;font-size:17px}
.act-text{font-size:15.5px}
.act input:checked~.act-text{color:var(--dim);text-decoration:line-through}
.prog{float:right;letter-spacing:0;color:var(--dim)}
.reason{border-left:4px solid var(--sev);background:#0d1117;border-radius:10px;
 padding:11px 13px;margin-bottom:9px}
.reason-h{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
.sev{font-size:10px;font-weight:800;letter-spacing:.08em;color:#0d1117;background:var(--sev);
 padding:2px 7px;border-radius:5px}
.rule{font-weight:700;font-size:14px}
.tag-floor{font-size:10px;color:#f4c20d;border:1px solid #f4c20d66;border-radius:5px;padding:1px 6px}
.reason-d{margin-top:6px;font-size:14px}
.nums{margin-top:5px;font-size:13px;color:var(--ink)}
.reason-cite{margin-top:5px;font-size:11.5px;color:var(--dim)}
.clean{color:#2ecc71;margin:0}
.pills{display:flex;gap:9px;flex-wrap:wrap}
.pill{flex:1 1 200px;display:flex;gap:10px;align-items:center;background:#0d1117;
 border:1px solid var(--line);border-left:4px solid var(--c);border-radius:10px;padding:10px 12px}
.pm{font-size:18px;color:var(--c);font-weight:800}
.pill small{color:var(--dim)}
.dq-note{margin-top:9px;font-size:12px;color:#f4c20d}
.fact{display:flex;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:13.5px}
.fact:last-child{border-bottom:none}
.fk{flex:0 0 120px;color:var(--dim)}
.fv{flex:1}
.escal{margin:0;padding:0;list-style:none}
.escal li{display:flex;align-items:center;gap:11px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px}
.escal li:last-child{border-bottom:none}
.step-n{flex:0 0 24px;height:24px;border-radius:50%;background:#21303f;color:var(--ink);
 display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.chain{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin-bottom:24px}
.hash{font-size:11.5px;color:var(--dim);margin-bottom:4px;word-break:break-all}
.chain code{color:#5a9bf6}
.chain a{color:#5a9bf6}
.meta{margin-top:9px;font-size:11.5px;color:var(--dim)}
.disclaimer{margin-top:8px;font-size:11px;color:var(--dim);font-style:italic}
@media print{body{background:#fff;color:#000;max-width:none}
 .card,.verdict,.chain{break-inside:avoid;border-color:#bbb}}
"""

_JS = """
(function(){
  var KEY='bg_console_'+SESSION;
  var saved={};
  try{saved=JSON.parse(localStorage.getItem(KEY)||'{}')}catch(e){}
  var acts=document.querySelectorAll('.act input');
  var prog=document.getElementById('prog');
  function refresh(){
    var done=0;acts.forEach(function(i){if(i.checked)done++});
    if(prog)prog.textContent=done+'/'+acts.length+' done';
  }
  acts.forEach(function(inp){
    var k=inp.closest('.act').getAttribute('data-act');
    if(saved[k])inp.checked=true;
    inp.addEventListener('change',function(){
      saved[k]=inp.checked;
      try{localStorage.setItem(KEY,JSON.stringify(saved))}catch(e){}
      refresh();
    });
  });
  refresh();
})();
"""

_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="{accent}">
<title>{title}</title>
<style>{css}</style>
</head>
<body>
{body}
<script>var SESSION={session!r};{js}</script>
</body>
</html>"""
