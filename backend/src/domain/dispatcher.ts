import type { SimNode } from './node.js';
import type { PriorityTaskQueue } from './tasks.js';
import type { Task } from './types.js';

export interface DispatchAssignment {
  node: SimNode;
  task: Task;
}

export function pickCoolestWorker(workers: ReadonlyArray<SimNode>): SimNode | null {
  let best: SimNode | null = null;
  for (const node of workers) {
    if (!node.active || node.processingTask !== null || node.queueSize > 0) {
      continue;
    }
    if (best === null || node.currentTemp < best.currentTemp) {
      best = node;
    }
  }
  return best;
}

export function dispatchHighestPriority(
  workers: ReadonlyArray<SimNode>,
  pool: PriorityTaskQueue,
): DispatchAssignment | null {
  const task = pool.peek();
  if (task === null) {
    return null;
  }
  const node = pickCoolestWorker(workers);
  if (node === null) {
    return null;
  }
  const assigned = pool.poll();
  if (assigned === null) {
    return null;
  }
  return { node, task: assigned };
}