import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib

from .anomaly import fit_abs_threshold, flag_anomalies
from .config import load_settings
from .db import Database
from .export import export_telemetry, write_csv
from .features import build_features
from .metrics import compute_metrics
from .model import DEFAULT_MODEL_PARAMS, MODEL_TYPE, chrono_split, train_model
from .ollama import explain_anomalies


def _json_line(value: dict) -> str:
    return json.dumps(value, ensure_ascii=False)


def _print_metrics(metrics: dict) -> None:
    print("==")
    print(
        f"MAE {metrics['mae']:.3f} °C | RMSE {metrics['rmse']:.3f} °C | "
        f"baseline MAE {metrics['baseline_mae']:.3f} °C | "
        f"mejora {metrics['mae_improvement_pct']:.1f} %"
    )
    for node_id, node_metrics in metrics["by_node"].items():
        print(
            f"  {node_id}: MAE {node_metrics['mae']:.3f} °C | RMSE "
            f"{node_metrics['rmse']:.3f} °C | n={node_metrics['n']}"
        )


def main() -> None:
    parser = argparse.ArgumentParser(description="Pipeline analítico WAItt (S6)")
    parser.add_argument("--write-db", action="store_true", help="inserta las alertas en la tabla events")
    parser.add_argument("--no-ollama", action="store_true", help="salta la explicación con Ollama")
    parser.add_argument("--limit", type=int, default=None, help="límite de filas de telemetría a exportar")
    parser.add_argument("--snapshot", type=Path, default=None, help="ruta del CSV de snapshot")
    args = parser.parse_args()

    settings = load_settings()
    out_dir = settings.out_dir
    data_dir = settings.data_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    data_dir.mkdir(parents=True, exist_ok=True)

    with Database(settings) as database:
        telemetry = export_telemetry(database, limit=args.limit)
        if telemetry.empty:
            raise SystemExit("No hay telemetría en la BD; ejecuta el backend primero")
        snapshot_path = args.snapshot or data_dir / "telemetry.csv"
        write_csv(telemetry, snapshot_path)

    print(f"Telemetría exportada: {len(telemetry)} filas, {telemetry['node_id'].nunique()} nodos")
    matrix, labels, meta = build_features(telemetry, horizon_ms=settings.ml_horizon_ms)
    if matrix.empty:
        raise SystemExit("Datos insuficientes tras el feature engineering (ventana de lags)")

    train_pos, test_pos = chrono_split(meta, settings.ml_test_fraction)
    model = train_model(matrix, labels, train_pos, settings.ml_seed)

    y_test = labels.iloc[test_pos].to_numpy()
    y_pred_test = model.predict(matrix.iloc[test_pos])
    baseline_test = matrix["temp_lag_1"].iloc[test_pos].to_numpy()
    meta_test = meta.iloc[test_pos].reset_index(drop=True)
    metrics = compute_metrics(y_test, y_pred_test, baseline_test, meta_test)
    metrics["samples"] = {"train": len(train_pos), "test": len(test_pos)}
    metrics["horizon_ms"] = settings.ml_horizon_ms

    test_residual = y_test - y_pred_test
    threshold = fit_abs_threshold(test_residual, settings.ml_threshold_sigma)
    anomalies = flag_anomalies(y_test, y_pred_test, threshold, meta_test)

    if anomalies and not args.no_ollama:
        anomalies = explain_anomalies(settings, anomalies, telemetry)

    metrics["anomalies"] = {
        "count": len(anomalies),
        "threshold": threshold,
        "sigma": settings.ml_threshold_sigma,
    }

    trained_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    model_path = out_dir / "model.joblib"
    joblib.dump(model, model_path)
    (out_dir / "model.json").write_text(
        _json_line(
            {
                "model_type": MODEL_TYPE,
                "params": DEFAULT_MODEL_PARAMS,
                "columns": matrix.columns.tolist(),
                "horizon_ms": settings.ml_horizon_ms,
                "seed": settings.ml_seed,
                "threshold": threshold,
                "trained_at": trained_at,
                "metrics": {key: value for key, value in metrics.items() if key != "by_node"},
            }
        ),
        encoding="utf-8",
    )
    (out_dir / "metrics.json").write_text(_json_line(metrics), encoding="utf-8")
    alerts_path = out_dir / "alerts.jsonl"
    with open(alerts_path, "w", encoding="utf-8") as stream:
        for alert in anomalies:
            stream.write(_json_line(alert) + "\n")

    print(f"Modelo: {model_path}")
    print(f"Snapshot: {snapshot_path}")
    print(f"Alertas: {len(anomalies)} ({alerts_path})")
    _print_metrics(metrics)

    if args.write_db and anomalies:
        rows = []
        for alert in anomalies:
            row = dict(alert)
            row["meta"] = json.dumps(alert["meta"], ensure_ascii=False)
            rows.append(row)
        with Database(settings) as database:
            inserted = database.insert_many("events", rows)
        print(f"Alertas insertadas en events: {inserted}")


if __name__ == "__main__":
    main()