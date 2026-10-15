import json
import sys
import time
import traceback
from pathlib import Path
from typing import Any, Dict

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

try:
    from ml import config
    from ml import model as model_mod  # noqa: F401
    from ml import features as features_mod
except Exception:  # pragma: no cover
    import config  # type: ignore
    import features as features_mod  # type: ignore

import joblib
import pandas as pd


class Worker:
    def __init__(self) -> None:
        self.cfg = config.Settings()
        self.model, self.meta = self._load_model()
        self.buffers: Dict[str, list[Dict[str, Any]]] = {}
        self.max_buf = 25

    def _load_model(self):
        out_dir = self.cfg.ROOT / "ml" / "out"
        model_path = out_dir / "model.joblib"
        meta_path = out_dir / "model.json"
        if not model_path.exists():
            raise FileNotFoundError(f"No existe modelo entrenado: {model_path}")
        m = joblib.load(model_path)
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                meta = {}
        return m, meta

    def _ensure_ordered(self, df: pd.DataFrame) -> pd.DataFrame:
        if "ts" in df.columns:
            df = df.sort_values("ts").reset_index(drop=True)
        return df

    def handle_predict(self, req: Dict[str, Any]) -> Dict[str, Any]:
        t0 = time.perf_counter()
        node_id = req.get("nodeId") or req.get("node_id")
        samples = req.get("samples") or []
        horizon_ms = req.get("horizonMs", self.cfg.ML_HORIZON_MS)
        if not node_id:
            return {"ok": False, "error": "missing nodeId"}
        rows = []
        for x in samples:
            rows.append(
                {
                    "ts": x.get("ts"),
                    "node_id": node_id,
                    "current_temp": x.get("currentTemp") or x.get("current_temp"),
                    "target_temp": x.get("targetTemp") or x.get("target_temp"),
                    "ambient_temp": x.get("ambientTemp") or x.get("ambient_temp"),
                    "workload": x.get("workload"),
                    "status": x.get("status"),
                    "fan_active": x.get("fanActive") if "fanActive" in x else x.get("fan_active"),
                    "queue_length": x.get("queueLength") if "queueLength" in x else x.get("queue_length"),
                    "stack_size": x.get("stackSize") if "stackSize" in x else x.get("stack_size"),
                }
            )
        df = pd.DataFrame(rows)
        if df.empty:
            return {"ok": False, "error": "no samples"}
        df = self._ensure_ordered(df)
        try:
            X, _, _ = features_mod.build_features(df, horizon_ms=int(horizon_ms))
        except Exception as e:
            return {"ok": False, "error": f"features: {e}"}
        if X is None or X.empty:
            return {"ok": False, "error": "empty features"}
        Xf = X.iloc[[-1]].copy()
        try:
            pred = float(self.model.predict(Xf)[0])
        except Exception as e:
            return {"ok": False, "error": f"predict: {e}"}
        dt_ms = int((time.perf_counter() - t0) * 1000)
        mv = (self.meta or {}).get("model_version") or (self.meta or {}).get("git_sha") or "unknown"
        feats_hash = None
        try:
            import hashlib

            h = hashlib.sha256(pd.util.hash_pandas_object(Xf, index=True).values.tobytes()).hexdigest()[:16]
            feats_hash = h
        except Exception:
            feats_hash = None
        return {
            "ok": True,
            "predictedTemp": pred,
            "modelVersion": mv,
            "latencyMs": dt_ms,
            "featuresHash": feats_hash,
            "meta": {"horizonMs": int(horizon_ms), "n_samples": int(len(df))},
        }

    def handle(self, line: str) -> Dict[str, Any]:
        try:
            req = json.loads(line)
        except Exception as e:
            return {"ok": False, "error": f"bad json: {e}"}
        rid = req.get("id")
        cmd = req.get("cmd")
        if cmd == "ping":
            res = {"ok": True, "pong": time.time()}
        elif cmd == "predict":
            res = self.handle_predict(req)
        elif cmd == "version":
            res = {"ok": True, "version": (self.meta or {}).get("model_version"), "meta": self.meta}
        else:
            res = {"ok": False, "error": f"unknown cmd: {cmd}"}
        if rid is not None:
            res["id"] = rid
        return res


def main():
    w = Worker()
    try:
        for line in sys.stdin:
            try:
                line = line.rstrip("\n\r")
            except Exception:
                continue
            if not line:
                continue
            out = w.handle(line)
            sys.stdout.write(json.dumps(out) + "\n")
            sys.stdout.flush()
    except EOFError:
        pass
    except Exception:
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()