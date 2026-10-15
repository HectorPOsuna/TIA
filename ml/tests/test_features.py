import numpy as np
import pandas as pd

from ml.features import build_features, build_inference_features


def _series(rows: int, node: str = "node-1") -> pd.DataFrame:
    temps = 25.0 + np.linspace(0.0, 3.0, rows)
    timestamps = 1_700_000_000_000 + np.arange(rows) * 1000
    return pd.DataFrame(
        {
            "ts": timestamps,
            "node_id": [node] * rows,
            "node_type": ["worker"] * rows,
            "current_temp": temps,
            "target_temp": [30.0] * rows,
            "ambient_temp": [20.0] * rows,
            "workload": [0.5] * rows,
            "status": [0] * rows,
            "fan_active": [0] * rows,
            "queue_length": [0] * rows,
            "stack_size": [0] * rows,
        }
    )


def test_features_sanity_rows_and_columns():
    matrix, labels, meta = build_features(_series(20), horizon_ms=2000, lags=3)

    assert not matrix.isna().any().any()
    assert not labels.isna().any()
    assert labels.dtype == np.float64
    assert len(matrix) == len(labels) == len(meta)
    assert len(matrix) == 20 - 3 - 2
    assert {"temp_lag_1", "temp_lag_2", "temp_lag_3", "temp_delta", "temp_ma5", "rel_time_ms"} <= set(
        matrix.columns
    )


def test_features_respects_node_chronology():
    two_nodes = pd.concat([_series(12, "node-1"), _series(12, "node-2")], ignore_index=True)
    matrix, labels, meta = build_features(two_nodes, horizon_ms=2000, lags=2)

    assert meta["node_id"].nunique() == 2
    for node, group in meta.groupby("node_id"):
        deltas = group["ts"].diff().dropna()
        assert (deltas >= 0).all()
        assert len(group) == 12 - 2 - 2


def test_features_empty_frame():
    matrix, labels, meta = build_features(pd.DataFrame(), horizon_ms=2000, lags=3)
    assert matrix.empty and labels.empty and meta.empty


def test_inference_features_returns_latest_row_without_target():
    frame = _series(12)
    row = build_inference_features(frame, lags=3)
    assert len(row) == 1
    assert "target" not in row.columns
    assert {
        "temp_lag_1",
        "temp_lag_2",
        "temp_lag_3",
        "temp_delta",
        "temp_ma5",
        "temp_std5",
        "workload",
        "fan_active",
        "status",
        "queue_length",
        "stack_size",
        "target_temp",
        "ambient_temp",
        "rel_time_ms",
    } <= set(row.columns)
    assert not row.isna().any().any()


def test_inference_features_uses_origin_for_relative_time():
    frame = _series(12)
    row = build_inference_features(frame, origin_ms=int(frame["ts"].iloc[0] - 5000))
    assert row["rel_time_ms"].iloc[0] == int(frame["ts"].iloc[-1] - frame["ts"].iloc[0] + 5000)


def test_inference_features_empty_frame():
    assert build_inference_features(pd.DataFrame()).empty