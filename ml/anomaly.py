from typing import Any

import numpy as np
import pandas as pd

ALERT_KIND = "alert"
ALERT_TYPE = "ai"
ALERT_LABEL = "anomalia-temperatura"


def fit_abs_threshold(train_residual: Any, sigma: float) -> float:
    errors = np.abs(np.asarray(train_residual, dtype=float))
    mean = float(errors.mean())
    std = float(errors.std() + 1e-9)
    return float(mean + sigma * std)


def flag_anomalies(
    y_true: Any,
    y_pred: Any,
    threshold: float,
    meta: pd.DataFrame,
) -> list[dict[str, Any]]:
    errors = np.abs(np.asarray(y_true, dtype=float) - np.asarray(y_pred, dtype=float))
    alerts: list[dict[str, Any]] = []
    for position in range(len(meta)):
        if errors[position] <= threshold:
            continue
        row = meta.iloc[position]
        alerts.append(
            {
                "ts": int(row["ts"]),
                "node_id": str(row["node_id"]),
                "kind": ALERT_KIND,
                "type": ALERT_TYPE,
                "label": ALERT_LABEL,
                "message": f"Residuo de predicción {errors[position]:.2f} °C (umbral {threshold:.2f} °C)",
                "meta": {
                    "residual": round(float(errors[position]), 3),
                    "threshold": round(threshold, 3),
                },
            }
        )
    return alerts