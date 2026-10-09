"""Deterministic, evidence-backed findings for the first analysis view."""

from __future__ import annotations

import math
import re
from typing import Any, Literal

import numpy as np
import pandas as pd

Question = Literal["automatic", "time", "groups", "relationships", "distributions"]

_METRIC_WORDS = {
    "amount", "average", "cost", "count", "earnings", "grade", "measure",
    "price", "profit", "rate", "revenue", "score", "sales", "spend",
    "temperature", "total", "value", "volume", "weight",
}
_QUESTION_CATEGORY = {
    "time": "time",
    "groups": "group",
    "relationships": "relationship",
    "distributions": "distribution",
}


def _safe_number(value: Any) -> float | None:
    number = float(value)
    return number if math.isfinite(number) else None


def _format_number(value: float) -> str:
    """Format findings for people while leaving full precision in evidence."""
    if abs(value) >= 1_000:
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    return f"{value:.4g}"


def _label(value: Any, limit: int = 48) -> str:
    text = str(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _column_name_score(name: str) -> int:
    words = set(re.findall(r"[a-z0-9]+", name.casefold()))
    return len(words & _METRIC_WORDS)


def _confidence(observations: int, coverage: float) -> str:
    if observations >= 30 and coverage >= 0.85:
        return "high"
    if observations >= 12 and coverage >= 0.7:
        return "moderate"
    return "exploratory"


def _chart(
    kind: str,
    title: str,
    x_label: str,
    y_label: str,
    points: list[dict[str, Any]],
) -> dict[str, Any]:
    return {
        "kind": kind,
        "title": title,
        "x_label": x_label,
        "y_label": y_label,
        "points": points,
    }


def _numeric_series(df: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(df[column], errors="coerce").replace([np.inf, -np.inf], np.nan)


def _histogram_chart(series: pd.Series, column: str) -> dict[str, Any] | None:
    values = series.dropna().to_numpy(dtype=float)
    if len(values) < 8 or np.ptp(values) == 0:
        return None
    counts, edges = np.histogram(
        values,
        bins=min(12, max(5, int(np.sqrt(len(values))))),
    )
    points = [
        {
            "x": f"{_format_number(float(edges[i]))}–{_format_number(float(edges[i + 1]))}",
            "y": int(count),
            "detail": f"{int(count)} observations",
        }
        for i, count in enumerate(counts)
    ]
    return _chart("histogram", f"How {column} values are distributed", column, "Records", points)


def _resolve_date_values(df: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_datetime(df[column], errors="coerce", format="mixed", utc=True)


def _time_candidate(
    df: pd.DataFrame,
    metric: str,
    date_column: str,
    question: Question,
) -> dict[str, Any] | None:
    timestamps = _resolve_date_values(df, date_column)
    values = _numeric_series(df, metric)
    frame = pd.DataFrame({"time": timestamps, "value": values}).dropna()
    if len(frame) < 8 or frame["time"].nunique() < 4:
        return None
    coverage = len(frame) / max(1, len(df))
    if coverage < 0.5:
        return None

    span_days = max(0.0, (frame["time"].max() - frame["time"].min()).total_seconds() / 86400)
    frequency = "D" if span_days <= 90 else ("W-SUN" if span_days <= 540 else "M")
    frame["period"] = (
        frame["time"].dt.floor("D")
        if frequency == "D"
        else frame["time"].dt.tz_localize(None).dt.to_period(frequency).dt.start_time
    )
    periods = frame.groupby("period", sort=True)["value"].mean().dropna()
    if len(periods) < 4:
        # Irregular timestamps may span only a few calendar bins. Exact timestamps
        # still provide a valid ordering when enough distinct observations exist.
        periods = frame.groupby("time", sort=True)["value"].mean().dropna()
    if len(periods) < 4:
        return None

    edge_size = max(1, int(math.ceil(len(periods) * 0.2)))
    first_mean = float(periods.iloc[:edge_size].mean())
    last_mean = float(periods.iloc[-edge_size:].mean())
    change = last_mean - first_mean
    scale = max(abs(first_mean), abs(last_mean), float(periods.std(ddof=0)), 1e-12)
    relative_change = abs(change) / scale
    stable = relative_change < 0.05
    direction = "stable" if stable else ("increased" if change > 0 else "decreased")
    percent_change = (change / first_mean * 100) if first_mean > 1e-12 else None

    all_points = [
        {"x": stamp.isoformat(), "y": _safe_number(value), "detail": f"Average: {_format_number(float(value))}"}
        for stamp, value in periods.items()
    ]
    if len(all_points) > 48:
        take = np.linspace(0, len(all_points) - 1, 48, dtype=int)
        all_points = [all_points[int(index)] for index in take]

    if stable:
        title = f"{metric} changed little across the observed dates"
        summary = (
            f"The average {metric} was broadly similar at the beginning and end of the observed period."
        )
    else:
        title = f"{metric} {direction} across the observed dates"
        summary = (
            f"The average {metric} {direction} by {_format_number(abs(change))} between the early and late "
            "parts of the observed period."
        )
    confidence = _confidence(len(frame), coverage)
    focus_boost = 1.2 if question in ("automatic", "time") else 1.0
    magnitude = 0.28 if stable else min(1.0, math.tanh(relative_change))
    score = focus_boost * magnitude * min(1.0, len(frame) / 30) * coverage
    return {
        "_score": score,
        "id": "time-direction",
        "category": "time",
        "finding_type": "observed",
        "title": title,
        "summary": summary,
        "interpretation": (
            f"This describes how recorded {metric} values moved over time; it does not explain why they changed."
        ),
        "limitation": (
            "This is a descriptive comparison. Irregular sampling and missing dates can affect the shape; "
            "it does not identify a cause or establish a future pattern."
        ),
        "confidence": confidence,
        "evidence": {
            "time_column": date_column,
            "metric_column": metric,
            "valid_observations": int(len(frame)),
            "valid_periods": int(len(periods)),
            "coverage_percentage": round(coverage * 100, 2),
            "early_period_average": round(first_mean, 6),
            "late_period_average": round(last_mean, 6),
            "absolute_change": round(change, 6),
            "percentage_change": round(percent_change, 4) if percent_change is not None else None,
            "first_observed_period": periods.index[0].isoformat(),
            "last_observed_period": periods.index[-1].isoformat(),
        },
        "chart": _chart(
            "line",
            f"How average {metric} changed over time",
            date_column,
            f"Average {metric}",
            all_points,
        ),
    }


def _seasonality_candidate(
    df: pd.DataFrame,
    metric: str,
    date_column: str,
    question: Question,
) -> dict[str, Any] | None:
    frame = pd.DataFrame(
        {
            "time": _resolve_date_values(df, date_column),
            "value": _numeric_series(df, metric),
        }
    ).dropna()
    if len(frame) < 24:
        return None
    frame["year"] = frame["time"].dt.year
    frame["month"] = frame["time"].dt.month
    year_month = frame.groupby(["year", "month"], sort=True)["value"].mean()
    supported_years = year_month.groupby(level="month").size()
    supported_months = supported_years[supported_years >= 2].index
    if len(supported_months) < 9:
        return None
    month_averages = (
        year_month[year_month.index.get_level_values("month").isin(supported_months)]
        .groupby(level="month")
        .mean()
    )
    if len(month_averages) < 9:
        return None
    low_month = int(month_averages.idxmin())
    high_month = int(month_averages.idxmax())
    low = float(month_averages.loc[low_month])
    high = float(month_averages.loc[high_month])
    difference = high - low
    scale = max(abs(float(frame["value"].median())), float(frame["value"].std(ddof=0)), 1e-12)
    relative_amplitude = difference / scale
    if relative_amplitude < 0.25:
        return None
    coverage = len(frame) / max(1, len(df))
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    points = [
        {
            "x": months[int(month) - 1],
            "y": round(float(value), 6),
            "detail": f"Average {metric}: {_format_number(float(value))}; observed in {int(supported_years.loc[month])} years",
        }
        for month, value in month_averages.items()
    ]
    focus_boost = 1.2 if question in ("automatic", "time") else 1.0
    return {
        "_score": focus_boost * min(1.0, math.tanh(relative_amplitude)) * min(1.0, len(frame) / 36) * coverage,
        "id": "month-of-year-pattern",
        "category": "time",
        "finding_type": "observed",
        "title": f"Recorded {metric} varied across calendar months",
        "summary": (
            f"Month averages ranged from {_format_number(low)} in {months[low_month - 1]} to "
            f"{_format_number(high)} in {months[high_month - 1]}; each shown month is represented in at least two years."
        ),
        "interpretation": (
            f"The repeated month-of-year differences suggest a possible seasonal pattern in recorded {metric}."
        ),
        "limitation": (
            "This is a descriptive month-of-year comparison. Uneven sampling, missing periods, or changes "
            "between years may contribute; it does not establish a cause or guarantee recurrence."
        ),
        "confidence": _confidence(len(frame), coverage),
        "evidence": {
            "time_column": date_column,
            "metric_column": metric,
            "year_month_periods": int(len(year_month)),
            "months_represented_in_multiple_years": int(len(month_averages)),
            "lowest_average_month": months[low_month - 1],
            "lowest_month_average": round(low, 6),
            "highest_average_month": months[high_month - 1],
            "highest_month_average": round(high, 6),
            "absolute_month_average_difference": round(difference, 6),
            "coverage_percentage": round(coverage * 100, 2),
        },
        "chart": _chart(
            "line",
            f"How average {metric} varies by month of year",
            "Calendar month",
            f"Average {metric}",
            points,
        ),
    }


def _group_candidate(
    df: pd.DataFrame,
    metric: str,
    group: str,
    question: Question,
) -> dict[str, Any] | None:
    values = _numeric_series(df, metric)
    frame = pd.DataFrame({"group": df[group].astype("string"), "value": values}).dropna()
    frame["group"] = frame["group"].astype(str)
    stats = frame.groupby("group")["value"].agg(["median", "count"]).sort_values("median")
    stats = stats[stats["count"] >= 4]
    if len(stats) < 2:
        return None
    low_group, high_group = str(stats.index[0]), str(stats.index[-1])
    low, high = float(stats.iloc[0]["median"]), float(stats.iloc[-1]["median"])
    delta = high - low
    scale = max(abs(low), abs(high), float(frame["value"].std(ddof=0)), 1e-12)
    effect = abs(delta) / scale
    if effect < 0.12:
        return None
    coverage = len(frame) / max(1, len(df))
    points = [
        {
            "x": _label(category),
            "y": round(float(row["median"]), 6),
            "detail": f"Median {metric}: {_format_number(float(row['median']))}; {int(row['count'])} records",
        }
        for category, row in stats.iterrows()
    ]
    direction = "higher" if delta > 0 else "lower"
    confidence = _confidence(int(stats["count"].sum()), coverage)
    focus_boost = 1.2 if question in ("automatic", "groups") else 1.0
    return {
        "_score": focus_boost * min(1.0, math.tanh(effect)) * min(1.0, len(frame) / 30) * coverage,
        "id": "group-difference",
        "category": "group",
        "finding_type": "observed",
        "title": f"Recorded {metric} differs across {group}",
        "summary": (
            f"The median {metric} was {_format_number(high)} for {_label(high_group)} and {_format_number(low)} "
            f"for {_label(low_group)}."
        ),
        "interpretation": (
            f"In this dataset, {_label(high_group)} had a {direction} median {metric} than "
            f"{_label(low_group)}. Group sizes are shown in the chart."
        ),
        "limitation": (
            "This is an unadjusted group comparison. It does not show that group membership caused the "
            "difference, and other variables may explain some or all of it."
        ),
        "confidence": confidence,
        "evidence": {
            "metric_column": metric,
            "group_column": group,
            "higher_group": _label(high_group),
            "higher_group_median": round(high, 6),
            "higher_group_count": int(stats.iloc[-1]["count"]),
            "lower_group": _label(low_group),
            "lower_group_median": round(low, 6),
            "lower_group_count": int(stats.iloc[0]["count"]),
            "absolute_median_difference": round(delta, 6),
            "coverage_percentage": round(coverage * 100, 2),
        },
        "chart": _chart(
            "bar",
            f"How median {metric} differs by {group}",
            group,
            f"Median {metric}",
            points,
        ),
    }


def _category_candidate(df: pd.DataFrame, group: str, question: Question) -> dict[str, Any] | None:
    counts = df[group].dropna().astype(str).value_counts().head(8)
    total = int(df[group].notna().sum())
    if len(counts) < 2 or total < 8 or counts.iloc[0] < 4:
        return None
    share = float(counts.iloc[0] / total)
    if share < 0.35:
        return None
    coverage = total / max(1, len(df))
    category = str(counts.index[0])
    plotted_counts = counts.head(7)
    points = [
        {
            "x": _label(name),
            "y": int(count),
            "detail": f"{int(count)} of {total} records ({count / total * 100:.1f}%)",
        }
        for name, count in plotted_counts.items()
    ]
    other_count = int(total - plotted_counts.sum())
    if other_count:
        points.append(
            {
                "x": "Other categories",
                "y": other_count,
                "detail": f"{other_count} of {total} records across remaining categories",
            }
        )
    focus_boost = 1.2 if question in ("automatic", "groups") else 1.0
    return {
        "_score": focus_boost * min(1.0, share) * min(1.0, total / 30) * coverage,
        "id": "category-share",
        "category": "group",
        "finding_type": "observed",
        "title": f"{_label(category)} appears most often in {group}",
        "summary": f"{counts.iloc[0]:,} of {total:,} non-empty records ({share * 100:.1f}%) are {_label(category)}.",
        "interpretation": "This describes how the records are distributed across the observed categories.",
        "limitation": "Category frequency does not indicate quality, preference, or an outcome unless the dataset defines one.",
        "confidence": _confidence(total, coverage),
        "evidence": {
            "group_column": group,
            "most_frequent_category": _label(category),
            "category_count": int(counts.iloc[0]),
            "non_empty_records": total,
            "category_share_percentage": round(share * 100, 2),
            "coverage_percentage": round(coverage * 100, 2),
        },
        "chart": _chart("bar", f"Which {group} values appear most often?", group, "Records", points),
    }


def _distribution_candidate(df: pd.DataFrame, metric: str, question: Question) -> dict[str, Any] | None:
    values = _numeric_series(df, metric).dropna()
    if len(values) < 12 or values.nunique() < 4:
        return None
    skew = float(values.skew()) if len(values) > 2 else 0.0
    median = float(values.median())
    q1, q3 = (float(v) for v in values.quantile([0.25, 0.75]))
    q99 = float(values.quantile(0.99))
    q01 = float(values.quantile(0.01))
    spread = max(abs(q3 - q1), 1e-12)
    high_tail = (q99 - median) / spread
    low_tail = (median - q01) / spread
    tail = max(high_tail, low_tail)
    if abs(skew) < 1.2 and tail < 2.5:
        return None
    chart = _histogram_chart(values, metric)
    if chart is None:
        return None
    if skew >= 1.2:
        summary = f"Most {metric} values are lower, with a smaller number of much higher observations extending the range."
        direction = "higher"
    elif skew <= -1.2:
        summary = f"Most {metric} values are higher, with a smaller number of much lower observations extending the range."
        direction = "lower"
    elif high_tail >= low_tail:
        summary = f"A small number of high {metric} values extend well beyond the middle half of the data."
        direction = "higher"
    else:
        summary = f"A small number of low {metric} values extend well beyond the middle half of the data."
        direction = "lower"
    coverage = len(values) / max(1, len(df))
    focus_boost = 1.2 if question in ("automatic", "distributions") else 1.0
    return {
        "_score": focus_boost * min(1.0, math.tanh(max(abs(skew), tail / 3))) * min(1.0, len(values) / 30) * coverage,
        "id": "skewed-distribution",
        "category": "distribution",
        "finding_type": "observed",
        "title": f"A {direction} tail stretches the {metric} distribution",
        "summary": summary,
        "interpretation": f"The median is {_format_number(median)}, while the middle half ranges from {_format_number(q1)} to {_format_number(q3)}.",
        "limitation": "Extreme values can be valid observations; review their context before treating them as errors.",
        "confidence": _confidence(len(values), coverage),
        "evidence": {
            "metric_column": metric,
            "valid_observations": int(len(values)),
            "median": round(median, 6),
            "first_quartile": round(q1, 6),
            "third_quartile": round(q3, 6),
            "skewness": round(skew, 4),
            "coverage_percentage": round(coverage * 100, 2),
        },
        "chart": chart,
    }


def _relationship_candidate(
    df: pd.DataFrame,
    metric: str,
    other: str,
    question: Question,
) -> dict[str, Any] | None:
    pair = pd.DataFrame({"x": _numeric_series(df, other), "y": _numeric_series(df, metric)}).dropna()
    if len(pair) < 12 or pair["x"].nunique() < 4 or pair["y"].nunique() < 4:
        return None
    rho = float(pair.corr(method="spearman").iloc[0, 1])
    if not math.isfinite(rho) or abs(rho) < 0.6:
        return None
    coverage = len(pair) / max(1, len(df))
    if coverage < 0.65:
        return None
    if len(pair) > 60:
        positions = np.linspace(0, len(pair) - 1, 60, dtype=int)
        sampled = pair.iloc[positions]
    else:
        sampled = pair
    points = [
        {"x": round(float(x), 6), "y": round(float(y), 6)}
        for x, y in sampled.itertuples(index=False, name=None)
    ]
    direction = "rise together" if rho > 0 else "move in opposite directions"
    focus_boost = 1.2 if question in ("automatic", "relationships") else 1.0
    return {
        "_score": focus_boost * min(1.0, abs(rho)) * min(1.0, len(pair) / 30) * coverage,
        "id": "numeric-association",
        "category": "relationship",
        "finding_type": "association",
        "title": f"{other} and {metric} tend to {direction}",
        "summary": f"The rank-based association between {other} and {metric} is {rho:+.2f} across {len(pair):,} complete records.",
        "interpretation": "Values of these two fields are associated in this dataset; the chart shows their observed pairing.",
        "limitation": "Association is not causation. Other variables, repeated measurements, or data collection choices may explain this pattern.",
        "confidence": _confidence(len(pair), coverage),
        "evidence": {
            "feature_a": other,
            "feature_b": metric,
            "spearman_rank_correlation": round(rho, 5),
            "complete_observations": int(len(pair)),
            "coverage_percentage": round(coverage * 100, 2),
        },
        "chart": _chart("scatter", f"Is {metric} related to {other}?", other, metric, points),
    }


def _model_candidate(modeling: dict[str, Any] | None, question: Question) -> dict[str, Any] | None:
    if not modeling or int(modeling.get("test_samples", 0)) < 20 or int(modeling.get("cv_folds", 0)) < 3:
        return None
    rows = modeling.get("summary_table") or []
    metric_key = "f1_macro" if rows and "f1_macro" in rows[0] else "r2"
    best = next((row for row in rows if row.get("is_best")), None)
    baseline = next((row for row in rows if "baseline" in str(row.get("model", "")).casefold()), None)
    if not best or not baseline:
        return None
    try:
        best_score, baseline_score = float(best[metric_key]), float(baseline[metric_key])
    except (KeyError, TypeError, ValueError):
        return None
    improvement = best_score - baseline_score
    if not math.isfinite(improvement) or improvement < 0.1:
        return None
    coverage = min(1.0, int(modeling.get("test_samples", 0)) / 60)
    points = [
        {"x": _label(row.get("model", "Model")), "y": round(float(row[metric_key]), 4)}
        for row in (baseline, best)
    ]
    metric_label = "macro F1" if metric_key == "f1_macro" else "R²"
    question_boost = 1.0
    return {
        "_score": question_boost * min(1.0, math.tanh(improvement * 2)) * coverage,
        "id": "model-baseline",
        "category": "model",
        "finding_type": "prediction",
        "title": "The selected model improves on a simple baseline",
        "summary": f"On the held-out split, {best.get('model')} scored {best_score:.3f} {metric_label}, compared with {baseline_score:.3f} for the baseline.",
        "interpretation": f"The tested predictors contained information useful for predicting {modeling.get('target_column')}; the score is measured on this dataset's held-out split.",
        "limitation": "This comparison does not guarantee performance on new data. Predictions do not explain causes, and the result depends on this split and validation design.",
        "confidence": "moderate" if modeling.get("cv_folds", 0) >= 5 and modeling.get("test_samples", 0) >= 40 else "exploratory",
        "evidence": {
            "target_column": modeling.get("target_column"),
            "selected_model": best.get("model"),
            "baseline_model": baseline.get("model"),
            "metric": metric_label,
            "selected_model_score": best_score,
            "baseline_score": baseline_score,
            "held_out_observations": int(modeling.get("test_samples", 0)),
            "cross_validation_folds": int(modeling.get("cv_folds", 0)),
        },
        "chart": _chart("bar", f"How the selected model compares to baseline ({metric_label})", "Model", metric_label, points),
    }


def discover_insights(
    df: pd.DataFrame,
    dataset_name: str,
    *,
    numerical_columns: list[str],
    categorical_columns: list[str],
    datetime_columns: list[str],
    id_columns: list[str],
    constant_columns: list[str],
    target_column: str | None = None,
    metric_column: str | None = None,
    date_column: str | None = None,
    group_column: str | None = None,
    question: Question = "automatic",
    modeling: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Find a small set of useful patterns without requiring an LLM or domain rules."""
    ids = set(id_columns)
    constants = set(constant_columns)
    numeric = [
        column
        for column in numerical_columns
        if column in df and column not in ids and column not in constants
        and pd.api.types.is_numeric_dtype(df[column])
    ][:12]
    categories: list[str] = []
    for column in categorical_columns:
        if column not in df or column in ids or column in constants:
            continue
        unique = int(df[column].nunique(dropna=True))
        if 2 <= unique <= 10 and int(df[column].notna().sum()) >= 8:
            categories.append(column)

    date_options = []
    date_values: dict[str, pd.Series] = {}
    for column in datetime_columns:
        if column not in df:
            continue
        parsed = _resolve_date_values(df, column)
        if parsed.notna().sum() >= max(4, int(len(df) * 0.5)) and parsed.nunique() >= 3:
            date_options.append(column)
            date_values[column] = parsed

    metric_options = numeric[:]
    selected_metric = metric_column
    if selected_metric is None and target_column in metric_options:
        selected_metric = target_column
    if selected_metric is not None and selected_metric not in metric_options:
        raise ValueError(f"'{selected_metric}' is not an eligible numerical metric in this dataset.")
    if selected_metric is None and numeric:
        selected_metric = max(numeric, key=lambda col: (_column_name_score(col), df[col].nunique(dropna=True)))
    selected_date = date_column or (date_options[0] if date_options else None)
    if selected_date is not None and selected_date not in date_options:
        raise ValueError(f"'{selected_date}' is not an eligible date column in this dataset.")
    selected_group = group_column
    if selected_group is None and categories:
        selected_group = min(
            categories,
            key=lambda col: (abs(int(df[col].nunique(dropna=True)) - 4), -int(df[col].notna().sum())),
        )
    if selected_group is not None and selected_group not in categories:
        raise ValueError(f"'{selected_group}' is not an eligible grouping column in this dataset.")

    field_names = [str(column) for column in df.columns[:5]]
    field_phrase = ", ".join(f"`{name}`" for name in field_names) or "no named fields"
    overview = (
        f"{dataset_name} contains {len(df):,} records with fields including {field_phrase}. "
        "The findings below use the available measurements and their observed values."
    )
    selected_focus = {
        "metric_column": selected_metric,
        "date_column": selected_date,
        "group_column": selected_group,
        "question": question,
    }

    metrics: list[dict[str, str]] = []
    metric_values: pd.Series | None = None
    if selected_metric:
        metric_values = _numeric_series(df, selected_metric).dropna()
        if not metric_values.empty:
            metrics.extend([
                {
                    "label": f"Typical {selected_metric}",
                    "value": _format_number(float(metric_values.median())),
                    "detail": f"Median across {len(metric_values):,} usable records; no unit inferred.",
                },
                {
                    "label": f"Observed range for {selected_metric}",
                    "value": f"{_format_number(float(metric_values.min()))} – {_format_number(float(metric_values.max()))}",
                    "detail": "Lowest and highest recorded values; extreme values may be valid.",
                },
            ])
    elif selected_group:
        counts = df[selected_group].dropna().astype(str).value_counts()
        if not counts.empty:
            metrics.append({
                "label": f"Most frequent {selected_group}",
                "value": _label(counts.index[0]),
                "detail": f"{int(counts.iloc[0]):,} of {int(counts.sum()):,} non-empty records.",
            })
    if selected_date:
        timestamps = date_values[selected_date].dropna()
        if not timestamps.empty:
            metrics.append({
                "label": "Observed date span",
                "value": f"{timestamps.min().date().isoformat()} – {timestamps.max().date().isoformat()}",
                "detail": f"{timestamps.nunique():,} distinct timestamps; gaps are not filled.",
            })
    metrics = metrics[:3]

    candidates: list[dict[str, Any]] = []
    if selected_metric and selected_date:
        found = _time_candidate(df, selected_metric, selected_date, question)
        if found:
            candidates.append(found)
        found = _seasonality_candidate(df, selected_metric, selected_date, question)
        if found:
            candidates.append(found)
    if selected_metric and selected_group:
        found = _group_candidate(df, selected_metric, selected_group, question)
        if found:
            candidates.append(found)
    if selected_group:
        found = _category_candidate(df, selected_group, question)
        if found:
            candidates.append(found)
    if selected_metric:
        found = _distribution_candidate(df, selected_metric, question)
        if found:
            candidates.append(found)
        related = [column for column in numeric if column != selected_metric][:6]
        for other in related:
            found = _relationship_candidate(df, selected_metric, other, question)
            if found:
                candidates.append(found)
    found = _model_candidate(modeling, question)
    if found:
        candidates.append(found)

    preferred_category = _QUESTION_CATEGORY.get(question)
    candidates.sort(
        key=lambda item: (item["_score"] * (1.2 if item["category"] == preferred_category else 1.0), item["_score"]),
        reverse=True,
    )
    findings: list[dict[str, Any]] = []
    used_ids: set[str] = set()
    for item in candidates:
        if item["_score"] < 0.12 or item["id"] in used_ids:
            continue
        used_ids.add(item["id"])
        findings.append({key: value for key, value in item.items() if not key.startswith("_")})
        if len(findings) == 5:
            break

    suggestions: list[str] = []
    if selected_metric and selected_group:
        suggestions.append(f"How does `{selected_metric}` vary across the groups in `{selected_group}`?")
    if selected_metric and selected_date:
        suggestions.append(f"Does the pattern in `{selected_metric}` differ across time periods?")
    if selected_metric:
        other_numeric = [column for column in numeric if column != selected_metric]
        if other_numeric:
            suggestions.append(f"Which other recorded fields move with `{selected_metric}`?")
    if not suggestions:
        suggestions.append("Which columns or groups should be examined more closely?")

    if findings:
        status = f"Found {len(findings)} evidence-backed pattern{'' if len(findings) == 1 else 's'} to explore."
    elif len(df) < 8:
        status = "There are too few usable records to support a dependable pattern yet."
    else:
        status = "No strong, well-supported pattern stood out in the available fields."

    return {
        "dataset_overview": overview,
        "status": status,
        "selected_focus": selected_focus,
        "options": {
            "metric_columns": metric_options,
            "date_columns": date_options,
            "group_columns": categories,
        },
        "important_metrics": metrics,
        "key_findings": findings,
        "suggested_questions": suggestions[:4],
    }
