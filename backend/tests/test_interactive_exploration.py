"""Independent numerical regression tests for interactive exploration."""

import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.analysis.exploration import column_options, explore_dataframe
from app.main import app
from app.models.schemas import ExploreRequest
from app.services.dataset_service import session_store


def test_group_mean_and_sample_sizes_are_calculated_from_filtered_rows():
    df = pd.DataFrame({
        "segment": ["A", "A", "B", "B", "C"],
        "revenue": [10.0, 20.0, 30.0, 50.0, 999.0],
        "region": ["north", "south", "north", "north", "south"],
    })
    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234",
            mode="group",
            metric_column="revenue",
            group_column="segment",
            aggregation="mean",
            filters=[{"column": "region", "kind": "category", "values": ["north"]}],
        ),
    )
    observed = {row["group"]: row for row in result["groups"]}
    assert result["dataset_rows"] == 5
    assert result["filtered_rows"] == 3
    assert observed["A"]["value"] == 10.0
    assert observed["A"]["sample_size"] == 1
    assert observed["B"]["value"] == 40.0
    assert observed["B"]["sample_size"] == 2
    assert result["chart"]["points"][1]["y"] == 40.0


def test_group_count_without_metric_counts_rows_per_category():
    df = pd.DataFrame({"kind": ["x", "x", "y", None], "id": [1, 2, 3, 4]})
    result = explore_dataframe(
        df,
        ExploreRequest(dataset_id="dataset-1234", mode="group", group_column="kind", aggregation="count"),
    )
    counts = {row["group"]: row["value"] for row in result["groups"]}
    assert counts == {"y": 1, "x": 2} or counts == {"x": 2, "y": 1}
    assert result["usable_rows"] == 3


def test_trend_aggregates_duplicate_timestamps_and_reports_missing_months():
    df = pd.DataFrame({
        "recorded": ["2024-01-03", "2024-01-03", "2024-03-21", "2024-04-02"],
        "value": [2.0, 4.0, 8.0, 10.0],
    })
    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234", mode="trend", metric_column="value",
            time_column="recorded", aggregation="mean", frequency="M",
        ),
    )
    assert [(row["period"], row["value"], row["sample_size"]) for row in result["periods"]] == [
        ("2024-01", 3.0, 2), ("2024-03", 8.0, 1), ("2024-04", 10.0, 1)
    ]
    assert result["missing_periods"] == 1
    assert result["absolute_change"] == 7.0
    assert result["percentage_change"] == 7.0 / 3.0 * 100
    assert result["period_over_period_change"] == 2.0


def test_trend_sorts_chronologically_and_avoids_percentage_for_zero_baseline():
    df = pd.DataFrame({
        "when": ["2024-03-02", "2024-01-02", "2024-02-02"],
        "value": [10.0, 0.0, 4.0],
    })
    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234", mode="trend", metric_column="value",
            time_column="when", aggregation="mean", frequency="M",
        ),
    )
    assert result["first_period"]["period"] == "2024-01"
    assert result["last_period"]["period"] == "2024-03"
    assert result["percentage_change"] is None


def test_numeric_and_inclusive_date_filters_use_only_the_selected_rows():
    df = pd.DataFrame({
        "when": pd.date_range("2024-01-01", periods=4, freq="D"),
        "segment": ["north", "north", "south", "south"],
        "value": [10.0, 20.0, 30.0, 100.0],
    })
    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234",
            mode="group",
            metric_column="value",
            group_column="segment",
            aggregation="mean",
            filters=[
                {"column": "value", "kind": "number", "minimum": 20, "maximum": 90},
                {"column": "when", "kind": "date", "start": "2024-01-02", "end": "2024-01-03"},
            ],
        ),
    )

    assert result["filtered_rows"] == 2
    assert {row["group"]: row["value"] for row in result["groups"]} == {"north": 20.0, "south": 30.0}
    assert {row["group"]: row["sample_size"] for row in result["groups"]} == {"north": 1, "south": 1}


def test_trend_period_limit_rejects_oversized_daily_result():
    df = pd.DataFrame({
        "when": pd.date_range("2020-01-01", periods=601, freq="D"),
        "value": [index % 13 for index in range(601)],
    })
    with pytest.raises(ValueError, match="limit is 500"):
        explore_dataframe(
            df,
            ExploreRequest(
                dataset_id="dataset-1234",
                mode="trend",
                metric_column="value",
                time_column="when",
                frequency="D",
            ),
        )


def test_relationship_uses_all_complete_pairs_even_when_chart_is_capped():
    df = pd.DataFrame({"x": list(range(250)), "y": [i * 3 for i in range(250)]})
    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234", mode="relationship", metric_column="x", compare_column="y"
        ),
    )
    assert result["valid_pairs"] == 250
    assert result["pearson_r"] == 1.0
    assert result["spearman_rho"] == pytest.approx(1.0)
    assert len(result["chart"]["points"]) == 160


def test_empty_filter_is_reported_without_fabricated_result():
    df = pd.DataFrame({"group": ["a", "b"], "value": [1.0, 2.0]})
    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234", mode="group", metric_column="value", group_column="group",
            filters=[{"column": "value", "kind": "number", "minimum": 10.0}],
        ),
    )
    assert result["status"] == "empty"
    assert result["filtered_rows"] == 0
    assert result["groups"] == []
    assert result["chart"] is None


def test_identifier_and_invalid_columns_are_rejected():
    df = pd.DataFrame({"customer_id": range(20), "segment": ["a", "b"] * 10, "value": range(20)})
    request = ExploreRequest(
        dataset_id="dataset-1234", mode="group", metric_column="customer_id", group_column="segment"
    )
    try:
        explore_dataframe(df, request)
        raise AssertionError("identifier metric should have been rejected")
    except ValueError as exc:
        assert "Identifier" in str(exc)


def test_column_options_are_capped_and_date_range_is_real():
    df = pd.DataFrame({"label": [f"v{i}" for i in range(120)], "when": pd.date_range("2024-01-01", periods=120)})
    options = column_options(df, "label")
    assert len(options["values"]) == 100
    assert options["truncated"] is True
    dates = column_options(df, "when")
    assert dates["kind"] == "date"
    assert dates["start"] == "2024-01-01"
    assert dates["end"] == "2024-04-29"


def test_date_options_report_unique_observations_and_median_spacing():
    df = pd.DataFrame({"when": ["2024-01-01", "2024-01-01", "2024-01-08", "2024-01-22"]})

    options = column_options(df, "when")

    assert options["observation_count"] == 3
    assert options["span_days"] == 21.0
    assert options["median_interval_days"] == 10.5


def test_exploration_reuses_one_schema_inference_across_category_filters(monkeypatch):
    import app.analysis.exploration as exploration

    original_inspect_schema = exploration.inspect_schema
    calls = 0

    def counted_inspection(frame):
        nonlocal calls
        calls += 1
        return original_inspect_schema(frame)

    monkeypatch.setattr(exploration, "inspect_schema", counted_inspection)
    df = pd.DataFrame({
        "region": ["north"] * 4 + ["south"] * 4,
        "channel": ["web", "store"] * 4,
        "team": ["A"] * 4 + ["B"] * 4,
        "value": list(range(8)),
    })

    result = explore_dataframe(
        df,
        ExploreRequest(
            dataset_id="dataset-1234",
            mode="group",
            metric_column="value",
            group_column="team",
            filters=[
                {"column": "region", "kind": "category", "values": ["north"]},
                {"column": "channel", "kind": "category", "values": ["web"]},
            ],
        ),
    )

    assert calls == 1
    assert result["filtered_rows"] == 2
    assert result["groups"][0]["group"] == "A"
    assert result["groups"][0]["value"] == 1.0


def test_constant_categorical_column_is_not_an_exploration_filter():
    df = pd.DataFrame({"constant": ["same"] * 10, "value": list(range(10))})

    with pytest.raises(ValueError, match="not a supported categorical"):
        column_options(df, "constant")


def test_exploration_endpoint_enforces_session_ownership():
    owner = "o" * 64
    foreign = "f" * 64
    df = pd.DataFrame({"group": ["a", "b", "a", "b"], "value": [1.0, 2.0, 3.0, 4.0]})
    from app.core.security import require_session

    owner_hash = require_session(owner)
    dataset_id = session_store.put(df, "Private Dataset", owner_hash)
    payload = {
        "dataset_id": dataset_id,
        "mode": "group",
        "metric_column": "value",
        "group_column": "group",
        "aggregation": "mean",
    }
    with TestClient(app, headers={"X-Infera-Session": owner}) as client:
        response = client.post("/api/explore", json=payload)
    assert response.status_code == 200
    assert response.json()["filtered_rows"] == 4
    with TestClient(app, headers={"X-Infera-Session": foreign}) as client:
        denied = client.post("/api/explore", json=payload)
    assert denied.status_code == 404
