import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
MODEL = ROOT / "ml" / "out" / "model.joblib"

pytestmark = pytest.mark.skipif(not MODEL.exists(), reason="modelo no entrenado (ml/out/model.joblib)")


def _samples(n: int = 40):
    rows = []
    for i in range(n):
        rows.append(
            {
                "ts": 1_700_000_000_000 + i * 1000,
                "currentTemp": 25.0 + i * 0.1,
                "targetTemp": 30.0,
                "ambientTemp": 20.0,
                "workload": 0.3,
                "status": 0,
                "fanActive": 0,
                "queueLength": 0,
                "stackSize": 0,
            }
        )
    return rows


def test_ping():
    from ml.worker import Worker

    worker = Worker()
    res = worker.handle(json.dumps({"id": 1, "cmd": "ping"}))
    assert res["ok"] is True
    assert res["id"] == 1


def test_version():
    from ml.worker import Worker

    worker = Worker()
    res = worker.handle(json.dumps({"id": 2, "cmd": "version"}))
    assert res["ok"] is True
    assert "version" in res


def test_predict_returns_temperature():
    from ml.worker import Worker

    worker = Worker()
    res = worker.handle(
        json.dumps({"id": 3, "cmd": "predict", "nodeId": "node-1", "samples": _samples(), "horizonMs": 15000})
    )
    assert res["ok"] is True, res
    assert isinstance(res["predictedTemp"], float)
    assert res["meta"]["horizonMs"] == 15000


def test_bad_json():
    from ml.worker import Worker

    worker = Worker()
    res = worker.handle("{no es json")
    assert res["ok"] is False


def test_unknown_command():
    from ml.worker import Worker

    worker = Worker()
    res = worker.handle(json.dumps({"id": 4, "cmd": "desconocido"}))
    assert res["ok"] is False
