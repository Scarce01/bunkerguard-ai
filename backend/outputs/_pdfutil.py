"""Shared PDF helpers.

``reportlab.platypus.Paragraph`` interprets a small XML-like markup language
(``<b>``, ``<font>``, ``<br/>``, ...). That means any dynamic string passed
in must have its ``<``, ``>``, ``&`` escaped first, or reportlab will treat
them as malformed tags and silently drop or garble content. This is exactly
the failure that passes smoke tests but breaks real PDFs containing LLM
output (``"sulphur 0.48% < MARPOL"``) or floor codes (``"A02>3%"``).

Use ``xml_escape`` for cell-level substitutions and ``paragraph_text`` when
you also want ``\\n\\n`` paragraph breaks to render as ``<br/><br/>``.
"""
from __future__ import annotations


def xml_escape(s: object) -> str:
    """Escape a value for safe insertion into a reportlab Paragraph.

    Accepts ``None``/numbers/anything stringifiable; always returns a str.
    Escapes & first to avoid double-encoding.
    """
    if s is None:
        return ""
    text = str(s)
    return (
        text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
    )


def paragraph_text(s: object) -> str:
    """``xml_escape`` plus ``\\n\\n`` -> ``<br/><br/>`` so multi-paragraph
    LLM text keeps its breaks.
    """
    escaped = xml_escape(s)
    # Two-pass so that triple newlines collapse to one extra <br/> pair.
    escaped = escaped.replace("\r\n", "\n")
    return escaped.replace("\n\n", "<br/><br/>").replace("\n", "<br/>")
