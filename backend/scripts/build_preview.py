"""Regenerate the landing page's explicitly labelled Python-computed sample snapshot."""

import json
import sys
from dataclasses import asdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.analysis.pipeline.runner import compute_health_score
from app.analysis.profiler.duplicates import analyze_duplicates
from app.analysis.profiler.missing import analyze_missing_values
from app.analysis.profiler.outliers import analyze_outliers
from app.analysis.profiler.schema import inspect_schema
from app.analysis.statistics.descriptive import compute_descriptive_statistics
from app.services.dataset_service import load_sample_dataset


def main():
    df, _ = load_sample_dataset("housing")
    schema = inspect_schema(df)
    missing = analyze_missing_values(df)
    duplicates = analyze_duplicates(df, id_columns=schema.id_columns)
    outliers = analyze_outliers(df, schema.numerical_columns)
    statistics = compute_descriptive_statistics(df, schema.numerical_columns, schema.categorical_columns)
    price = next(item for item in statistics.numerical if item.column == "price")
    snapshot = {
        "source": "sample_data/housing.csv",
        "rows": schema.row_count,
        "columns": schema.column_count,
        "health": compute_health_score(missing, duplicates, outliers),
        "missing": missing.overall_missing_percentage,
        "duplicates": duplicates.duplicate_rows_count,
        "numerical": len(schema.numerical_columns),
        "mean": price.mean,
        "median": price.median,
        "histogram": [asdict(item) for item in price.histogram],
    }
    output = Path(__file__).resolve().parents[2] / "frontend/lib/sample-preview.json"
    output.write_text(json.dumps(snapshot, indent=2) + "\n")


if __name__ == "__main__":
    main()
