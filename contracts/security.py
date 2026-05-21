"""BunkerGuard security primitives (v0.1, hackathon-grade).

Provides three building blocks for cross-stage trust:
  1. canonical_json  → deterministic bytes for hashing
  2. sha256_hex      → integrity hash
  3. hmac_sha256_hex → per-meter packet authenticity (SEC02)
  4. Ed25519 sign / verify → per-stage authenticity + non-repudiation
  5. verify_chain    → tamper-evident linkage between stage outputs

KEY MANAGEMENT NOTE (hackathon):
  Keys live in `contracts/keys/` for demo only. In production they MUST come
  from KMS / HSM / sealed env vars. The `load_or_create_keypair` helper is
  marked DEMO_ONLY for a reason.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
from pathlib import Path
from typing import Any, Tuple

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import (
    Ed25519PrivateKey,
    Ed25519PublicKey,
)

KEYS_DIR = Path(__file__).parent / "keys"


# ---------- canonical encoding ----------

def canonical_json(obj: Any) -> bytes:
    """Deterministic JSON bytes. Same input → same bytes → same hash, always.

    Excludes the `signature` field so a payload can be signed AFTER serialisation
    without creating a chicken-and-egg loop.
    """
    if isinstance(obj, dict):
        obj = {k: v for k, v in obj.items() if k != "signature"}
    return json.dumps(
        obj,
        sort_keys=True,
        separators=(",", ":"),
        default=str,  # datetimes → ISO
        ensure_ascii=False,
    ).encode("utf-8")


# ---------- hashing ----------

def sha256_hex(data: bytes | str) -> str:
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def hmac_sha256_hex(secret_key: bytes, data: bytes | str) -> str:
    """For MFM packets: proves the packet came from a meter holding `secret_key`.

    Bare sha256 on a packet is recomputable by anyone → useless for SEC02.
    HMAC requires the meter's secret → spoofing detectable.
    """
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hmac.new(secret_key, data, hashlib.sha256).hexdigest()


# --- per-meter shared-secret helpers (DEMO_ONLY: derived deterministically) ---

_METER_KEY_DOMAIN = b"BunkerGuard-MFM-meter-key-v1"


def meter_secret(meter_serial: str) -> bytes:
    """DEMO_ONLY deterministic per-meter key. Production: provisioned at meter
    commissioning (PSK) or rotating via TPM-attested handshake."""
    return hashlib.sha256(_METER_KEY_DOMAIN + meter_serial.encode()).digest()


_HMAC_FIELDS = ("seq_no", "timestamp", "flow_rate_mt_h", "cumulative_mt",
                "density_op_kg_m3", "density_15c_kg_m3", "temp_c",
                "drive_gain_pct", "tube_freq_hz", "direction", "status_code",
                "meter_serial", "prev_packet_sha256")


def packet_canonical(packet: dict) -> bytes:
    """Stable byte representation of a packet for signing. ORDER MATTERS."""
    parts = []
    for k in _HMAC_FIELDS:
        v = packet.get(k)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        elif hasattr(v, "value"):
            v = v.value
        parts.append(f"{k}={v}")
    return "|".join(parts).encode()


def sign_packet(packet: dict, meter_serial: str) -> str:
    """Compute the HMAC a real meter would emit. Used by the mock generator."""
    return hmac_sha256_hex(meter_secret(meter_serial), packet_canonical(packet))


def verify_packet_hmac(packet: dict) -> bool:
    """Verify HMAC matches the meter_secret derived from packet['meter_serial']."""
    expected = sign_packet(packet, packet["meter_serial"])
    actual = packet.get("packet_hmac", "")
    return hmac.compare_digest(expected, actual)


# ---------- Ed25519 signatures ----------

def load_or_create_keypair(name: str) -> Tuple[Ed25519PrivateKey, Ed25519PublicKey]:
    """DEMO_ONLY: persists keys to disk. Replace with KMS in production."""
    KEYS_DIR.mkdir(exist_ok=True)
    priv_path = KEYS_DIR / f"{name}.ed25519.priv"
    pub_path = KEYS_DIR / f"{name}.ed25519.pub"

    if priv_path.exists():
        priv = serialization.load_pem_private_key(priv_path.read_bytes(), password=None)
        assert isinstance(priv, Ed25519PrivateKey)
    else:
        priv = Ed25519PrivateKey.generate()
        priv_path.write_bytes(
            priv.private_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PrivateFormat.PKCS8,
                encryption_algorithm=serialization.NoEncryption(),
            )
        )
        pub_path.write_bytes(
            priv.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            )
        )
    return priv, priv.public_key()


def sign_payload(priv: Ed25519PrivateKey, payload_dict: dict) -> str:
    """Returns base64 Ed25519 signature over canonical_json(payload)."""
    sig = priv.sign(canonical_json(payload_dict))
    return base64.b64encode(sig).decode("ascii")


def verify_payload(pub: Ed25519PublicKey, payload_dict: dict, signature_b64: str) -> bool:
    from cryptography.exceptions import InvalidSignature
    try:
        pub.verify(base64.b64decode(signature_b64), canonical_json(payload_dict))
        return True
    except InvalidSignature:
        return False


# ---------- chain-of-custody ----------

def compute_payload_sha256(payload_dict: dict) -> str:
    """The hash that the NEXT stage will store as `parent_sha256`."""
    return sha256_hex(canonical_json(payload_dict))


def verify_chain(parent_payload: dict, child_parent_sha256: str) -> bool:
    """Stage N+1 calls this on Stage N's payload to detect tampering."""
    return compute_payload_sha256(parent_payload) == child_parent_sha256


__all__ = [
    "canonical_json",
    "sha256_hex",
    "hmac_sha256_hex",
    "meter_secret",
    "packet_canonical",
    "sign_packet",
    "verify_packet_hmac",
    "load_or_create_keypair",
    "sign_payload",
    "verify_payload",
    "compute_payload_sha256",
    "verify_chain",
]
