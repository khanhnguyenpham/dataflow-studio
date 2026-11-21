from decimal import Decimal
import pytest
from app.aggregation import AggregateSpec, aggregate
from app.config import Settings
from app.errors import Problem

limits = Settings(database_url="sqlite://")


def test_exact_decimals_filters_and_weighted_overall_mean():
    columns = ["team", "amount", "state"]
    records = [["A", "0.1", "ok"], ["A", "0.2", "ok"], ["B", "0.9", "ok"], ["B", None, "ok"], ["B", "999", "cancelled"]]
    spec = AggregateSpec(
        group_by="team",
        operation="average",
        measure="amount",
        filters=[{"op": "filter", "column": "state", "operator": "eq", "value": "ok"}],
    )
    result = aggregate(columns, records, spec, limits)
    assert result["items"] == [{"group": "A", "value": "0.15", "rows": 2}, {"group": "B", "value": "0.9", "rows": 2}]
    assert Decimal(result["metrics"]["overall"]) == Decimal("0.4")
    assert result["metrics"]["missing_values"] == 1 and result["metrics"]["filtered_rows"] == 4
    spec.operation = "sum"
    assert aggregate(columns, records, spec, limits)["metrics"]["overall"] == "1.2"


def test_analytics_never_hides_bad_numbers_or_invents_empty_totals():
    spec = AggregateSpec(group_by="team", operation="sum", measure="amount")
    with pytest.raises(Problem) as error:
        aggregate(["team", "amount"], [["A", "three"]], spec, limits)
    assert error.value.code == "invalid_measure"
    assert aggregate(["team", "amount"], [["A", None]], spec, limits)["metrics"]["overall"] is None
    spec.chart_type = "pie"
    with pytest.raises(Problem) as error:
        aggregate(["team", "amount"], [["A", "-1"]], spec, limits)
    assert error.value.code == "pie_values"
    spec.chart_type = "line"
    with pytest.raises(Problem) as error:
        aggregate(["team", "amount"], [["Category A", "1"]], spec, limits)
    assert error.value.code == "line_axis"


def test_count_includes_missing_group_and_empty_filtered_output():
    spec = AggregateSpec(group_by="team", operation="count")
    result = aggregate(["team"], [["A"], [None], ["A"]], spec, limits)
    assert result["items"] == [{"group": "A", "value": "2", "rows": 2}, {"group": None, "value": "1", "rows": 1}]
    spec = AggregateSpec(
        group_by="team",
        operation="count",
        filters=[{"op": "filter", "column": "team", "operator": "eq", "value": "missing"}],
    )
    result = aggregate(["team"], [["A"]], spec, limits)
    assert result["items"] == [] and result["metrics"]["filtered_rows"] == 0
