import math

import pandas as pd

from ml.metrics import compute_metrics, mae, rmse


def test_mae_known_values():
    assert math.isclose(mae([1, 2, 3], [2, 2, 2]), 2 / 3, rel_tol=1e-9)


def test_rmse_known_values():
    assert math.isclose(rmse([1, 2, 3], [2, 2, 2]), math.sqrt(2 / 3), rel_tol=1e-9)


def test_compute_metrics_structure():
    meta = pd.DataFrame(
        {
            "node_id": ["node-1", "node-1", "node-2", "node-2"],
            "ts": [1, 2, 3, 4],
        }
    )
    result = compute_metrics([10, 12, 20, 22], [10, 13, 19, 22], [10, 12, 20, 22], meta)

    assert result["mae"] == 0.5
    assert result["baseline_mae"] == 0.0
    assert result["mae_improvement_pct"] == 0.0
    assert set(result["by_node"].keys()) == {"node-1", "node-2"}
    assert result["by_node"]["node-1"]["n"] == 2


def test_compute_metrics_improvement():
    meta = pd.DataFrame({"node_id": ["node-1", "node-1", "node-1"], "ts": [1, 2, 3]})
    result = compute_metrics([10, 11, 12], [10, 11, 12], [10, 15, 20], meta)
    assert math.isclose(result["mae_improvement_pct"], 100.0, rel_tol=1e-9)