"""Behavioral tests for the deterministic first-screen insight engine."""

from __future__ import annotations

import numpy as np
import pandas as pd

from app.analysis.insights.discovery import discover_insights
from app.analysis.reporting.report import generate_html_report, generate_markdown_report


def analyze(
    frame: pd.DataFrame,
    *,
    numeric: list[str] | None = None,
    categories: list[str] | None = None,
    dates: list[str] | None = None,
    **kwargs,
) -> dict:
    return discover_insights(
        frame,
        "Synthetic dataset",
        numerical_columns=numeric or [],
        categorical_columns=categories or [],
        datetime_columns=dates or [],
        id_columns=[],
        constant_columns=[
            column
            for column in (numeric or [])
            if frame[column].nunique(dropna=True) <= 1
        ],
        **kwargs,
    )


def finding(result: dict, category: str) -> dict:
    return next(item for item in result["key_findings"] if item["category"] == category)


def test_increasing_time_pattern_uses_sorted_dates_and_independent_values() -> None:
    dates = pd.date_range("2025-01-01", periods=40, freq="D")
    values = np.arange(40, dtype=float) * 2 + 5
    frame = pd.DataFrame({"date": dates, "reading": values}).iloc[::-1].reset_index(drop=True)

    result = analyze(frame, numeric=["reading"], dates=["date"], question="time")
    trend = finding(result, "time")

    # Independent means of the earliest and latest 20% of the ordered dates.
    expected_early = float(np.mean(values[:8]))
    expected_late = float(np.mean(values[-8:]))
    assert trend["evidence"]["early_period_average"] == round(expected_early, 6)
    assert trend["evidence"]["late_period_average"] == round(expected_late, 6)
    assert trend["evidence"]["absolute_change"] == expected_late - expected_early
    assert trend["title"].startswith("reading increased")
    assert trend["chart"]["kind"] == "line"
    assert trend["chart"]["points"][0]["x"] < trend["chart"]["points"][-1]["x"]


def test_summary_does_not_repeat_time_overview_for_the_same_metric_and_dates() -> None:
    dates = pd.date_range("2025-01-01", periods=60, freq="D")
    values = np.arange(60, dtype=float) ** 1.2
    result = analyze(
        pd.DataFrame({"date": dates, "reading": values}),
        numeric=["reading"],
        dates=["date"],
        question="time",
    )

    overview_findings = [
        item for item in result["key_findings"] if item["id"] in {"time-direction", "time-extremes"}
    ]
    assert len(overview_findings) == 1


def test_decreasing_time_pattern_is_reported_with_negative_change() -> None:
    frame = pd.DataFrame(
        {
            "when": pd.date_range("2025-01-01", periods=32, freq="D"),
            "measure": np.arange(32, 0, -1, dtype=float),
        }
    )
    result = analyze(frame, numeric=["measure"], dates=["when"])
    trend = finding(result, "time")
    assert "decreased" in trend["title"]
    assert trend["evidence"]["absolute_change"] < 0


def test_stable_time_pattern_is_not_called_a_growth_trend() -> None:
    values = np.tile([9.0, 11.0], 16)
    frame = pd.DataFrame(
        {"when": pd.date_range("2025-01-01", periods=len(values), freq="D"), "measure": values}
    )
    result = analyze(frame, numeric=["measure"], dates=["when"])
    trend = finding(result, "time")
    assert "changed little" in trend["title"]
    expected_early = float(np.mean(values[:7]))
    expected_late = float(np.mean(values[-7:]))
    assert trend["evidence"]["early_period_average"] == round(expected_early, 6)
    assert trend["evidence"]["late_period_average"] == round(expected_late, 6)
    assert abs(trend["evidence"]["absolute_change"]) < 0.5


def test_repeated_irregular_timestamps_are_aggregated_and_missing_dates_reported() -> None:
    timestamps = pd.date_range("2025-01-01", periods=36, freq="2D").delete([5, 18])
    rows = []
    for index, timestamp in enumerate(timestamps):
        rows.extend(
            [
                {"when": timestamp, "measure": float(index * 3)},
                {"when": timestamp, "measure": float(index * 3 + 2)},
            ]
        )
    rows.extend([{"when": pd.NaT, "measure": 2.0}] * 4)
    frame = pd.DataFrame(rows)
    result = analyze(frame, numeric=["measure"], dates=["when"])
    trend = finding(result, "time")
    assert trend["evidence"]["valid_observations"] == 68
    assert trend["evidence"]["coverage_percentage"] < 100
    assert trend["evidence"]["valid_periods"] == len(timestamps)
    assert len(trend["chart"]["points"]) <= 48


def test_small_dataset_has_no_manufactured_finding() -> None:
    frame = pd.DataFrame({"score": [1, 5, 2, 8, 3, 6, 4]})
    result = analyze(frame, numeric=["score"])
    assert result["key_findings"] == []
    assert "too few" in result["status"]


def test_row_order_alone_does_not_create_a_time_trend() -> None:
    values = np.arange(40, dtype=float)
    result = analyze(pd.DataFrame({"reading": values[::-1]}), numeric=["reading"])
    assert all(item["category"] != "time" for item in result["key_findings"])


def test_month_of_year_pattern_requires_repeat_coverage_across_years() -> None:
    dates = pd.date_range("2022-01-01", periods=36, freq="MS")
    values = np.array([100 + 25 * np.sin((date.month - 1) * np.pi / 6) for date in dates])
    frame = pd.DataFrame({"when": dates, "temperature": values})
    result = analyze(frame, numeric=["temperature"], dates=["when"], question="time")
    seasonal = next(item for item in result["key_findings"] if item["id"] == "month-of-year-pattern")
    assert seasonal["evidence"]["year_month_periods"] == 36
    assert seasonal["evidence"]["months_represented_in_multiple_years"] == 12
    assert seasonal["chart"]["kind"] == "line"
    assert "possible seasonal pattern" in seasonal["interpretation"]

    one_year = frame.iloc[:12].copy()
    one_year_result = analyze(one_year, numeric=["temperature"], dates=["when"])
    assert all(item["id"] != "month-of-year-pattern" for item in one_year_result["key_findings"])


def test_constant_numerical_values_are_not_presented_as_a_pattern() -> None:
    frame = pd.DataFrame({"score": [7.0] * 20})
    result = analyze(frame, numeric=["score"])
    assert result["options"]["metric_columns"] == []
    assert result["key_findings"] == []


def test_categorical_only_data_produces_composition_finding() -> None:
    frame = pd.DataFrame({"response": ["yes"] * 30 + ["no"] * 20 + ["unsure"] * 10})
    result = analyze(frame, categories=["response"])
    category = finding(result, "group")
    assert category["evidence"]["category_count"] == 30
    assert category["evidence"]["category_share_percentage"] == 50.0
    assert category["chart"]["kind"] == "bar"
    assert "does not indicate quality" in category["limitation"]


def test_categorical_model_target_does_not_block_numeric_insights() -> None:
    frame = pd.DataFrame(
        {
            "class": ["pass"] * 20 + ["review"] * 12,
            "score": np.arange(32, dtype=float),
        }
    )
    result = analyze(
        frame,
        numeric=["score"],
        categories=["class"],
        target_column="class",
    )
    assert result["selected_focus"]["metric_column"] == "score"
    assert result["important_metrics"][0]["label"] == "Typical score"


def test_group_comparison_shows_computed_medians_and_caveat() -> None:
    frame = pd.DataFrame(
        {
            "segment": ["A"] * 20 + ["B"] * 20,
            "outcome": list(range(20)) + list(range(100, 120)),
        }
    )
    result = analyze(frame, numeric=["outcome"], categories=["segment"])
    comparison = next(item for item in result["key_findings"] if item["id"] == "group-difference")
    assert comparison["evidence"]["lower_group_median"] == 9.5
    assert comparison["evidence"]["higher_group_median"] == 109.5
    assert comparison["evidence"]["absolute_median_difference"] == 100
    assert "does not show that group membership caused" in comparison["limitation"]


def test_large_measure_values_are_readable_in_findings_and_report_charts() -> None:
    frame = pd.DataFrame(
        {
            "segment": ["A"] * 20 + ["B"] * 20,
            "outcome": [600_000.0] * 20 + [872_200.0] * 20,
        }
    )
    result = analyze(frame, numeric=["outcome"], categories=["segment"])
    comparison = next(item for item in result["key_findings"] if item["id"] == "group-difference")

    assert result["important_metrics"][0]["value"] == "736,100"
    assert "872,200" in comparison["summary"]
    assert "600,000" in comparison["summary"]

    html_report = generate_html_report(
        {
            "dataset_name": "Large values",
            "insight_discovery": {"dataset_overview": "A sample.", "key_findings": [comparison]},
        }
    )
    assert "600,000" in html_report
    assert "872,200" in html_report
    assert "e+05" not in html_report


def test_optional_focus_selects_the_requested_measure_date_and_group() -> None:
    frame = pd.DataFrame(
        {
            "when": pd.date_range("2025-01-01", periods=40, freq="D"),
            "revenue": np.arange(40, dtype=float) * 3,
            "temperature": np.arange(40, dtype=float) * -1,
            "region": ["north", "south"] * 20,
        }
    )
    result = analyze(
        frame,
        numeric=["revenue", "temperature"],
        categories=["region"],
        dates=["when"],
        metric_column="revenue",
        date_column="when",
        group_column="region",
        question="time",
    )
    assert result["selected_focus"] == {
        "metric_column": "revenue",
        "date_column": "when",
        "group_column": "region",
        "question": "time",
    }
    assert any(item["id"] == "time-direction" for item in result["key_findings"])


def test_missing_numeric_values_are_reflected_in_evidence_coverage() -> None:
    values = np.arange(40, dtype=float)
    values[[2, 8, 14, 20, 26, 32, 38]] = np.nan
    frame = pd.DataFrame({"when": pd.date_range("2025-01-01", periods=40), "measure": values})
    result = analyze(frame, numeric=["measure"], dates=["when"])
    assert result["important_metrics"][0]["value"] == f"{np.nanmedian(values):,.4g}"
    trend = finding(result, "time")
    assert trend["evidence"]["valid_observations"] == 33
    assert trend["evidence"]["coverage_percentage"] == 82.5


def test_strong_correlation_is_described_as_association_not_cause() -> None:
    x = np.arange(60, dtype=float)
    frame = pd.DataFrame({"input_measure": x, "outcome": x * 4 + (x % 3)})
    result = analyze(frame, numeric=["input_measure", "outcome"], metric_column="outcome")
    relationship = finding(result, "relationship")
    assert relationship["evidence"]["spearman_rank_correlation"] > 0.99
    assert relationship["finding_type"] == "association"
    assert "Association is not causation" in relationship["limitation"]
    assert "causes" not in relationship["summary"]


def test_unreliable_model_split_does_not_create_prediction_finding() -> None:
    frame = pd.DataFrame({"x": np.arange(80, dtype=float), "y": np.arange(80, dtype=float)})
    model = {
        "target_column": "y",
        "test_samples": 19,
        "cv_folds": 5,
        "summary_table": [
            {"model": "Tree", "r2": 0.9, "is_best": True},
            {"model": "Dummy Regressor (Baseline)", "r2": 0.0, "is_best": False},
        ],
    }
    result = analyze(frame, numeric=["x", "y"], metric_column="y", modeling=model)
    assert all(item["category"] != "model" for item in result["key_findings"])


def test_weak_relationships_produce_an_empty_evidence_state() -> None:
    x = np.arange(40, dtype=float)
    y = np.sin(x * 1.7) * 2
    frame = pd.DataFrame({"x": x, "y": y})
    result = analyze(frame, numeric=["x", "y"], metric_column="y")
    assert all(item["category"] != "relationship" for item in result["key_findings"])


def test_report_puts_findings_first_and_preserves_traceable_chart_evidence() -> None:
    finding_payload = {
        "id": "time-direction",
        "category": "time",
        "finding_type": "observed",
        "title": "Recorded measure increased over time",
        "summary": "The average measure rose by 12 across the observed period.",
        "interpretation": "This is an observed movement, not an explanation of its cause.",
        "limitation": "The descriptive pattern does not establish future movement.",
        "confidence": "moderate",
        "evidence": {"absolute_change": 12.0, "valid_observations": 30},
        "chart": {
            "kind": "line",
            "title": "How the measure changed over time",
            "x_label": "date",
            "y_label": "average measure",
            "points": [
                {"x": "2025-01-01T00:00:00+00:00", "y": 10},
                {"x": "2025-01-03T00:00:00+00:00", "y": 12},
                {"x": "2025-01-11T00:00:00+00:00", "y": 22},
            ],
        },
    }
    payload = {
        "dataset_name": "Evidence sample",
        "insight_discovery": {
            "dataset_overview": "The sample tracks a measure across dates.",
            "status": "One computed pattern is available.",
            "key_findings": [finding_payload],
        },
    }
    markdown = generate_markdown_report(payload)
    html_report = generate_html_report(payload)
    assert markdown.index("## 1. Executive Summary") < markdown.index("## 2. Key Findings")
    assert "**absolute change:** 12.0" in markdown
    assert "does not establish future movement" in markdown
    assert html_report.index("<h2>Key Findings</h2>") < html_report.index("Statistical and model comparison tables")
    assert 'aria-label="How the measure changed over time. Horizontal axis: date. Vertical axis: average measure."' in html_report
    assert "Jan 2025" in html_report
