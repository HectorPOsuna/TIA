import { describe, expect, it } from 'vitest';
import { EventStack } from '../src/domain/stack.js';
import { TaskQueue } from '../src/domain/tasks.js';

describe('cola FIFO de tareas', () => {
  it('procesa en orden de encolado', () => {
    const queue = new TaskQueue(10);
    const a = queue.enqueue({ type: 'cooldown', description: 'tarea A' });
    const b = queue.enqueue({ type: 'maintenance', description: 'tarea B' });
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();

    const first = queue.startProcessing();
    const second = queue.startProcessing();
    expect(first?.description).toBe('tarea A');
    expect(second?.description).toBe('tarea B');
  });

  it('respeta el límite de capacidad y rechaza tareas extra', () => {
    const queue = new TaskQueue(2);
    expect(queue.enqueue({ type: 'custom' })).not.toBeNull();
    expect(queue.enqueue({ type: 'custom' })).not.toBeNull();
    expect(queue.enqueue({ type: 'custom' })).toBeNull();
    expect(queue.isFull()).toBe(true);
    expect(queue.size).toBe(2);
  });

  it('marca una tarea como completada con timestamp', () => {
    const queue = new TaskQueue(10);
    const task = queue.enqueue({ type: 'reboot', estimatedDurationMs: 1000 });
    expect(task).not.toBeNull();
    const processing = queue.startProcessing();
    expect(processing?.status).toBe('processing');
    const completed = queue.complete(processing!, Date.now());
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();
  });

  it('devuelve null si se procesa con cola vacía', () => {
    const queue = new TaskQueue(10);
    expect(queue.startProcessing()).toBeNull();
  });
});

describe('pila LIFO de eventos', () => {
  it('apila los eventos más recientes al frente', () => {
    const stack = new EventStack(5);
    stack.push('event', 'primero');
    stack.push('event', 'segundo');
    stack.push('event', 'tercero');

    const entries = stack.toArray();
    expect(entries[0].label).toBe('tercero');
    expect(entries[2].label).toBe('primero');
    expect(entries).toHaveLength(3);
  });

  it('recorta los eventos más antiguos al superar la capacidad', () => {
    const stack = new EventStack(3);
    stack.push('event', 'e1');
    stack.push('event', 'e2');
    stack.push('event', 'e3');
    stack.push('event', 'e4');

    const entries = stack.toArray();
    expect(entries).toHaveLength(3);
    expect(entries[0].label).toBe('e4');
    expect(entries[2].label).toBe('e2');
  });

  it('peek devuelve el evento más reciente sin modificarlo', () => {
    const stack = new EventStack(5);
    stack.push('task', 'tarea');
    expect(stack.peek()?.label).toBe('tarea');
    expect(stack.size).toBe(1);
  });
});