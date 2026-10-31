"""Bounded descriptive calculations for the interactive data explorer."""

from __future__ import annotations

import math
from typing import Any

import numpy as np
import pandas as pd

from app.analysis.profiler.schema import inspect_schema
from app.models.schemas import ExploreRequest

MAX_GROUPS = 50
MAX_TREND_PERIODS = 500
MAX_CHART_POINTS = 160
MAX_CATEGORY_OPTIONS = 100
_AGGREGATIONS = {"mean", "median", "count", "sum", "min", "max"}
EligibleColumns = tuple[set[str], set[str], set[str]]


def _eligible_columns(df: pd.DataFrame) -> EligibleColumns:
    schema = inspect_schema(df)
    numeric = set(schema.numerical_columns) - set(schema.id_columns) - set(schema.constant_columns)
    categories = (set(schema.categorical_columns) | set(schema.boolean_columns)) - set(schema.id_columns) - set(schema.constant_columns)
    dates = set(schema.datetime_columns)
    return numeric, categories, dates


def column_options(
    df: pd.DataFrame,
    column: str,
    eligible: EligibleColumns | None = None,
) -> dict[str, Any]:
    """Return capped filter options, never exposing unbounded distinct values."""
    numeric, categories, dates = eligible or _eligible_columns(df)
    if column in numeric:
        values = pd.to_numeric(df[column], errors="coerce").replace([np.inf, -np.inf], np.nan).dropna()
        return {
            "column": column,
            "kind": "number",
            "minimum": float(values.min()) if not values.empty else None,
            "maximum": float(values.max()) if not values.empty else None,
        }
    if column in dates:
        values = pd.to_datetime(df[column], errors="coerce", format="mixed", utc=True).dropna().sort_values()
        unique = values.drop_duplicates()
        intervals = unique.diff().dropna().dt.total_seconds() / 86400
        return {
            "column": column,
            "kind": "date",
            "start": values.min().date().isoformat() if not values.empty else None,
            "end": values.max().date().isoformat() if not values.empty else None,
            "observation_count": int(len(unique)),
            "span_days": float((unique.iloc[-1] - unique.iloc[0]).total_seconds() / 86400) if len(unique) > 1 else 0.0,
            "median_interval_days": float(intervals.median()) if not intervals.empty else None,
        }
    if column in categories:
        counts = df[column].dropna().astype("string").value_counts()
        options = counts.index[:MAX_CATEGORY_OPTIONS].astype(str).tolist()
        return {
            "column": column,
            "kind": "category",
            "values": options,
            "truncated": len(counts) > MAX_CATEGORY_OPTIONS,
        }
    raise ValueError(f"'{column}' is not a supported categorical, numerical, or date filter.")


def _apply_filters(
    df: pd.DataFrame,
    request: ExploreRequest,
    eligible: EligibleColumns,
) -> tuple[pd.DataFrame, list[dict[str, Any]]]:
    numeric, categories, dates = eligible
    mask = pd.Series(True, index=df.index)
    applied: list[dict[str, Any]] = []
    seen: set[str] = set()
    for spec in request.filters:
        column = spec.column
        if column in seen:
            raise ValueError(f"Only one filter per column is supported ('{column}' was repeated).")
        seen.add(column)
        if column not in df:
            raise ValueError(f"Filter column '{column}' was not found in this dataset.")

        if spec.kind == "category":
            if column not in categories:
                raise ValueError(f"'{column}' is not an eligible categorical filter.")
            if not spec.values:
                raise ValueError(f"Choose at least one value for the '{column}' filter.")
            options = column_options(df, column, eligible)["values"]
            if not set(spec.values).issubset(options):
                raise ValueError(f"One or more selected values for '{column}' are unavailable.")
            mask &= df[column].astype("string").isin(spec.values)
            applied.append({"column": column, "kind": "category", "values": spec.values})
        elif spec.kind == "number":
            if column not in numeric:
                raise ValueError(f"'{column}' is not an eligible numerical filter.")
            if spec.minimum is None and spec.maximum is None:
                raise ValueError(f"Set a minimum or maximum for the '{column}' filter.")
            if spec.minimum is not None and spec.maximum is not None and spec.minimum > spec.maximum:
                raise ValueError(f"The minimum for '{column}' must not exceed its maximum.")
            series = pd.to_numeric(df[column], errors="coerce").replace([np.inf, -np.inf], np.nan)
            if spec.minimum is not None:
                mask &= series.ge(spec.minimum)
            if spec.maximum is not None:
                mask &= series.le(spec.maximum)
            applied.append({"column": column, "kind": "number", "minimum": spec.minimum, "maximum": spec.maximum})
        else:
            if column not in dates:
                raise ValueError(f"'{column}' is not an eligible date filter.")
            if not spec.start and not spec.end:
                raise ValueError(f"Set a start or end date for the '{column}' filter.")
            start = pd.to_datetime(spec.start, errors="coerce", utc=True) if spec.start else None
            end = pd.to_datetime(spec.end, errors="coerce", utc=True) if spec.end else None
            if (start is not None and pd.isna(start)) or (end is not None and pd.isna(end)):
                raise ValueError(f"The date range for '{column}' is invalid.")
            if start is not None and end is not None and start > end:
                raise ValueError(f"The start date for '{column}' must not exceed its end date.")
            series = pd.to_datetime(df[column], errors="coerce", format="mixed", utc=True)
            if start is not None:
                mask &= series.ge(start)
            if end is not None:
                mask &= series.lt(end + pd.Timedelta(days=1))
            applied.append({"column": column, "kind": "date", "start": spec.start, "end": spec.end})

    return df.loc[mask], applied


def _numeric(df: pd.DataFrame, column: str) -> pd.Series:
    return pd.to_numeric(df[column], errors="coerce").replace([np.inf, -np.inf], np.nan)


def _aggregate(series: pd.Series, aggregation: str) -> float | int | None:
    if aggregation not in _AGGREGATIONS:
        raise ValueError("Unsupported aggregation.")
    valid = series.dropna()
    if aggregation == "count":
        return int(len(valid))
    if valid.empty:
        return None
    value = getattr(valid, aggregation)()
    result = float(value)
    return result if math.isfinite(result) else None


def _thin(items: list[dict[str, Any]], limit: int = MAX_CHART_POINTS) -> list[dict[str, Any]]:
    if len(items) <= limit:
        return items
    indexes = np.linspace(0, len(items) - 1, limit, dtype=int)
    return [items[int(index)] for index in indexes]


def _group_result(
    df: pd.DataFrame,
    request: ExploreRequest,
    filters: list[dict[str, Any]],
    eligible: EligibleColumns,
) -> dict[str, Any]:
    numeric, categories, _ = eligible
    group = request.group_column
    if not group or group not in categories:
        raise ValueError("Choose an eligible categorical grouping column.")
    if request.aggregation != "count" and not request.metric_column:
        raise ValueError("Choose a numerical metric for this aggregation.")
    metric = request.metric_column
    if metric is not None and metric not in numeric:
        raise ValueError(f"'{metric}' is not an eligible numerical metric. Identifier and constant columns are excluded.")
    if request.aggregation == "sum" and metric and any(
        token in metric.casefold() for token in ("percent", "percentage", "pct", "rate", "ratio")
    ):
        raise ValueError("Summing a rate or percentage column is not meaningful. Choose another aggregation.")

    frame = pd.DataFrame({"group": df[group].astype("string")})
    if metric:
        frame["value"] = _numeric(df, metric)
    else:
        frame["value"] = 1.0
    frame = frame.dropna(subset=["group"])
    if request.aggregation != "count" or metric:
        frame = frame.dropna(subset=["value"])
    group_count = int(frame["group"].nunique(dropna=True))
    if group_count > MAX_GROUPS:
        raise ValueError(
            f"'{group}' has {group_count:,} observed groups. Choose a grouping with at most {MAX_GROUPS} values or filter it first."
        )

    rows: list[dict[str, Any]] = []
    for label, group_frame in frame.groupby("group", sort=True, observed=True):
        sample_size = int(len(group_frame))
        series = group_frame["value"]
        value = _aggregate(series, request.aggregation)
        if value is not None:
            rows.append({"group": str(label), "value": value, "sample_size": sample_size})
    rows.sort(key=lambda row: (float(row["value"]), row["group"]))

    limitations = [
        "These are descriptive comparisons within the selected rows; they do not establish that group membership caused a difference.",
        "Sum is a row-wise total and is meaningful only for additive measures. No units or business meaning are inferred from a column name.",
    ]
    if not rows:
        return {
            "mode": "group", "status": "empty", "dataset_rows": len(df), "filtered_rows": 0,
            "usable_rows": int(len(frame)),
            "metric_column": metric, "group_column": group, "aggregation": request.aggregation,
            "filters": filters, "groups": [], "chart": None,
            "interpretation": "No rows remain for this comparison. Change or clear the filters.",
            "limitations": limitations,
        }

    first, last = rows[0], rows[-1]
    difference = float(last["value"]) - float(first["value"])
    series_label = metric or "records"
    chart = {
        "kind": "bar", "title": f"{request.aggregation.title()} {series_label} by {group}",
        "x_label": group, "y_label": f"{request.aggregation.title()} {series_label}",
        "points": [
            {"x": row["group"], "y": float(row["value"]), "detail": f"n = {row['sample_size']:,}"}
            for row in rows
        ],
    }
    return {
        "mode": "group", "status": "ready", "dataset_rows": len(df), "filtered_rows": int(len(frame)),
        "usable_rows": int(len(frame)),
        "metric_column": metric, "group_column": group, "aggregation": request.aggregation,
        "filters": filters, "groups": rows, "chart": chart,
        "interpretation": (
            f"The largest observed {request.aggregation} was {last['value']:,.4g} for '{last['group']}', "
            f"and the smallest was {first['value']:,.4g} for '{first['group']}'. The difference was {difference:,.4g}."
        ),
        "limitations": limitations,
    }


def _trend_result(
    df: pd.DataFrame,
    request: ExploreRequest,
    filters: list[dict[str, Any]],
    eligible: EligibleColumns,
) -> dict[str, Any]:
    numeric, _, dates = eligible
    time_column, metric = request.time_column, request.metric_column
    if not time_column or time_column not in dates:
        raise ValueError("Choose a date/time column with parseable observations.")
    if request.aggregation != "count" and not metric:
        raise ValueError("Choose a numerical metric for this trend aggregation.")
    if metric is not None and metric not in numeric:
        raise ValueError(f"'{metric}' is not an eligible numerical metric. Identifier and constant columns are excluded.")
    if request.aggregation == "sum" and metric and any(
        token in metric.casefold() for token in ("percent", "percentage", "pct", "rate", "ratio")
    ):
        raise ValueError("Summing a rate or percentage column is not meaningful. Choose another aggregation.")

    frame = pd.DataFrame({
        "timestamp": pd.to_datetime(df[time_column], errors="coerce", format="mixed", utc=True),
    })
    frame["timestamp"] = frame["timestamp"].dt.tz_localize(None)
    if metric:
        frame["value"] = _numeric(df, metric)
    else:
        frame["value"] = 1.0
    frame = frame.dropna(subset=["timestamp"])
    if request.aggregation != "count" or metric:
        frame = frame.dropna(subset=["value"])
    if frame.empty:
        return {
            "mode": "trend", "status": "empty", "dataset_rows": len(df), "filtered_rows": 0,
            "usable_rows": 0,
            "metric_column": metric, "time_column": time_column, "aggregation": request.aggregation,
            "frequency": request.frequency, "filters": filters, "interpretation": "No valid dated values remain.",
            "limitations": ["Date and metric filters removed every usable observation."],
        }

    frame["period"] = frame["timestamp"].dt.to_period(request.frequency)
    grouped = frame.groupby("period", sort=True, observed=True)
    records: list[dict[str, Any]] = []
    for period, part in grouped:
        value = _aggregate(part["value"], request.aggregation)
        if value is not None:
            records.append({
                "period": str(period),
                "timestamp": period.start_time.isoformat(),
                "value": float(value),
                "sample_size": int(part["value"].notna().sum()),
            })
    if len(records) > MAX_TREND_PERIODS:
        raise ValueError(
            f"This date range creates {len(records):,} {request.frequency} periods. Choose a coarser interval; the limit is {MAX_TREND_PERIODS:,}."
        )
    if not records:
        raise ValueError("No periods could be calculated from the selected date and metric columns.")

    values = np.asarray([row["value"] for row in records], dtype=float)
    changes = np.diff(values)
    first, last = records[0], records[-1]
    absolute_change = float(last["value"] - first["value"])
    percentage_change = (
        absolute_change / float(first["value"]) * 100
        if float(first["value"]) != 0
        else None
    )
    first_period = pd.Period(records[0]["period"], freq=request.frequency)
    last_period = pd.Period(records[-1]["period"], freq=request.frequency)
    expected_periods = len(pd.period_range(first_period, last_period, freq=request.frequency))
    missing_periods = max(0, expected_periods - len(records))
    robust_center = float(np.median(changes)) if len(changes) else 0.0
    mad = float(np.median(np.abs(changes - robust_center))) if len(changes) else 0.0
    unusual: list[dict[str, Any]] = []
    if len(changes) >= 7 and mad > 0:
        robust_scores = 0.6745 * (changes - robust_center) / mad
        for idx in np.flatnonzero(np.abs(robust_scores) >= 3.5)[-20:]:
            unusual.append({
                "period": records[int(idx) + 1]["period"],
                "change": float(changes[int(idx)]),
                "robust_score": float(robust_scores[int(idx)]),
            })

    chart_records = _thin(records)
    name = metric or "record count"
    pp_change = float(changes[-1]) if len(changes) else None
    limitations = [
        "First and last values are the first and last observed periods, not imputed values for missing periods.",
        "Repeated timestamps are combined within each period using the selected aggregation. Sparse observations can hide within-period changes.",
        "This is descriptive: it does not claim causation, seasonality, or predict future values.",
    ]
    return {
        "mode": "trend", "status": "ready", "dataset_rows": len(df), "filtered_rows": int(len(frame)),
        "usable_rows": int(len(frame)),
        "metric_column": metric, "time_column": time_column, "aggregation": request.aggregation,
        "frequency": request.frequency, "filters": filters,
        "chart": {
            "kind": "line", "title": f"{request.aggregation.title()} {name} by {request.frequency} period",
            "x_label": time_column, "y_label": f"{request.aggregation.title()} {name}",
            "points": [
                {"x": row["timestamp"], "y": row["value"], "detail": f"n = {row['sample_size']:,}; {row['period']}"}
                for row in chart_records
            ],
        },
        "periods": records,
        "first_period": first, "last_period": last,
        "absolute_change": absolute_change,
        "percentage_change": percentage_change,
        "period_over_period_change": pp_change,
        "highest_period": max(records, key=lambda row: row["value"]),
        "lowest_period": min(records, key=lambda row: row["value"]),
        "variability": float(np.std(values, ddof=1)) if len(values) > 1 else 0.0,
        "missing_periods": missing_periods,
        "unusual_changes": unusual,
        "interpretation": (
            f"Recorded {name} {('increased' if absolute_change > 0 else 'decreased' if absolute_change < 0 else 'did not change')} "
            f"by {abs(absolute_change):,.4g} between the first and last observed {request.frequency} periods."
        ),
        "limitations": limitations,
    }


def _relationship_result(
    df: pd.DataFrame,
    request: ExploreRequest,
    filters: list[dict[str, Any]],
    eligible: EligibleColumns,
) -> dict[str, Any]:
    numeric, _, _ = eligible
    metric, compare = request.metric_column, request.compare_column
    if not metric or metric not in numeric or not compare or compare not in numeric:
        raise ValueError("Choose two distinct eligible numerical columns for a relationship comparison.")
    if metric == compare:
        raise ValueError("Choose two different numerical columns.")
    frame = pd.DataFrame({"x": _numeric(df, metric), "y": _numeric(df, compare)}).dropna()
    count = int(len(frame))
    if count < 3:
        return {
            "mode": "relationship", "status": "empty", "dataset_rows": len(df), "filtered_rows": count,
            "usable_rows": count,
            "metric_column": metric, "compare_column": compare, "aggregation": "association", "filters": filters,
            "valid_pairs": count, "interpretation": "At least three complete pairs are needed for a correlation.",
            "limitations": ["A correlation is undefined for too few pairs or a constant variable."],
        }
    pearson = frame["x"].corr(frame["y"], method="pearson")
    spearman = frame["x"].corr(frame["y"], method="spearman")
    if pd.isna(pearson) or pd.isna(spearman):
        return {
            "mode": "relationship", "status": "empty", "dataset_rows": len(df), "filtered_rows": count,
            "usable_rows": count,
            "metric_column": metric, "compare_column": compare, "aggregation": "association", "filters": filters,
            "valid_pairs": count, "interpretation": "Correlation is undefined because at least one selected column is constant.",
            "limitations": ["A constant variable has no variance to correlate."],
        }
    sample = frame if count <= MAX_CHART_POINTS else frame.iloc[np.linspace(0, count - 1, MAX_CHART_POINTS, dtype=int)]
    return {
        "mode": "relationship", "status": "ready", "dataset_rows": len(df), "filtered_rows": count,
        "usable_rows": count,
        "metric_column": metric, "compare_column": compare, "aggregation": "association", "filters": filters,
        "pearson_r": float(pearson), "spearman_rho": float(spearman), "valid_pairs": count,
        "chart": {
            "kind": "scatter", "title": f"{metric} and {compare} in the filtered rows",
            "x_label": metric, "y_label": compare,
            "points": [
                {"x": float(row.x), "y": float(row.y), "detail": "Sampled from filtered complete pairs"}
                for row in sample.itertuples(index=False)
            ],
        },
        "interpretation": (
            f"In {count:,} complete filtered pairs, Pearson r was {float(pearson):.4f} and "
            f"Spearman rho was {float(spearman):.4f}. These describe association, not causation."
        ),
        "limitations": [
            "Correlation describes association and does not establish causation.",
            "The scatter chart is capped at 160 evenly spaced rows; the reported coefficients use every complete filtered pair.",
        ],
    }


def explore_dataframe(df: pd.DataFrame, request: ExploreRequest) -> dict[str, Any]:
    """Run a requested descriptive exploration against an existing dataframe."""
    eligible = _eligible_columns(df)
    filtered, applied_filters = _apply_filters(df, request, eligible)
    if request.mode == "group":
        result = _group_result(filtered, request, applied_filters, eligible)
    elif request.mode == "trend":
        result = _trend_result(filtered, request, applied_filters, eligible)
    else:
        result = _relationship_result(filtered, request, applied_filters, eligible)
    # Keep the population denominator tied to the uploaded table, not the filtered subset.
    result["dataset_rows"] = int(len(df))
    result["filtered_rows"] = int(len(filtered))
    return result
