"""Serialization helper converting numpy and pandas primitives to native Python types."""

import math
from typing import Any

import numpy as np
import pandas as pd


def sanitize_for_json(obj: Any) -> Any:
    """Recursively converts numpy and pandas types to standard JSON-serializable Python types."""
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple, set)):
        return [sanitize_for_json(item) for item in obj]
    elif isinstance(obj, np.ndarray):
        return [sanitize_for_json(item) for item in obj.tolist()]
    elif isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        val = float(obj)
        return val if math.isfinite(val) else None
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, float) and not math.isfinite(obj):
        return None
    elif obj is pd.NA or obj is pd.NaT or obj is None:
        return None
    elif isinstance(obj, (pd.Timestamp, np.datetime64)):
        return str(obj)
    return obj
