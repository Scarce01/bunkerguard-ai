from carbon import aggregate_supplier_carbon, calculate_carbon_exposure


def test_vlsfo_carbon_calculation() -> None:
    result = calculate_carbon_exposure(500, "VLSFO")
    assert result["emission_factor"] == 3.114
    assert result["estimated_tco2e"] == 1557.0
    assert result["used_fallback_fuel_grade"] is False


def test_missing_fuel_grade_uses_vlsfo_fallback() -> None:
    result = calculate_carbon_exposure(100, None)
    assert result["fuel_grade"] == "VLSFO"
    assert result["estimated_tco2e"] == 311.4
    assert result["used_fallback_fuel_grade"] is True


def test_supplier_aggregation() -> None:
    result = aggregate_supplier_carbon([
        {"supplier_name": "Supplier A", "mfm_qty_mt": 100, "fuel_grade": "VLSFO"},
        {"supplier_name": "Supplier A", "mfm_qty_mt": 50, "fuel_grade": "MGO"},
    ])
    assert result["Supplier A"]["total_fuel_mt"] == 150
    assert result["Supplier A"]["supplier_total_tco2e"] == 471.7
