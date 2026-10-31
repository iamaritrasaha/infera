"""Tests for infera.correlation.

These tests use synthetic mathematical series to verify:
1. Perfect positive linear correlation (r = 1.0).
2. Perfect negative linear correlation (r = -1.0).
3. Correlation strength classification and plain-English explanations.
4. The explicit inclusion of the disclaimer that correlation does not establish causation.
"""

import pandas as pd

from infera.correlation import (
    classify_correlation,
    compute_correlations,
    explain_correlation,
)


def test_perfect_positive_correlation():
    """Verify that y = 2*x yields a Pearson r of exactly 1.0."""
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [2.0, 4.0, 6.0, 8.0, 10.0]
    df = pd.DataFrame({"x": x, "y": y})

    result = compute_correlations(df, ["x", "y"])

    assert len(result.top_correlations) == 1
    pair = result.top_correlations[0]
    assert pair.feature_a == "x"
    assert pair.feature_b == "y"
    assert round(pair.pearson_r, 2) == 1.0
    assert pair.strength == "strong"
    assert pair.direction == "positive"
    assert pair.is_statistically_significant is True


def test_perfect_negative_correlation():
    """Verify that y = -3*x yields a Pearson r of exactly -1.0."""
    x = [1.0, 2.0, 3.0, 4.0, 5.0]
    y = [-3.0, -6.0, -9.0, -12.0, -15.0]
    df = pd.DataFrame({"x": x, "y": y})

    result = compute_correlations(df, ["x", "y"])

    assert len(result.notable_negative_correlations) == 1
    pair = result.notable_negative_correlations[0]
    assert round(pair.pearson_r, 2) == -1.0
    assert pair.strength == "strong"
    assert pair.direction == "negative"


def test_classify_correlation_thresholds():
    """Verify threshold boundary classification."""
    assert classify_correlation(0.85) == ("strong", "positive")
    assert classify_correlation(-0.75) == ("strong", "negative")
    assert classify_correlation(0.50) == ("moderate", "positive")
    assert classify_correlation(-0.25) == ("weak", "negative")
    assert classify_correlation(0.01) == ("negligible", "neutral")


def test_explain_correlation_includes_causation_warning():
    """Verify pedagogical warning that correlation does not establish causation."""
    explanation = explain_correlation("study_hours", "exam_score", 0.82, 0.001)

    assert "study_hours" in explanation
    assert "exam_score" in explanation
    assert "not causation" in explanation.lower()


def test_correlation_matrix_dimensions():
    """Verify matrix shape matches number of valid columns."""
    df = pd.DataFrame(
        {
            "a": [1, 2, 3, 4, 5],
            "b": [5, 4, 3, 2, 1],
            "c": [2, 3, 2, 3, 2],
        }
    )
    result = compute_correlations(df, ["a", "b", "c"])

    assert len(result.columns) == 3
    assert len(result.pearson_matrix) == 3
    assert len(result.pearson_matrix[0]) == 3
    # Diagonal should be 1.0
    assert result.pearson_matrix[0][0] == 1.0
    assert result.pearson_matrix[1][1] == 1.0
    assert result.pearson_matrix[2][2] == 1.0
