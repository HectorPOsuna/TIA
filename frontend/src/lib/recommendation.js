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
      detail: `Dentro de ±1 °C del objetivo (${delta >= 0 ? '+' : ''}${delta.toFixed(1)} °C).`,
    }
  }
  if (delta > 1) {
    return {
      tone: 'badge--warn',
      label: 'enfriar',
      detail: `Se prevé ${delta.toFixed(1)} °C sobre el objetivo; valora ventilador o reducir carga.`,
    }
  }
  return {
    tone: 'badge--info',
    label: 'subir carga',
    detail: `Se prevé ${Math.abs(delta).toFixed(1)} °C bajo el objetivo; puedes aumentar carga.`,
  }
}
