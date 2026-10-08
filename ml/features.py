import numpy as np
import pandas as pd


def _future_temps(ts: np.ndarray, values: np.ndarray, horizon_ms: int) -> np.ndarray:
    targets = ts + horizon_ms
    index = np.searchsorted(ts, targets, side="left")
    valid = index < len(ts)
    clipped = np.clip(index, 0, len(ts) - 1)
    result = np.where(valid, values[clipped], np.nan)
    return result.astype("float64")


def build_features(
    frame: pd.DataFrame,
    horizon_ms: int = 15000,
    lags: int = 8,
) -> tuple[pd.DataFrame, pd.Series, pd.DataFrame]:
    if frame.empty:
        return pd.DataFrame(), pd.Series(name="target", dtype="float64"), pd.DataFrame()
    ordered = frame.sort_values(["node_id", "ts"]).reset_index(drop=True)
    parts: list[pd.DataFrame] = []
    for node_id in ordered["node_id"].unique():
        group = ordered[ordered["node_id"] == node_id].reset_index(drop=True)
        built = pd.DataFrame(index=group.index)
        for step in range(1, lags + 1):
            built[f"temp_lag_{step}"] = group["current_temp"].shift(step)
        built["temp_delta"] = group["current_temp"].diff(1)
        built["temp_ma5"] = group["current_temp"].rolling(5, min_periods=1).mean()
        built["temp_std5"] = group["current_temp"].rolling(5, min_periods=2).std()
        built["workload"] = group["workload"]
        built["fan_active"] = group["fan_active"].fillna(0)
        built["status"] = group["status"].fillna(0)
        built["queue_length"] = group["queue_length"].fillna(0)
        built["stack_size"] = group["stack_size"].fillna(0)
        built["target_temp"] = group["target_temp"]
        built["ambient_temp"] = group["ambient_temp"]
        built["rel_time_ms"] = group["ts"] - group["ts"].iloc[0]
        built["target"] = _future_temps(
            group["ts"].to_numpy(dtype="int64"),
            group["current_temp"].to_numpy(dtype="float64"),
            horizon_ms,
        )
        built["_node_id"] = node_id
        built["_ts"] = group["ts"]
        parts.append(built)
    features = pd.concat(parts, ignore_index=True).dropna().reset_index(drop=True)
    meta = features[["_node_id", "_ts"]].rename(columns={"_node_id": "node_id", "_ts": "ts"})
    labels = features["target"].astype("float64")
    matrix = features.drop(columns=["target", "_node_id", "_ts"])
    return matrix, labels, meta