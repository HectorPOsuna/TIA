import re
from typing import Any

import pymysql
from pymysql.cursors import DictCursor

from .config import Settings

IDENTIFIER_PATTERN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
NAMED_PATTERN = re.compile(r":([A-Za-z_][A-Za-z0-9_]*)")


def _expand_named(sql: str, params: Any) -> tuple[str, tuple[Any, ...]]:
    if params is None:
        return sql, ()
    if isinstance(params, (list, tuple)):
        return sql, tuple(params)
    missing: list[str] = []
    values: list[Any] = []

    def _sub(match: re.Match[str]) -> str:
        name = match.group(1)
        if name in params:
            values.append(params[name])
            return "%s"
        missing.append(name)
        return match.group(0)

    expanded = NAMED_PATTERN.sub(_sub, sql)
    if missing:
        raise ValueError(f"Faltan los parámetros nombrados: {', '.join(missing)}")
    return expanded, tuple(values)


def _sanitize(name: str) -> str:
    if not IDENTIFIER_PATTERN.match(name):
        raise ValueError(f"Identificador de base de datos no válido: {name}")
    return name


class Database:
    def __init__(self, settings: Settings):
        self._conn = pymysql.connect(
            host=settings.db_host,
            port=settings.db_port,
            user=settings.db_user,
            password=settings.db_password,
            database=settings.db_name,
            charset="utf8mb4",
            cursorclass=DictCursor,
        )

    def query(self, sql: str, params: Any = None) -> list[dict[str, Any]]:
        expanded, values = _expand_named(sql, params)
        with self._conn.cursor() as cursor:
            cursor.execute(expanded, values)
            return list(cursor.fetchall())

    def execute(self, sql: str, params: Any = None) -> int:
        expanded, values = _expand_named(sql, params)
        with self._conn.cursor() as cursor:
            cursor.execute(expanded, values)
            rowcount = cursor.rowcount
        self._conn.commit()
        return int(rowcount)

    def insert_many(self, table: str, rows: list[dict[str, Any]]) -> int:
        if not rows:
            return 0
        table_name = _sanitize(table)
        columns = [_sanitize(name) for name in rows[0].keys()]
        tuples = ", ".join(["(" + ", ".join(["%s"] * len(columns)) + ")"] * len(rows))
        sql = f"INSERT INTO `{table_name}` (`{'`, `'.join(columns)}`) VALUES {tuples}"
        values: list[Any] = []
        for row in rows:
            values.extend(row[column] for column in columns)
        return self.execute(sql, values)

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "Database":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()