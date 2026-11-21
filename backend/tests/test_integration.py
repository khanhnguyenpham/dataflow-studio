import pytest
from app.config import Settings
from app.errors import Problem
from app.integration import IntegrationSpec, combine_tables

limits = Settings(database_url="sqlite://")


def test_append_aligns_by_name_and_does_not_modify_inputs():
    a, b = [["001", "A"]], [["B", "002"]]
    columns, rows, stats = combine_tables(["id", "name"], a, ["name", "id"], b, IntegrationSpec(mode="append"), limits)
    assert columns == ["id", "name"] and rows == [["001", "A"], ["002", "B"]]
    assert b == [["B", "002"]] and stats["result_rows"] == 2
    with pytest.raises(Problem) as error:
        combine_tables(["id"], [["1"]], ["code"], [["1"]], IntegrationSpec(mode="append"), limits)
    assert error.value.code == "append_schema"


def test_join_requires_unmatched_consent_and_never_multiplies_lookup_duplicates():
    spec = IntegrationSpec(mode="left", left_key="sku", right_key="sku")
    left = [["P1", "1"], ["P1", "2"], ["P9", "3"], [None, "4"]]
    right = [["P1", "Item"]]
    with pytest.raises(Problem) as error:
        combine_tables(["sku", "qty"], left, ["sku", "name"], right, spec, limits)
    assert error.value.code == "unmatched_keys"
    spec.allow_unmatched = True
    columns, rows, stats = combine_tables(["sku", "qty"], left, ["sku", "name"], right, spec, limits)
    assert columns == ["sku", "qty", "name"] and len(rows) == 4
    assert rows[-1] == [None, "4", None]
    assert stats["unmatched_left_rows"] == 2 and stats["duplicate_left_keys"] == 1
    spec.mode = "inner"
    assert len(combine_tables(["sku", "qty"], left, ["sku", "name"], right, spec, limits)[1]) == 2
    with pytest.raises(Problem) as error:
        combine_tables(["sku", "qty"], left, ["sku", "name"], right + right, spec, limits)
    assert error.value.code == "duplicate_join_keys"
