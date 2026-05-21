"""Stage 2 — Anomaly Detection."""
from .detect import run
from .rules import ALL_RULES

__all__ = ["run", "ALL_RULES"]
