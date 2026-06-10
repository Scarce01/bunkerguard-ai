"""S3 persistence helpers for Lambda API artifacts."""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timezone
from typing import Any


def _bucket() -> str:
    bucket = os.environ.get("S3_BUCKET", "").strip()
    if not bucket:
        raise RuntimeError("S3_BUCKET is not configured")
    return bucket


def _safe_part(value: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", value).strip("-") or "unknown"


def put_json(prefix: str, identifier: str, payload: Any) -> str:
    import boto3

    now = datetime.now(timezone.utc)
    key = (
        f"{_safe_part(prefix)}/{_safe_part(identifier)}/"
        f"{now.strftime('%Y/%m/%d/%H%M%S%f')}.json"
    )
    boto3.client("s3").put_object(
        Bucket=_bucket(),
        Key=key,
        Body=json.dumps(payload, default=str, separators=(",", ":")).encode("utf-8"),
        ContentType="application/json",
        ServerSideEncryption="AES256",
    )
    return key


def put_bytes(prefix: str, identifier: str, filename: str, body: bytes, content_type: str) -> str:
    import boto3

    now = datetime.now(timezone.utc)
    key = (
        f"{_safe_part(prefix)}/{_safe_part(identifier)}/"
        f"{now.strftime('%Y/%m/%d/%H%M%S%f')}-{_safe_part(filename)}"
    )
    boto3.client("s3").put_object(
        Bucket=_bucket(),
        Key=key,
        Body=body,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )
    return key


def get_bytes(key: str) -> bytes:
    import boto3

    return boto3.client("s3").get_object(Bucket=_bucket(), Key=key)["Body"].read()
