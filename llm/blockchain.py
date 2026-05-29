"""Sepolia testnet notarization.

Real tx if WALLET_PRIVATE_KEY is set (requires ``pip install web3``).
Otherwise returns a deterministic mock hash so demos still look legit.

Env:
    SEPOLIA_RPC_URL    — RPC endpoint (default: https://rpc.sepolia.org)
    WALLET_PRIVATE_KEY — hex-encoded private key (optional)
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Optional

log = logging.getLogger("bunkerguard.llm.blockchain")

SEPOLIA_RPC = os.getenv("SEPOLIA_RPC_URL", "https://rpc.sepolia.org")
PRIVATE_KEY = os.getenv("WALLET_PRIVATE_KEY", "")
CHAIN_ID = 11155111  # Sepolia


def write_to_chain(
    session_id: str,
    bdn_hash: str,
    mfm_hash: str,
    validation_hash: str,
    risk_score: int,
) -> dict:
    """Write validation hashes as transaction data on Sepolia.

    Returns dict with: tx_hash, chain, status, explorer (when real).
    Falls back to a mock hash when no key is set or web3 isn't installed.
    """
    if not PRIVATE_KEY:
        return _mock_tx(session_id, bdn_hash, validation_hash)

    try:
        return _real_tx(session_id, bdn_hash, mfm_hash, validation_hash, risk_score)
    except ImportError:
        log.warning("web3_not_installed_using_mock")
        return _mock_tx(session_id, bdn_hash, validation_hash)
    except Exception as e:
        log.exception("chain_write_failed")
        return {
            "tx_hash": "error",
            "error": str(e),
            "status": "failed",
            "chain": "Ethereum Sepolia",
        }


def _mock_tx(session_id: str, bdn_hash: str, validation_hash: str) -> dict:
    """Deterministic fake transaction hash so demos are reproducible."""
    digest = hashlib.sha256(
        f"{session_id}|{bdn_hash}|{validation_hash}".encode("utf-8")
    ).hexdigest()
    return {
        "tx_hash": f"0x{digest}",
        "chain": "mock",
        "status": "simulated",
        "explorer": None,
    }


def _real_tx(
    session_id: str,
    bdn_hash: str,
    mfm_hash: str,
    validation_hash: str,
    risk_score: int,
) -> dict:
    """Submit a data-only self-transfer carrying the hashes as calldata."""
    from web3 import Web3  # type: ignore[import-not-found]

    w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC))
    account = w3.eth.account.from_key(PRIVATE_KEY)

    payload = json.dumps({
        "session": session_id,
        "bdn": bdn_hash,
        "mfm": mfm_hash,
        "val": validation_hash,
        "risk": int(risk_score),
    }, sort_keys=True).encode("utf-8")

    tx = {
        "to": account.address,
        "value": 0,
        "data": w3.to_hex(payload),
        "gas": 50_000,
        "gasPrice": w3.eth.gas_price,
        "nonce": w3.eth.get_transaction_count(account.address),
        "chainId": CHAIN_ID,
    }

    signed = w3.eth.account.sign_transaction(tx, PRIVATE_KEY)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = w3.eth.send_raw_transaction(raw)
    tx_hex = tx_hash.hex() if hasattr(tx_hash, "hex") else str(tx_hash)

    return {
        "tx_hash": tx_hex,
        "chain": "Ethereum Sepolia",
        "status": "submitted",
        "explorer": f"https://sepolia.etherscan.io/tx/{tx_hex}",
    }
