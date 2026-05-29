"""Prompt templates for Stage 4/5/6.

Each stage exports ``SYSTEM_PROMPT`` (cacheable, static) and
``build_user_prompt(session, report, package, ...)`` which takes the
typed pydantic objects from ``contracts/`` and renders the per-session view.
"""
