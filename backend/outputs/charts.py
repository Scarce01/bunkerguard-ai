"""Chart image generators (PNG) for embedding in reports and dashboards.

All functions return ``Path`` to the saved image. ``matplotlib`` Agg backend
is used so no display server is required.

Required: matplotlib. QR code requires ``qrcode[pil]``.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

from .config import BRAND  # noqa: E402

# Module-wide rcParams — dark theme matching pdf cover banner.
plt.rcParams.update({
    "figure.facecolor": BRAND["color_dark_bg"],
    "axes.facecolor": BRAND["color_panel"],
    "axes.edgecolor": BRAND["color_grid"],
    "axes.labelcolor": "#8898B8",
    "text.color": BRAND["color_text"],
    "xtick.color": BRAND["color_axis"],
    "ytick.color": BRAND["color_axis"],
    "grid.color": BRAND["color_grid"],
    "font.family": "monospace",
    "font.size": 9,
    "savefig.facecolor": BRAND["color_dark_bg"],
})

CYAN = BRAND["color_accent"]
RED = BRAND["color_danger"]
ORANGE = BRAND["color_warning"]
GREEN = BRAND["color_success"]
YELLOW = BRAND["color_caution"]
GRAY = BRAND["color_gray"]


def _ensure_path(p: Optional[Path], default_name: str) -> Path:
    if p is None:
        p = Path("./output") / default_name
    p.parent.mkdir(parents=True, exist_ok=True)
    return p


def chart_quantity_comparison(
    bdn_qty: float,
    mfm_qty: float,
    *,
    survey_qty: Optional[float] = None,
    invoice_qty: Optional[float] = None,
    output_path: Optional[Path] = None,
) -> Path:
    """BDN / MFM / Survey / Invoice bar chart with delta annotation."""
    out = _ensure_path(output_path, "chart_quantity.png")

    labels = ["BDN", "MFM"]
    values = [bdn_qty, mfm_qty]
    diff_pct = abs(mfm_qty - bdn_qty) / max(bdn_qty, 1e-9) * 100
    colors = [CYAN, RED if diff_pct > 0.5 else GREEN]

    if survey_qty is not None:
        labels.append("Survey"); values.append(survey_qty); colors.append(YELLOW)
    if invoice_qty is not None:
        labels.append("Invoice"); values.append(invoice_qty); colors.append(GRAY)

    fig, ax = plt.subplots(figsize=(6, 3))
    bars = ax.bar(labels, values, color=colors, width=0.5,
                  edgecolor=BRAND["color_grid"], linewidth=0.5)
    for bar, val in zip(bars, values):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + 2,
                f"{val:.1f} MT", ha="center", va="bottom",
                fontsize=8, color=BRAND["color_text"])

    ax.set_ylabel("Quantity (MT)")
    ax.set_title("Quantity Comparison", fontsize=11, fontweight="bold", color=CYAN)
    ax.grid(axis="y", alpha=0.3)

    if diff_pct > 0.5:
        diff = mfm_qty - bdn_qty
        ax.annotate(
            f"delta {diff:+.1f} MT ({diff_pct:.2f}%)",
            xy=(1, mfm_qty), xytext=(1.5, (bdn_qty + mfm_qty) / 2),
            fontsize=8, color=RED, fontweight="bold",
            arrowprops=dict(arrowstyle="->", color=RED, lw=1),
        )

    plt.tight_layout()
    plt.savefig(str(out), dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out


def chart_mfm_flow_profile(
    mfm_timeline: list[dict],
    bdn_qty: float,
    *,
    output_path: Optional[Path] = None,
) -> Optional[Path]:
    """MFM cumulative flow + per-tick flow rate.

    ``mfm_timeline`` items: ``{"time_min": float, "cumulative_mt": float, "flow_rate": float}``.
    Returns ``None`` if the timeline is empty.
    """
    if not mfm_timeline:
        return None
    out = _ensure_path(output_path, "chart_mfm_flow.png")

    times = [p["time_min"] for p in mfm_timeline]
    cumulative = [p["cumulative_mt"] for p in mfm_timeline]
    flow_rates = [p["flow_rate"] for p in mfm_timeline]

    fig, (ax1, ax2) = plt.subplots(
        2, 1, figsize=(8, 5), height_ratios=[2, 1], sharex=True,
    )

    ax1.plot(times, cumulative, color=CYAN, linewidth=1.5, label="MFM Cumulative")
    ax1.axhline(y=bdn_qty, color=RED, linestyle="--", linewidth=1, alpha=0.7,
                label=f"BDN Target ({bdn_qty:.1f} MT)")
    ax1.fill_between(times, cumulative, bdn_qty,
                     where=[c < bdn_qty for c in cumulative],
                     alpha=0.1, color=RED)
    ax1.set_ylabel("Cumulative (MT)")
    ax1.set_title("MFM Flow Profile", fontsize=11, fontweight="bold", color=CYAN)
    ax1.legend(fontsize=7, loc="upper left")
    ax1.grid(alpha=0.3)

    ax2.fill_between(times, flow_rates, alpha=0.3, color=CYAN)
    ax2.plot(times, flow_rates, color=CYAN, linewidth=1)
    ax2.set_ylabel("Flow Rate (MT/h)")
    ax2.set_xlabel("Time (minutes)")
    ax2.grid(alpha=0.3)

    plt.tight_layout()
    plt.savefig(str(out), dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out


def chart_risk_breakdown(
    risk: dict,
    *,
    output_path: Optional[Path] = None,
) -> Path:
    """Horizontal bar of weighted risk components."""
    out = _ensure_path(output_path, "chart_risk.png")

    comp = risk.get("components", {})
    weighted_dict = risk.get("weighted", {})
    labels = [
        "Anomaly Severity\n(40%)",
        "Supplier History\n(25%)",
        "Doc Completeness\n(15%)",
        "Realtime Deviation\n(20%)",
    ]
    raw = [
        comp.get("severity_score", 0),
        comp.get("supplier_score", 0),
        comp.get("doc_score", 0),
        comp.get("realtime_score", 0),
    ]
    weighted = [
        weighted_dict.get("anomaly_x40", raw[0] * 0.4),
        weighted_dict.get("supplier_x25", raw[1] * 0.25),
        weighted_dict.get("doc_x15", raw[2] * 0.15),
        weighted_dict.get("realtime_x20", raw[3] * 0.2),
    ]

    colors = [
        RED if w > 15 else ORANGE if w > 8 else YELLOW if w > 3 else GREEN
        for w in weighted
    ]

    fig, ax = plt.subplots(figsize=(6, 3))
    bars = ax.barh(labels, weighted, color=colors, height=0.5,
                   edgecolor=BRAND["color_grid"])
    for bar, w, r in zip(bars, weighted, raw):
        ax.text(bar.get_width() + 0.5, bar.get_y() + bar.get_height() / 2,
                f"{w:.1f} (raw: {r:.1f})", va="center",
                fontsize=7, color="#8898B8")

    ax.set_xlabel("Weighted Score")
    ax.set_title(
        f"Risk Score: {risk.get('risk_score', '?')}/100 ({risk.get('category', '?')})",
        fontsize=11, fontweight="bold", color=CYAN,
    )
    ax.set_xlim(0, max(max(weighted) * 1.5, 20))
    ax.grid(axis="x", alpha=0.3)

    plt.tight_layout()
    plt.savefig(str(out), dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out


def chart_supplier_history(
    supplier_name: str,
    history: list[dict],
    *,
    output_path: Optional[Path] = None,
) -> Optional[Path]:
    """Per-session short-delivery % with tolerance + fraud lines."""
    if not history:
        return None
    out = _ensure_path(output_path, "chart_supplier.png")

    sessions = [h.get("session", "?") for h in history]
    pcts = [abs(float(h.get("pct", 0))) for h in history]
    colors = [RED if p > 2 else ORANGE if p > 1 else GREEN for p in pcts]

    fig, ax = plt.subplots(figsize=(6, 3))
    ax.bar(sessions, pcts, color=colors, width=0.4, edgecolor=BRAND["color_grid"])

    ax.axhline(y=0.5, color=GREEN, linestyle="--", alpha=0.5, linewidth=0.8,
               label="MFM tolerance (0.5%)")
    ax.axhline(y=2.0, color=RED, linestyle="--", alpha=0.5, linewidth=0.8,
               label="Fraud threshold (2.0%)")

    for i, p in enumerate(pcts):
        ax.text(i, p + 0.1, f"{p:.2f}%", ha="center",
                fontsize=7, color=BRAND["color_text"])

    ax.set_ylabel("Short Delivery (%)")
    ax.set_title(f"Supplier: {supplier_name}", fontsize=11,
                 fontweight="bold", color=CYAN)
    ax.legend(fontsize=7, loc="upper left")
    ax.grid(axis="y", alpha=0.3)
    plt.setp(ax.get_xticklabels(), rotation=30, ha="right", fontsize=7)

    plt.tight_layout()
    plt.savefig(str(out), dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out


def generate_qr_code(
    data: str,
    *,
    output_path: Optional[Path] = None,
    fill_color: str = CYAN,
    back_color: str = BRAND["color_dark_bg"],
) -> Path:
    """QR code for blockchain verification (or any URL).

    Requires ``qrcode[pil]``. Raises ImportError otherwise.
    """
    out = _ensure_path(output_path, "qr_code.png")

    import qrcode  # type: ignore[import-not-found]

    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=8,
        border=2,
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color=fill_color, back_color=back_color)
    img.save(str(out))
    return out
