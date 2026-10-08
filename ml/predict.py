import argparse
import json
from pathlib import Path

import joblib

from .config import load_settings
from .db import Database
from .export import export_telemetry
from .features import build_features


def _load_metadata(settings) -> dict:
    path = settings.out_dir / "model.json"
    return json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}


def main() -> None:
    parser = argparse.ArgumentParser(description="Inferencia con el modelo entrenado (S6)")
    parser.add_argument("--node", required=True, help="node_id a predecir")
    args = parser.parse_args()

    settings = load_settings()
    model_path = settings.out_dir / "model.joblib"
    if not model_path.exists():
        raise SystemExit("No hay modelo entrenado; ejecuta primero `python -m ml.train`")
    model = joblib.load(model_path)
    metadata = _load_metadata(settings)
    threshold: float | None = metadata.get("threshold")
    horizon_ms: int = metadata.get("horizon_ms", settings.ml_horizon_ms)

    with Database(settings) as database:
        telemetry = export_telemetry(database, limit=None)
    node_frame = telemetry[telemetry["node_id"] == args.node]
    if node_frame.empty:
        raise SystemExit(f"No hay telemetría del nodo {args.node}")

    matrix, _, meta = build_features(node_frame, horizon_ms=0)
    if matrix.empty:
        raise SystemExit("Datos insuficientes del nodo para construir las features")

    last = matrix.iloc[[-1]]
    prediction = float(model.predict(last)[0])
    last_temp = float(last["temp_lag_1"].iloc[0])
    next_ts = int(meta["ts"].iloc[-1]) + horizon_ms

    print(f"Nodo: {args.node} ({len(matrix)} observaciones con features)")
    print(f"Última temperatura observada: {last_temp:.2f} °C")
    print(f"Predicción de temperatura (t+{horizon_ms / 1000:.0f} s): {prediction:.2f} °C")
    print(f"Temperatura objetivo: {float(last['target_temp'].iloc[0]):.2f} °C")
    if threshold is not None:
        deviation = abs(prediction - last_temp)
        status = "anomalía" if deviation > threshold else "normal"
        print(f"Desviación frente a último valor: {deviation:.2f} °C (umbral {threshold:.2f}) -> {status}")
    print(f"Instante previsto (t+{horizon_ms / 1000:.0f} s): {next_ts}")


if __name__ == "__main__":
    main()