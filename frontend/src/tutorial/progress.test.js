import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_PROGRESS,
  TUTORIAL_STORAGE_KEY,
  clampIndex,
  markExplored,
  nextIndex,
  parseProgress,
  previousIndex,
  readProgress,
  reset,
  serializeProgress,
  toggle,
  writeProgress,
} from './progress.js';

const ids = ['hud-brand', 'hud-metrics', 'legend'];

test('parseProgress lee un valor válido', () => {
  assert.deepEqual(parseProgress('{"index":3,"visible":false,"explored":["legend"]}', 5, ids), {
    index: 3,
    visible: false,
    explored: ['legend'],
  });
});

test('parseProgress usa el valor por defecto con JSON corrupto', () => {
  assert.deepEqual(parseProgress('{ roto', 5, ids), DEFAULT_PROGRESS);
  assert.deepEqual(parseProgress(null, 5, ids), DEFAULT_PROGRESS);
  assert.deepEqual(parseProgress('null', 5, ids), DEFAULT_PROGRESS);
});

test('parseProgress descarta índices fuera de rango', () => {
  assert.deepEqual(parseProgress('{"index":9,"visible":false}', 5, ids), {
    index: 0,
    visible: false,
    explored: [],
  });
  assert.deepEqual(parseProgress('{"index":-1}', 5, ids), DEFAULT_PROGRESS);
  assert.deepEqual(parseProgress('{"index":1.5}', 5, ids), DEFAULT_PROGRESS);
});

test('parseProgress admite progreso anterior sin explored', () => {
  assert.deepEqual(parseProgress('{"index":2,"visible":true}', 5, ids), {
    index: 2,
    visible: true,
    explored: [],
  });
});

test('parseProgress filtra ids desconocidos y duplicados', () => {
  const raw = '{"index":0,"visible":true,"explored":["legend","otro","legend",3]}';
  assert.deepEqual(parseProgress(raw, 5, ids).explored, ['legend']);
});

test('clampIndex acota los límites de navegación', () => {
  assert.equal(clampIndex(-3, 5), 0);
  assert.equal(clampIndex(9, 5), 4);
  assert.equal(clampIndex(2, 5), 2);
  assert.equal(clampIndex(0, 0), 0);
});

test('nextIndex y previousIndex respetan los extremos', () => {
  assert.equal(nextIndex(0, 5), 1);
  assert.equal(nextIndex(4, 5), 4);
  assert.equal(previousIndex(0, 5), 0);
  assert.equal(previousIndex(4, 5), 3);
});

test('reset vuelve al inicio visible y sin explorados', () => {
  assert.deepEqual(reset(), { index: 0, visible: true, explored: [] });
});

test('toggle alterna la visibilidad sin mover el paso ni los explorados', () => {
  const progress = { index: 4, visible: true, explored: ['legend'] };
  assert.deepEqual(toggle(progress), { index: 4, visible: false, explored: ['legend'] });
  assert.deepEqual(toggle(toggle(progress)), progress);
});

test('markExplored añade el id una sola vez', () => {
  const progress = { index: 1, visible: true, explored: ['legend'] };
  assert.deepEqual(markExplored(progress, 'hud-brand'), {
    index: 1,
    visible: true,
    explored: ['legend', 'hud-brand'],
  });
  assert.equal(markExplored(progress, 'legend'), progress);
});

test('serializeProgress guarda índice, visibilidad y explorados', () => {
  assert.equal(
    serializeProgress({ index: 2, visible: false, explored: ['legend'] }),
    '{"index":2,"visible":false,"explored":["legend"]}',
  );
});

function fakeStorage(initial) {
  const values = new Map(initial ? [[TUTORIAL_STORAGE_KEY, initial]] : []);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test('readProgress y writeProgress conservan los explorados', () => {
  const storage = fakeStorage('{"index":2,"visible":true,"explored":["legend"]}');
  assert.deepEqual(readProgress(storage, 5, ids), {
    index: 2,
    visible: true,
    explored: ['legend'],
  });
  writeProgress(storage, { index: 3, visible: false, explored: ['hud-brand'] });
  assert.equal(
    storage.getItem(TUTORIAL_STORAGE_KEY),
    '{"index":3,"visible":false,"explored":["hud-brand"]}',
  );
});

test('la persistencia tolera un storage que falla', () => {
  const storage = {
    getItem: () => {
      throw new Error('bloqueado');
    },
    setItem: () => {
      throw new Error('bloqueado');
    },
  };
  assert.deepEqual(readProgress(storage, 5, ids), DEFAULT_PROGRESS);
  assert.doesNotThrow(() => writeProgress(storage, DEFAULT_PROGRESS));
});
