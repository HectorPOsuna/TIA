export function recommend(predictedTemp, targetTemp) {
  if (!Number.isFinite(predictedTemp) || !Number.isFinite(targetTemp)) {
    return {
      tone: 'badge--muted',
      label: 'sin datos',
      detail: 'Aún no hay predicción para este nodo.',
    }
  }
  const delta = predictedTemp - targetTemp
  if (Math.abs(delta) <= 1) {
    return {
      tone: 'badge--ok',
      label: 'estable',
      detail: `Se mantiene en objetivo (±1 °C) a ${delta >= 0 ? '+' : ''}${delta.toFixed(1)} °C.`,
    }
  }
  if (delta > 1) {
    return {
      tone: 'badge--warn',
      label: 'enfriar',
      detail: `Subida prevista de ${delta.toFixed(1)} °C sobre el objetivo; valora ventilador o reducir carga.`,
    }
  }
  return {
    tone: 'badge--info',
    label: 'subir carga',
    detail: `Bajará ${Math.abs(delta).toFixed(1)} °C por debajo del objetivo; puedes aumentar carga.`,
  }
}
