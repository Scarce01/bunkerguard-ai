"""Output tooling — PDF reports, charts, data exports.

Backend-only. No UI. Each module produces files on disk that the pipeline
runner (or any future UI) can pick up.

Heavy deps (reportlab, matplotlib, pandas, openpyxl, qrcode) are imported
lazily inside the modules that need them, so ``from outputs.config import
session_dir`` works without all deps installed. See ``requirements-outputs.txt``.
"""
