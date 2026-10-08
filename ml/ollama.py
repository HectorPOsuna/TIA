import json
import time
import urllib.error
import urllib.request
from typing import Any

import pandas as pd

from .config import Settings


def _build_context(frame: pd.DataFrame, alert: dict[str, Any], tail: int = 12) -> dict[str, Any]:
    node_frame = frame[
        (frame["node_id"] == alert["node_id"]) & (frame["ts"] <= alert["ts"])
    ].sort_values("ts")
    window = node_frame.tail(tail)
    if window.empty:
        return {"temps": [], "last": {}}
    temps = [round(float(value), 2) for value in window["current_temp"]]
    last = window.iloc[-1]
    return {
        "temps": temps,
        "last": {
            "target": float(last["target_temp"]),
            "ambient": float(last["ambient_temp"]),
            "workload": float(last["workload"]),
            "fan": bool(last["fan_active"]),
            "status": int(last["status"]),
            "queue": int(last["queue_length"]),
            "stack": int(last["stack_size"]),
        },
    }


def _build_prompt(alert: dict[str, Any], context: dict[str, Any]) -> str:
    meta: dict[str, Any] = alert["meta"]
    last = context["last"]
    return (
        "Eres el sistema de diagnóstico del simulador térmico WAItt. Un modelo de ML "
        "detectó una anomalía de temperatura. Responde ÚNICAMENTE con un objeto JSON "
        'con claves "diagnostico" (causa probable en 1-2 frases) y "accion" (acción '
        "sugerida en 1 frase).\n"
        f"Nodo: {alert['node_id']}\n"
        f"Temperaturas recientes (°C): {context['temps']}\n"
        f"Objetivo: {last['target']} °C | Ambiente: {last['ambient']} °C\n"
        f"Carga (workload): {last['workload']} | Ventilador: {'sí' if last['fan'] else 'no'} "
        f"| Estado: {last['status']}\n"
        f"Cola: {last['queue']} | Pila: {last['stack']}\n"
        f"Residuo de predicción: {meta.get('residual')} °C "
        f"(umbral {meta.get('threshold')} °C)"
    )


def _generate(host: str, model: str, prompt: str, timeout_s: float) -> dict[str, Any]:
    body = json.dumps(
        {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {"temperature": 0.3},
        }
    ).encode("utf-8")
    request = urllib.request.Request(
        f"{host.rstrip('/')}/api/generate",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout_s) as response:
        payload = json.loads(response.read().decode("utf-8"))
    text = str(payload.get("response", "")).strip()
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except (json.JSONDecodeError, TypeError):
        pass
    return {"diagnostico": text, "accion": ""}


def explain_anomalies(
    settings: Settings,
    alerts: list[dict[str, Any]],
    frame: pd.DataFrame,
) -> list[dict[str, Any]]:
    for alert in alerts[: settings.ml_top_k]:
        context = _build_context(frame, alert)
        meta: dict[str, Any] = dict(alert["meta"])
        started = time.monotonic()
        try:
            reply = _generate(
                settings.ollama_host,
                settings.ollama_model,
                _build_prompt(alert, context),
                settings.ollama_timeout_s,
            )
            meta["ollama"] = {
                "model": settings.ollama_model,
                "diagnostico": reply.get("diagnostico", ""),
                "accion": reply.get("accion", ""),
                "latency_ms": round((time.monotonic() - started) * 1000),
            }
        except (urllib.error.URLError, TimeoutError, OSError) as error:
            print(f"warning: Ollama no disponible ({error}); aviso sin explicación")
            meta["ollama"] = {"model": settings.ollama_model, "error": str(error)}
        alert["meta"] = meta
    return alerts