import assert from 'node:assert/strict';
import test from 'node:test';
import { cameraDistance, computeLayout } from './layout.js';

test('sin workers deja solo el nodo general', () => {
  const layout = computeLayout([], 'node-general');
  assert.deepEqual(layout.positionsBy, { 'node-general': { x: 0, z: 4.1 } });
});

test('cuatro workers forman una rejilla simétrica', () => {
  const layout = computeLayout(['node-1', 'node-2', 'node-3', 'node-4'], 'node-general');
  assert.deepEqual(layout.positionsBy['node-1'], { x: -1.5, z: 1.5 });
  assert.deepEqual(layout.positionsBy['node-4'], { x: 1.5, z: -1.5 });
  assert.deepEqual(layout.center, { x: 0, z: 2.05 });
  assert.equal(layout.halfWidth, 2.55);
  assert.equal(layout.halfDepth, 4.6);
});

test('el modo retrato usa una sola columna', () => {
  const layout = computeLayout(['node-1', 'node-2'], 'node-general', true);
  assert.equal(layout.positionsBy['node-1'].x, 0);
  assert.equal(layout.positionsBy['node-2'].x, 0);
  assert.ok(layout.positionsBy['node-1'].z > layout.positionsBy['node-2'].z);
});

test('las posiciones no se repiten', () => {
  const layout = computeLayout(['node-1', 'node-2', 'node-3'], 'node-general');
  const unique = new Set(Object.values(layout.positionsBy).map((p) => `${p.x},${p.z}`));
  assert.equal(unique.size, 4);
});

test('la cámara se aleja con escenas más anchas', () => {
  assert.ok(cameraDistance(10, 5, 1) > cameraDistance(5, 5, 1));
});

test('la cámara se aleja con aspecto estrecho', () => {
  assert.ok(cameraDistance(5, 5, 0.5) > cameraDistance(5, 5, 2));
});
