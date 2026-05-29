"""LLM layer — Stage 4 (Copilot), Stage 5 (Evidence report), Stage 6 (Reputation).

Wraps the Anthropic SDK so the rest of the pipeline can stay deterministic
Python. All LLM calls go through ``llm.claude_client.call_claude``.
"""
