import { describe, expect, it } from 'vitest';
import { dispatchHighestPriority, pickCoolestWorker } from '../src/domain/dispatcher.js';
import { PriorityTaskQueue } from '../src/domain/tasks.js';
import { SystemSimulation } from '../src/domain/system.js';

const seed = {
  initialNodes: 3,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 20,
};

describe('dispatcher (estrangulamiento térmico)', () => {
  it('asigna la tarea de mayor prioridad al nodo activo libre más frío', () => {
    const system = new SystemSimulation(seed);
    const [n1, n2, n3] = system.workers;
    n1.currentTemp = 30;
    n2.currentTemp = 25;
    n3.currentTemp = 40;

    const pool = new PriorityTaskQueue(20);
    pool.enqueue({ type: 'maintenance', priority: 1, durationSecs: 3 });
    pool.enqueue({ type: 'cooldown', priority: 5, durationSecs: 5 });

    const first = dispatchHighestPriority(system.workers, pool);
    expect(first?.node.id).toBe('node-2');
    expect(first?.task.priority).toBe(5);
    first.node.startExternalTask(first.task);

    const second = dispatchHighestPriority(system.workers, pool);
    expect(second?.node.id).toBe('node-1');
    expect(second?.task.priority).toBe(1);
  });

  it('ignora nodos inactivos', () => {
    const system = new SystemSimulation(seed);
    system.workers[0].status = 'inactive';
    system.workers[1].currentTemp = 22;

    const pool = new PriorityTaskQueue(20);
    pool.enqueue({ type: 'custom', priority: 5 });

    const assignment = dispatchHighestPriority(system.workers, pool);
    expect(assignment?.node.id).toBe('node-2');
  });

  it('excluye nodos con cola local pendiente', () => {
    const system = new SystemSimulation(seed);
    system.workers[0].enqueueTask({ type: 'custom', priority: 3 });
    system.workers[1].currentTemp = 20;

    const pool = new PriorityTaskQueue(20);
    pool.enqueue({ type: 'custom', priority: 5 });

    const assignment = dispatchHighestPriority(system.workers, pool);
    expect(assignment?.node.id).toBe('node-2');
  });

  it('devuelve null sin tareas o sin nodos elegibles', () => {
    const system = new SystemSimulation(seed);
    system.workers.forEach((n) => {
      n.status = 'error';
    });

    const occupiedPool = new PriorityTaskQueue(20);
    occupiedPool.enqueue({ type: 'custom', priority: 5 });
    expect(dispatchHighestPriority(system.workers, occupiedPool)).toBeNull();
    expect(occupiedPool.peek()).not.toBeNull();

    const emptyPool = new PriorityTaskQueue(20);
    expect(dispatchHighestPriority(system.workers, emptyPool)).toBeNull();
  });

  it('pickCoolestWorker devuelve el nodo libre más frío entre activos', () => {
    const system = new SystemSimulation(seed);
    const coolest = pickCoolestWorker(system.workers);
    expect(coolest).not.toBeNull();
    expect(coolest!.active).toBe(true);
  });
});