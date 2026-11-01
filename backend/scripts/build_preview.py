"""Regenerate the landing page's explicitly labelled Python-computed sample snapshot."""

import json
from pathlib import Path

from infera.data_loader import calculate_health_score, get_dataset_schema, load_csv
from infera.statistics import calculate_numerical_column_stats


def main():
    root = Path(__file__).resolve().parents[2]
    housing_csv = root / "sample_data/housing.csv"
    df = load_csv(housing_csv)

    schema = get_dataset_schema(df)
    health = calculate_health_score(df)
    price_stats = calculate_numerical_column_stats(df["price"], "price")

    missing_cells = sum(col["null_count"] for col in schema["columns"])
    total_cells = schema["row_count"] * schema["column_count"]
    missing_pct = round((missing_cells / total_cells) * 100.0, 2) if total_cells > 0 else 0.0

    snapshot = {
        "source": "sample_data/housing.csv",
        "rows": schema["row_count"],
        "columns": schema["column_count"],
        "health": health,
        "missing": missing_pct,
        "duplicates": int(df.duplicated().sum()),
        "numerical": len(schema["numerical_columns"]),
        "mean": price_stats.mean,
        "median": price_stats.median,
        "histogram": [b.model_dump() for b in price_stats.histogram],
    }

    output = root / "frontend/lib/sample-preview.json"
    output.write_text(json.dumps(snapshot, indent=2) + "\n", encoding="utf-8")
    print(f"Generated sample preview snapshot at {output}")


if __name__ == "__main__":
    main()
