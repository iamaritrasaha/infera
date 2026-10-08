"""Evidence-backed insight and explanation generation layer."""

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class StructuredInsight:
    """An evidence-backed finding traceable directly to computed metrics."""

    id: str = field(default_factory=lambda: str(uuid.uuid4())[:8])
    category: str = (
        "general"  # "data_quality", "correlation", "hypothesis", "modeling", "clustering"
    )
    title: str = ""
    summary: str = ""
    plain_english: str = ""
    confidence: str = "high"  # "high", "moderate", "heuristic"
    evidence: dict = field(default_factory=dict)
    calculation_details: str = ""


class ExplanationProvider(ABC):
    """Abstract contract for rendering computational evidence into plain English."""

    @abstractmethod
    def explain_data_quality(
        self,
        missing_pct: float,
        duplicate_count: int,
        duplicate_pct: float,
        outlier_count: int,
        health_score: int,
    ) -> list[StructuredInsight]:
        """Explains dataset hygiene and integrity signals."""

    @abstractmethod
    def explain_relationships(
        self,
        top_correlations: list[dict],
    ) -> list[StructuredInsight]:
        """Translates bivariate relationships into clear evidence."""

    @abstractmethod
    def explain_hypothesis_tests(
        self,
        tests: list[dict],
    ) -> list[StructuredInsight]:
        """Interprets formal statistical hypothesis decisions."""

    @abstractmethod
    def explain_model_comparison(
        self,
        problem_type: str,
        target_name: str,
        best_model: str,
        metrics_summary: dict,
    ) -> list[StructuredInsight]:
        """Interprets model benchmarking and predictive findings."""


class TemplateExplanationProvider(ExplanationProvider):
    """Deterministic, zero-budget, evidence-traceable explanation generator."""

    def explain_data_quality(
        self,
        missing_pct: float,
        duplicate_count: int,
        duplicate_pct: float,
        outlier_count: int,
        health_score: int,
    ) -> list[StructuredInsight]:
        insights = []

        # Health score insight
        rating = (
            "Excellent"
            if health_score >= 85
            else (
                "Good" if health_score >= 70 else ("Degraded" if health_score >= 50 else "Critical")
            )
        )
        insights.append(
            StructuredInsight(
                category="data_quality",
                title=f"Dataset Integrity Rating: {rating} ({health_score}/100)",
                summary=f"Overall health score computed at {health_score}/100.",
                plain_english=(
                    f"The dataset received a quality rating of {health_score}/100 ({rating.lower()}). "
                    f"Penalties: missing data accounts for {missing_pct}% of cells, "
                    f"exact row duplicates comprise {duplicate_pct}% ({duplicate_count} rows), "
                    f"and {outlier_count} statistical extremes were identified."
                ),
                confidence="high",
                evidence={
                    "health_score": health_score,
                    "missing_percentage": missing_pct,
                    "duplicate_count": duplicate_count,
                    "duplicate_percentage": duplicate_pct,
                    "outlier_count": outlier_count,
                },
                calculation_details="HealthScore = 100 - (missing_pct * 1.5) - (duplicate_pct * 2.0) - min(20, outlier_count * 0.2)",
            )
        )

        if duplicate_count > 0:
            insights.append(
                StructuredInsight(
                    category="data_quality",
                    title=f"Duplicate Rows Detected ({duplicate_pct}%)",
                    summary=f"{duplicate_count} identical records found.",
                    plain_english=(
                        f"There are {duplicate_count} exact duplicate observations ({duplicate_pct}% of total records). "
                        "Repeated observations can introduce artificial weighting and data leakage during validation splits."
                    ),
                    confidence="high",
                    evidence={"duplicate_rows": duplicate_count, "duplicate_pct": duplicate_pct},
                    calculation_details="Computed via df.duplicated().sum() over all columns.",
                )
            )

        return insights

    def explain_relationships(
        self,
        top_correlations: list[dict],
    ) -> list[StructuredInsight]:
        insights = []
        for pair in top_correlations[:4]:
            col_a = pair.get("feature_a", "")
            col_b = pair.get("feature_b", "")
            r = pair.get("pearson_r", 0.0)
            pval = pair.get("pearson_p_value", 1.0)
            strength = pair.get("strength", "moderate")
            dir_str = pair.get("direction", "positive")

            insights.append(
                StructuredInsight(
                    category="correlation",
                    title=f"Correlation: {col_a} & {col_b} ({r:+.2f})",
                    summary=f"{strength.replace('_', ' ').capitalize()} {dir_str} association.",
                    plain_english=(
                        f"A {strength.replace('_', ' ')} {dir_str} linear relationship exists between '{col_a}' and '{col_b}' "
                        f"(Pearson r = {r:+.2f}, p-value = {pval:.4e}). "
                        "Note: Correlation denotes empirical co-variation and does not establish causal dependency."
                    ),
                    confidence="high",
                    evidence={
                        "feature_a": col_a,
                        "feature_b": col_b,
                        "pearson_r": r,
                        "p_value": pval,
                        "method": "Pearson product-moment correlation",
                    },
                    calculation_details=f"r = cov({col_a}, {col_b}) / (std({col_a}) * std({col_b})), evaluated against two-sided Student's t distribution.",
                )
            )
        return insights

    def explain_hypothesis_tests(
        self,
        tests: list[dict],
    ) -> list[StructuredInsight]:
        insights = []
        for t in tests[:4]:
            is_rej = t.get("is_rejected", False)
            p_val = t.get("p_value", 1.0)
            t_name = t.get("test_name", "")
            f_a = t.get("feature_a", "")
            f_b = t.get("feature_b", "")

            decision = "Significant Difference" if is_rej else "Inconclusive Difference"
            insights.append(
                StructuredInsight(
                    category="hypothesis",
                    title=f"{t_name}: {f_a} by {f_b}",
                    summary=f"{decision} (p = {p_val:.4f}).",
                    plain_english=t.get("interpretation", ""),
                    confidence="high",
                    evidence={
                        "test_name": t_name,
                        "test_statistic": t.get("statistic_value"),
                        "statistic_name": t.get("statistic_name"),
                        "p_value": p_val,
                        "alpha": t.get("alpha", 0.05),
                        "null_hypothesis": t.get("null_hypothesis"),
                        "alternative_hypothesis": t.get("alt_hypothesis"),
                    },
                    calculation_details=f"{t_name} computed with alpha=0.05. Rejection criterion: p_value < 0.05.",
                )
            )
        return insights

    def explain_model_comparison(
        self,
        problem_type: str,
        target_name: str,
        best_model: str,
        metrics_summary: dict,
    ) -> list[StructuredInsight]:
        insights = []
        if problem_type == "regression":
            r2 = metrics_summary.get("r2", 0.0)
            rmse = metrics_summary.get("rmse", 0.0)
            mae = metrics_summary.get("mae", 0.0)
            insights.append(
                StructuredInsight(
                    category="modeling",
                    title=f"Benchmark Champion: {best_model}",
                    summary=f"Achieved top predictive fit (R² = {r2:.3f}, RMSE = {rmse:.2f}).",
                    plain_english=(
                        f"Out of all benchmarked regression algorithms, '{best_model}' demonstrated optimal predictive capability "
                        f"on un-seen test observations, explaining {r2 * 100:.1f}% of target variance with an average absolute error (MAE) of {mae:.2f}."
                    ),
                    confidence="high",
                    evidence={
                        "model": best_model,
                        "target": target_name,
                        "r2_test": r2,
                        "rmse_test": rmse,
                        "mae_test": mae,
                        "evaluation_protocol": "80/20 train/test split with k-fold cross-validation",
                    },
                    calculation_details="R² = 1 - (SS_res / SS_tot) evaluated strictly on test partition.",
                )
            )
        elif "classification" in problem_type:
            acc = metrics_summary.get("accuracy", "0.0%")
            f1 = metrics_summary.get("f1_macro", 0.0)
            insights.append(
                StructuredInsight(
                    category="modeling",
                    title=f"Benchmark Champion: {best_model}",
                    summary=f"Achieved top balanced score (F1 = {f1:.3f}, Acc = {acc}).",
                    plain_english=(
                        f"'{best_model}' delivered the strongest generalization performance across classes "
                        f"with a macro-averaged F1 score of {f1:.3f} and accuracy of {acc}."
                    ),
                    confidence="high",
                    evidence={
                        "model": best_model,
                        "target": target_name,
                        "f1_macro": f1,
                        "accuracy": acc,
                        "evaluation_protocol": "Stratified 80/20 split with stratified k-fold cross-validation",
                    },
                    calculation_details="Macro F1 = unweighted arithmetic mean of F1 scores across individual target categories.",
                )
            )
        return insights


class LocalLLMExplanationProvider(ExplanationProvider):
    """Extensibility stub for optional offline LLM or local Ollama/transformers models."""

    def __init__(self, fallback: ExplanationProvider | None = None):
        self.fallback = fallback or TemplateExplanationProvider()

    def explain_data_quality(self, *args, **kwargs) -> list[StructuredInsight]:
        # Gracefully delegates to deterministic provider in MVP
        return self.fallback.explain_data_quality(*args, **kwargs)

    def explain_relationships(self, *args, **kwargs) -> list[StructuredInsight]:
        return self.fallback.explain_relationships(*args, **kwargs)

    def explain_hypothesis_tests(self, *args, **kwargs) -> list[StructuredInsight]:
        return self.fallback.explain_hypothesis_tests(*args, **kwargs)

    def explain_model_comparison(self, *args, **kwargs) -> list[StructuredInsight]:
        return self.fallback.explain_model_comparison(*args, **kwargs)
