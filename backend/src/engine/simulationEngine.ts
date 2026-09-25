import { runAction } from '../domain/actions.js';
import { evaluateRule } from '../domain/rules.js';
import type { RuleStore } from '../domain/rules-store.js';
import type { SystemSimulation } from '../domain/system.js';
import type { LogStore } from '../infra/logger.js';
import { EventBus } from './eventBus.js';
import type { SimEventMap } from './events.js';

export interface EngineDeps {
  system: SystemSimulation;
  rules: RuleStore;
  logs: LogStore;
  bus: EventBus<SimEventMap>;
}

const MAX_DT_MS = 5000;

export class SimulationEngine {
  private timer: NodeJS.Timeout | null = null;
  private lastTickAt: number;

  constructor(
    private readonly deps: EngineDeps,
    readonly tickMs: number,
  ) {
    this.lastTickAt = Date.now();
  }

  get running(): boolean {
    return this.deps.system.running;
  }

  get uptimeMs(): number {
    return Date.now() - this.deps.system.startedAt;
  }

  start(): void {
    if (this.timer !== null) {
      return;
    }
    this.deps.system.running = true;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.deps.logs.add('info', 'system', `Simulación iniciada (tick cada ${this.tickMs} ms)`);
    this.broadcast();
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  pause(): void {
    if (!this.running) {
      return;
    }
    this.stop();
    this.deps.system.running = false;
    this.deps.logs.add('info', 'system', 'Simulación en pausa');
    this.broadcast();
  }

  resume(): void {
    if (this.running) {
      return;
    }
    this.deps.system.running = true;
    this.lastTickAt = Date.now();
    this.timer = setInterval(() => this.tick(), this.tickMs);
    this.deps.logs.add('info', 'system', 'Simulación reanudada');
    this.broadcast();
  }

  stepOnce(): void {
    if (this.running) {
      throw new Error('Debes pausar la simulación antes de avanzar ticks manualmente');
    }
    this.step(this.tickMs);
    this.broadcast();
  }

  reset(): void {
    this.deps.system.reset();
    this.deps.rules.resetTriggerCounters();
    this.deps.logs.add('warning', 'system', 'Simulación reiniciada');
    this.lastTickAt = Date.now();
    this.broadcast();
  }

  private tick(): void {
    const now = Date.now();
    const dt = this.lastTickAt === null ? this.tickMs : Math.min(now - this.lastTickAt, MAX_DT_MS);
    this.lastTickAt = now;
    this.step(dt);
    this.broadcast();
  }

  private step(dtMs: number): void {
    this.deps.system.tickThermalAll(dtMs);
    this.processQueues();
    this.evaluateRules();

    const now = Date.now();
    for (const node of this.deps.system.allNodes()) {
      node.updatedAt = now;
      this.deps.bus.emit('node:updated', { nodeId: node.id, node: node.toDto() });
    }
  }

  private broadcast(): void {
    this.deps.bus.emit('state:update', this.deps.system.getSnapshot());
  }

  private processQueues(): void {
    const { system, bus, logs } = this.deps;
    const now = Date.now();

    for (const node of [...system.workers, system.generalNode]) {
      const current = node.processingTask;
      if (current !== null) {
        const startedAt = current.startedAt ?? now;
        if (now - startedAt >= current.estimatedDurationMs) {
          const completed = node.completeCurrentTask(now);
          if (completed !== null) {
            bus.emit('task:completed', { nodeId: node.id, task: completed });
            logs.add(
              'info',
              'task',
              `Tarea completada: ${completed.description ?? completed.type} (${node.id})`,
              node.id,
              { taskId: completed.id },
            );
          }
        }
      } else {
        const started = node.startNextTask();
        if (started !== null) {
          logs.add(
            'info',
            'task',
            `Procesando tarea: ${started.description ?? started.type} (${node.id})`,
            node.id,
            { taskId: started.id },
          );
        }
      }
    }
  }

  private evaluateRules(): void {
    const { rules, system, bus, logs } = this.deps;
    const now = Date.now();

    for (const rule of rules.enabledList()) {
      if (rule.lastTriggeredAt !== undefined && now - rule.lastTriggeredAt < rule.cooldownMs) {
        continue;
      }

      const { triggered, nodes } = evaluateRule(rule, system);
      if (!triggered) {
        continue;
      }

      rule.lastTriggeredAt = now;
      rule.triggerCount += 1;

      for (const node of nodes) {
        runAction(
          rule.action,
          rule.actionParams,
          node,
          {
            log: (level, type, message, nodeId, meta) => logs.add(level, type, message, nodeId, meta),
          },
          {
            onTaskQueued: (nodeId, task) => bus.emit('task:queued', { nodeId, task }),
          },
        );

        bus.emit('rule:triggered', { rule: { ...rule }, nodeId: node.id, at: now });
        logs.add(
          rule.action === 'send_alert' ? 'critical' : 'warning',
          'rule',
          `Regla "${rule.name}" disparada en ${node.id} → acción ${rule.action} (disparos: ${rule.triggerCount})`,
          node.id,
          { ruleId: rule.id },
        );

        if (rule.action === 'send_alert') {
          const message =
            typeof rule.actionParams?.message === 'string'
              ? rule.actionParams.message
              : `Alerta generada por la regla "${rule.name}" en ${node.id}`;
          bus.emit('alert', { level: 'critical', message, nodeId: node.id, at: now });
        }
      }
    }
  }
}