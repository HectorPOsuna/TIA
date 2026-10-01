import { describe, expect, it } from 'vitest';
import { EventStack } from '../src/domain/stack.js';
import { PriorityTaskQueue } from '../src/domain/tasks.js';

describe('cola de prioridad de tareas', () => {
  it('procesa primero la tarea de mayor prioridad', () => {
    const queue = new PriorityTaskQueue(10);
    queue.enqueue({ type: 'maintenance', priority: 1, description: 'baja prioridad' });
    queue.enqueue({ type: 'cooldown', priority: 5, description: 'urgencia' });
    queue.enqueue({ type: 'custom', priority: 3, description: 'media' });

    const first = queue.startProcessing();
    const second = queue.startProcessing();
    const third = queue.startProcessing();
    expect(first?.description).toBe('urgencia');
    expect(second?.description).toBe('media');
    expect(third?.description).toBe('baja prioridad');
  });

  it('en empate de prioridad respeta el orden de encolado (FIFO)', () => {
    const queue = new PriorityTaskQueue(10);
    queue.enqueue({ type: 'custom', priority: 3, enqueuedAt: 100, description: 'primera' });
    queue.enqueue({ type: 'custom', priority: 3, enqueuedAt: 200, description: 'segunda' });
    queue.enqueue({ type: 'custom', priority: 3, enqueuedAt: 300, description: 'tercera' });

    expect(queue.startProcessing()?.description).toBe('primera');
    expect(queue.startProcessing()?.description).toBe('segunda');
    expect(queue.startProcessing()?.description).toBe('tercera');
  });

  it('acota los rangos de prioridad, demanda y duración', () => {
    const queue = new PriorityTaskQueue(10);
    const task = queue.enqueue({
      type: 'custom',
      priority: 99,
      computeDemand: 99,
      durationSecs: 99,
    });
    expect(task?.priority).toBe(5);
    expect(task?.computeDemand).toBe(5);
    expect(task?.durationSecs).toBe(10);
  });

  it('respeta el límite de capacidad y rechaza tareas extra', () => {
    const queue = new PriorityTaskQueue(2);
    expect(queue.enqueue({ type: 'custom' })).not.toBeNull();
    expect(queue.enqueue({ type: 'custom' })).not.toBeNull();
    expect(queue.enqueue({ type: 'custom' })).toBeNull();
    expect(queue.isFull()).toBe(true);
    expect(queue.size).toBe(2);
  });

  it('peek devuelve la mayor prioridad sin extraerla', () => {
    const queue = new PriorityTaskQueue(10);
    queue.enqueue({ type: 'maintenance', priority: 1 });
    queue.enqueue({ type: 'cooldown', priority: 5 });
    expect(queue.peek()?.priority).toBe(5);
    expect(queue.size).toBe(2);
    expect(queue.startProcessing()?.priority).toBe(5);
  });

  it('marca una tarea como completada con timestamp', () => {
    const queue = new PriorityTaskQueue(10);
    queue.enqueue({ type: 'reboot', priority: 2, durationSecs: 2 });
    const processing = queue.startProcessing();
    expect(processing?.status).toBe('processing');
    const completed = queue.complete(processing!, Date.now());
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeDefined();
  });

  it('devuelve null si se procesa con cola vacía', () => {
    const queue = new PriorityTaskQueue(10);
    expect(queue.startProcessing()).toBeNull();
    expect(queue.peek()).toBeNull();
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