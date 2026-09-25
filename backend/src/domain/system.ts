import { SimNode } from './node.js';
import type { NodeConfig } from './node.js';
import type { NodeDto, SystemSnapshotDto } from './types.js';

export interface SeedOptions {
  initialNodes: number;
  initialTemp: number;
  targetTemp: number;
  ambientTemp: number;
  queueCapacity: number;
  stackCapacity: number;
  maxConsecutiveFailures: number;
}

export class SystemSimulation {
  running = true;
  startedAt: number;

  private readonly generalNodeValue: SimNode;
  private readonly workersValue: SimNode[] = [];

  constructor(private readonly seed: SeedOptions) {
    this.startedAt = Date.now();
    this.generalNodeValue = new SimNode({
      id: 'node-general',
      name: 'Servidor General',
      type: 'general',
      initialTemp: seed.initialTemp,
      targetTemp: seed.targetTemp,
      ambientTemp: seed.ambientTemp,
      queueCapacity: seed.queueCapacity,
      stackCapacity: seed.stackCapacity,
      maxConsecutiveFailures: seed.maxConsecutiveFailures,
    });
    this.seedWorkers();
  }

  get generalNode(): SimNode {
    return this.generalNodeValue;
  }

  get workers(): SimNode[] {
    return this.workersValue;
  }

  get targetTemp(): number {
    return this.generalNodeValue.targetTemp;
  }

  get ambientTemp(): number {
    return this.generalNodeValue.ambientTemp;
  }

  private seedWorkers(): void {
    for (let i = 1; i <= this.seed.initialNodes; i += 1) {
      this.addWorker({
        id: `node-${i}`,
        name: `Servidor ${i}`,
        initialTemp: this.seed.initialTemp,
        targetTemp: this.seed.targetTemp,
        ambientTemp: this.seed.ambientTemp,
      });
    }
  }

  addWorker(config: Omit<NodeConfig, 'type'>): SimNode {
    const node = new SimNode({ ...config, type: 'worker' });
    this.workersValue.push(node);
    return node;
  }

  removeWorker(id: string): boolean {
    const index = this.workersValue.findIndex((n) => n.id === id);
    if (index === -1) {
      return false;
    }
    this.workersValue.splice(index, 1);
    return true;
  }

  getNode(id: string): SimNode | undefined {
    if (id === this.generalNodeValue.id) {
      return this.generalNodeValue;
    }
    return this.workersValue.find((n) => n.id === id);
  }

  allNodes(): SimNode[] {
    return [this.generalNodeValue, ...this.workersValue];
  }

  setTargetTemp(value: number): void {
    for (const node of this.allNodes()) {
      node.targetTemp = value;
    }
  }

  setAmbientTemp(value: number): void {
    for (const node of this.allNodes()) {
      node.ambientTemp = value;
    }
  }

  private averageWorkerTemp(): number | null {
    if (this.workersValue.length === 0) {
      return null;
    }
    const sum = this.workersValue.reduce((acc, n) => acc + n.currentTemp, 0);
    return sum / this.workersValue.length;
  }

  private aggregateGeneral(): void {
    const avg = this.averageWorkerTemp();
    if (avg !== null && this.generalNodeValue.active) {
      this.generalNodeValue.currentTemp = avg;
    }
  }

  tickThermalAll(dtMs: number): void {
    const now = Date.now();
    for (const node of this.allNodes()) {
      node.thermalStep(dtMs);
      node.expireFanIfNeeded(now);
    }
    this.aggregateGeneral();
  }

  getSnapshot(): SystemSnapshotDto {
    const general = this.generalNodeValue.toDto();
    const workers: NodeDto[] = this.workersValue.map((n) => n.toDto());

    let active = 0;
    let inactive = 0;
    let error = 0;
    for (const node of this.workersValue) {
      if (node.status === 'active') active += 1;
      else if (node.status === 'inactive') inactive += 1;
      else error += 1;
    }

    return {
      ts: Date.now(),
      running: this.running,
      targetTemp: this.targetTemp,
      ambientTemp: this.ambientTemp,
      general,
      workers,
      summary: {
        totalWorkers: workers.length,
        activeWorkers: active,
        inactiveWorkers: inactive,
        errorWorkers: error,
        averageTemp: this.averageWorkerTemp() ?? general.currentTemp,
      },
    };
  }

  reset(): void {
    this.startedAt = Date.now();
    this.running = true;
    this.workersValue.length = 0;
    this.generalNodeValue.resetRuntime(this.seed.initialTemp, this.seed.targetTemp);
    this.seedWorkers();
  }
}