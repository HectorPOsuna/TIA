from typing import Any

import numpy as np
import pandas as pd


def mae(y_true: Any, y_pred: Any) -> float:
    return float(np.mean(np.abs(np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float))))


def rmse(y_true: Any, y_pred: Any) -> float:
    return float(np.sqrt(np.mean((np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float)) ** 2)))


def compute_metrics(
    y_true: Any,
    y_pred: Any,
    baseline: Any,
    meta: pd.DataFrame,
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "mae": mae(y_true, y_pred),
        "rmse": rmse(y_true, y_pred),
        "baseline_mae": mae(y_true, baseline),
        "baseline_rmse": rmse(y_true, baseline),
        "by_node": {},
    }
    baseline_mae = result["baseline_mae"]
    if baseline_mae > 0:
        result["mae_improvement_pct"] = round(
            (result["baseline_mae"] - result["mae"]) / baseline_mae * 100, 2
        )
    else:
        result["mae_improvement_pct"] = 0.0
    for node_id, group in meta.groupby("node_id", sort=False):
        mask = group.index.tolist()
        result["by_node"][str(node_id)] = {
            "mae": mae(np.asarray(y_true)[mask], np.asarray(y_pred)[mask]),
            "rmse": rmse(np.asarray(y_true)[mask], np.asarray(y_pred)[mask]),
            "n": len(mask),
        }
    return result