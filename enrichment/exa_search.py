"""Small, dependency-free Exa search client with graceful degradation."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from urllib import error, request


def search(query: str, num_results: int = 3) -> dict:
    fetched_at = datetime.now(timezone.utc).isoformat()
    api_key = os.environ.get("EXA_API_KEY", "").strip()
    if not api_key:
        return {"query": query, "hits": [], "fetched_at": fetched_at, "error": "EXA_API_KEY not configured"}

    req = request.Request(
        "https://api.exa.ai/search",
        data=json.dumps({
            "query": query,
            "numResults": num_results,
            "contents": {"highlights": {"maxCharacters": 1200}},
        }).encode(),
        headers={"x-api-key": api_key, "content-type": "application/json"},
        method="POST",
    )
    try:
        with request.urlopen(req, timeout=12) as response:
            payload = json.loads(response.read().decode())
    except (error.URLError, TimeoutError, ValueError) as exc:
        return {"query": query, "hits": [], "fetched_at": fetched_at, "error": str(exc)}

    return {
        "query": query,
        "fetched_at": fetched_at,
        "error": None,
        "hits": [{
            "title": item.get("title", ""),
            "url": item.get("url", ""),
            "highlights": item.get("highlights") or [],
            "published_date": item.get("publishedDate"),
        } for item in payload.get("results", [])],
    }
