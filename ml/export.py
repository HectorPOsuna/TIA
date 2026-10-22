from pathlib import Path
from typing import Any

import pandas as pd

from .db import Database

TELEMETRY_COLUMNS = [
    "node_id",
    "node_type",
    "current_temp",
    "target_temp",
    "ambient_temp",
    "workload",
    "task_heat",
    "status",
    "fan_active",
    "queue_length",
    "stack_size",
]


def export_telemetry(
    db: Database,
    limit: int | None = None,
    since_ms: int | None = None,
) -> pd.DataFrame:
    columns = ", ".join(["ts", *TELEMETRY_COLUMNS])
    sql = f"SELECT {columns} FROM telemetry"
    conditions: list[str] = []
    params: list[Any] = []
    if since_ms is not None:
        conditions.append("ts >= %s")
        params.append(int(since_ms))
    if conditions:
        sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY node_id, ts"
    if limit is not None:
        sql += " LIMIT %s"
        params.append(limit)
    rows = db.query(sql, tuple(params) if params else None)
    if not rows:
        return pd.DataFrame(columns=["ts", *TELEMETRY_COLUMNS])
    frame = pd.DataFrame(rows)
    frame["ts"] = frame["ts"].astype("int64")
    for column in ["current_temp", "target_temp", "ambient_temp", "workload"]:
        frame[column] = frame[column].astype("float64")
    frame["task_heat"] = frame["task_heat"].fillna(0).astype("float64")
    for column in ["status", "fan_active", "queue_length", "stack_size"]:
        frame[column] = frame[column].astype("int64")
    return frame


def write_csv(frame: pd.DataFrame, path: Path) -> Path:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(path, index=False)
    return path