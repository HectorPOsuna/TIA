import assert from 'node:assert/strict';
import test from 'node:test';
import { recommend } from './recommendation.js';

test('sin predicción devuelve estado sin datos', () => {
  const result = recommend(Number.NaN, 30);
  assert.equal(result.tone, 'badge--muted');
  assert.equal(result.label, 'sin datos');
});

test('dentro de ±1 °C devuelve estable', () => {
  assert.equal(recommend(31, 30).label, 'estable');
  assert.equal(recommend(29, 30).label, 'estable');
});

test('por encima de +1 °C recomienda enfriar', () => {
  const result = recommend(31.1, 30);
  assert.equal(result.tone, 'badge--warn');
  assert.equal(result.label, 'enfriar');
});

test('por debajo de -1 °C recomienda subir carga', () => {
  const result = recommend(28.9, 30);
  assert.equal(result.tone, 'badge--info');
  assert.equal(result.label, 'subir carga');
});

test('target no finito devuelve sin datos', () => {
  assert.equal(recommend(30, Number.NaN).label, 'sin datos');
});
