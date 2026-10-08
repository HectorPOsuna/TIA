import pandas as pd

from ml.anomaly import fit_abs_threshold, flag_anomalies


def test_fit_threshold_basic():
    threshold = fit_abs_threshold([0.1, 0.2, 0.3, 0.2, 0.15], sigma=3.0)
    assert threshold > 0.3


def test_flag_anomalies_picks_outliers():
    meta = pd.DataFrame(
        {
            "node_id": ["node-1", "node-1", "node-1"],
            "ts": [1_700_000_000_000, 1_700_000_000_001, 1_700_000_000_002],
        }
    )
    alerts = flag_anomalies([10.0, 10.0, 10.0], [10.0, 10.0, 20.0], threshold=2.0, meta=meta)

    assert len(alerts) == 1
    assert alerts[0]["node_id"] == "node-1"
    assert alerts[0]["ts"] == 1_700_000_000_002
    assert alerts[0]["kind"] == "alert"
    assert alerts[0]["type"] == "ai"
    assert alerts[0]["meta"]["residual"] == 10.0


def test_flag_anomalies_clean_series():
    meta = pd.DataFrame({"node_id": ["node-1", "node-1"], "ts": [1, 2]})
    alerts = flag_anomalies([10.0, 11.0], [10.1, 10.9], threshold=2.0, meta=meta)
    assert alerts == []