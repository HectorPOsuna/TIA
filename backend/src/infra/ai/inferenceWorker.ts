import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface InferenceRequest {
  nodeId: string;
  samples: Array<Record<string, unknown>>;
  horizonMs: number;
}

export interface InferenceResponse {
  ok: boolean;
  predictedTemp?: number;
  modelVersion?: string;
  version?: string;
  latencyMs?: number;
  featuresHash?: string;
  meta?: Record<string, unknown>;
  error?: string;
  id?: number;
}

interface Pending {
  resolve: (value: InferenceResponse) => void;
  reject: (err: Error) => void;
  timer: NodeJS.Timeout;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../../../..');

export class InferenceWorker {
  private child: ChildProcessWithoutNullStreams | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private buffer = '';
  private starting = false;
  private stopped = false;

  constructor(
    private readonly opts: { python: string; timeoutMs: number; onError?: (message: string) => void },
  ) {}

  get running(): boolean {
    return this.child !== null && !this.child.killed;
  }

  start(): void {
    if (this.child !== null || this.starting || this.stopped) {
      return;
    }
    this.starting = true;
    const py = path.isAbsolute(this.opts.python)
      ? this.opts.python
      : path.join(REPO_ROOT, this.opts.python);
    if (!existsSync(py)) {
      this.starting = false;
      this.opts.onError?.(`Python de inferencia no encontrado: ${py}`);
      return;
    }
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(py, ['-m', 'ml.worker'], { cwd: REPO_ROOT });
    } catch (error) {
      this.starting = false;
      this.opts.onError?.(
        `No se pudo lanzar el worker de inferencia: ${error instanceof Error ? error.message : String(error)}`,
      );
      return;
    }
    this.child = child;
    this.starting = false;
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => this.onData(chunk));
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => this.opts.onError?.(`[ml.worker] ${chunk.trim()}`));
    child.on('error', (error: Error) => {
      this.opts.onError?.(`Worker de inferencia error: ${error.message}`);
      this.child = null;
      this.rejectAll(new Error('worker error'));
    });
    child.on('exit', () => {
      this.child = null;
      this.rejectAll(new Error('worker exited'));
    });
  }

  stop(): void {
    this.stopped = true;
    this.rejectAll(new Error('worker stopped'));
    if (this.child !== null) {
      this.child.kill();
      this.child = null;
    }
  }

  async predict(req: InferenceRequest): Promise<InferenceResponse> {
    if (!this.running) {
      this.start();
    }
    if (!this.running) {
      return { ok: false, error: 'worker no disponible' };
    }
    const id = this.nextId++;
    const payload = JSON.stringify({
      id,
      cmd: 'predict',
      nodeId: req.nodeId,
      samples: req.samples,
      horizonMs: req.horizonMs,
    });
    return new Promise<InferenceResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ ok: false, error: 'timeout', id });
      }, this.opts.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.child?.stdin.write(payload + '\n');
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({ ok: false, error: error instanceof Error ? error.message : String(error), id });
      }
    });
  }

  async version(): Promise<{ version?: string; meta?: Record<string, unknown> }> {
    if (!this.running) {
      this.start();
    }
    if (!this.running) {
      return {};
    }
    const id = this.nextId++;
    const payload = JSON.stringify({ id, cmd: 'version' });
    const timeout = Math.max(this.opts.timeoutMs, 10_000);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({});
      }, timeout);
      this.pending.set(id, {
        resolve: (value) => resolve({ version: value.version ?? value.modelVersion, meta: value.meta }),
        reject: () => resolve({}),
        timer,
      });
      try {
        this.child?.stdin.write(payload + '\n');
      } catch {
        clearTimeout(timer);
        this.pending.delete(id);
        resolve({});
      }
    });
  }

  private onData(chunk: string): void {
    this.buffer += chunk;
    let idx = this.buffer.indexOf('\n');
    while (idx >= 0) {
      const line = this.buffer.slice(0, idx).trim();
      this.buffer = this.buffer.slice(idx + 1);
      if (line.length > 0) {
        this.onLine(line);
      }
      idx = this.buffer.indexOf('\n');
    }
  }

  private onLine(line: string): void {
    let msg: InferenceResponse;
    try {
      msg = JSON.parse(line) as InferenceResponse;
    } catch {
      return;
    }
    const id = msg.id;
    if (typeof id !== 'number') {
      return;
    }
    const p = this.pending.get(id);
    if (p === undefined) {
      return;
    }
    clearTimeout(p.timer);
    this.pending.delete(id);
    p.resolve(msg);
  }

  private rejectAll(err: Error): void {
    for (const [, p] of this.pending) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }
}
