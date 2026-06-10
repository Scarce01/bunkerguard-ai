from ingestion.document import _confidence, _parse_json


def test_parse_json_keeps_only_bdn_contract_fields() -> None:
    parsed = _parse_json(
        '{"bdn_reference":"BDN-10","vessel_name":"MV TEST","quantity_mt":500,"invented":"no"}'
    )
    assert parsed["bdn_reference"] == "BDN-10"
    assert parsed["quantity_mt"] == 500
    assert "invented" not in parsed


def test_confidence_is_data_driven() -> None:
    complete = {
        "bdn_reference": "BDN-10", "vessel_name": "MV TEST", "imo_number": "1234567",
        "supplier_name": "Supplier", "fuel_grade": "VLSFO", "quantity_mt": 500,
        "port": "Singapore", "delivery_date": "2026-06-10",
    }
    complete_score, _ = _confidence(complete)
    sparse_score, _ = _confidence({"vessel_name": "MV TEST"})
    assert complete_score > sparse_score
    assert complete_score >= 80
