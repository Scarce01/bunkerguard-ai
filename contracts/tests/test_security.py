"""Smoke test: signatures + chain-of-custody + tamper detection.

Run:  python3 -m contracts.tests.test_security
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from contracts import (
    AnomalyReport,
    RiskPackage,
    SessionInput,
    compute_payload_sha256,
    hmac_sha256_hex,
    load_or_create_keypair,
    sign_payload,
    verify_chain,
    verify_payload,
)

EX = Path(__file__).parent.parent / "examples"


def _load(name: str) -> dict:
    return json.loads((EX / name).read_text())


def main() -> None:
    # --- 1. examples still validate after hardening ---
    s_dict = _load("session_input_example.json")
    a_dict = _load("anomaly_report_example.json")
    r_dict = _load("risk_package_example.json")
    SessionInput.model_validate(s_dict)
    AnomalyReport.model_validate(a_dict)
    RiskPackage.model_validate(r_dict)
    print("[1] examples validate ......................... OK")

    # --- 2. Ed25519 sign + verify roundtrip per stage ---
    keys = {name: load_or_create_keypair(name) for name in ("stage1", "stage2", "stage3")}

    s_dict["signed_by"] = "stage1"
    s_dict["signature"] = sign_payload(keys["stage1"][0], s_dict)
    assert verify_payload(keys["stage1"][1], s_dict, s_dict["signature"])
    print("[2] Ed25519 sign/verify (Stage 1) ............. OK")

    # --- 3. chain: Stage 2 embeds parent_sha256(Stage 1) ---
    a_dict["parent_sha256"] = compute_payload_sha256(s_dict)
    a_dict["signed_by"] = "stage2"
    a_dict["signature"] = sign_payload(keys["stage2"][0], a_dict)
    assert verify_chain(s_dict, a_dict["parent_sha256"])
    print("[3] chain Stage 1 -> Stage 2 verified ......... OK")

    # --- 4. chain: Stage 3 embeds parent_sha256(Stage 2) + own payload hash ---
    r_dict["parent_sha256"] = compute_payload_sha256(a_dict)
    r_dict["payload_sha256"] = compute_payload_sha256(r_dict)
    r_dict["signed_by"] = "stage3"
    r_dict["signature"] = sign_payload(keys["stage3"][0], r_dict)
    assert verify_chain(a_dict, r_dict["parent_sha256"])
    print("[4] chain Stage 2 -> Stage 3 verified ......... OK")

    # --- 5. tamper detection: flip CRITICAL -> LOW after signing ---
    tampered = json.loads(json.dumps(a_dict))
    tampered["anomalies"][0]["severity"] = "LOW"
    tampered["critical_count"] = 0
    tampered["low_count"] = 1
    sig_ok = verify_payload(keys["stage2"][1], tampered, tampered["signature"])
    chain_ok = verify_chain(tampered, r_dict["parent_sha256"])
    assert not sig_ok, "tamper should break signature"
    assert not chain_ok, "tamper should break chain into Stage 3"
    print("[5] tampered AnomalyReport detected ........... OK (sig & chain both fail)")

    # --- 6. HMAC vs bare hash: spoof attempt with wrong meter secret ---
    real_secret = b"meter-MFM-SG-118-A-secret"
    attacker_secret = b"attacker-guess"
    packet = b'{"seq_no":42,"flow_rate_mt_h":95.0}'
    real_mac = hmac_sha256_hex(real_secret, packet)
    fake_mac = hmac_sha256_hex(attacker_secret, packet)
    assert real_mac != fake_mac
    print("[6] MFM HMAC blocks spoofed packets ........... OK")

    print("\nALL SECURITY CHECKS PASSED at", datetime.now(timezone.utc).isoformat())


if __name__ == "__main__":
    main()
