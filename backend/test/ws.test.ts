import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import { io as createClient, type Socket } from 'socket.io-client';
import type { AppContext } from '../src/api/context.js';
import { RuleStore } from '../src/domain/rules-store.js';
import { SystemSimulation } from '../src/domain/system.js';
import { EventBus } from '../src/engine/eventBus.js';
import { EventEngine } from '../src/engine/eventEngine.js';
import type { SimEventMap } from '../src/engine/events.js';
import { SimulationEngine } from '../src/engine/simulationEngine.js';
import { buildHttpServer } from '../src/infra/httpServer.js';
import { LogStore } from '../src/infra/logger.js';
import { attachSockets } from '../src/infra/sockets.js';

interface SocketPacket {
  type: string;
  ts: number;
  payload: { workers: unknown[] };
}

const seed = {
  initialNodes: 2,
  initialTemp: 25,
  targetTemp: 30,
  ambientTemp: 20,
  queueCapacity: 10,
  stackCapacity: 10,
  maxConsecutiveFailures: 5,
  poolCapacity: 10,
};

function nextPacket(socket: Socket, timeoutMs = 2000): Promise<SocketPacket> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('state:update', handler);
      reject(new Error('timeout esperando state:update'));
    }, timeoutMs);
    const handler = (packet: SocketPacket) => {
      clearTimeout(timer);
      resolve(packet);
    };
    socket.once('state:update', handler);
  });
}

function waitForConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', (error) => reject(error));
  });
}

describe('WebSocket', () => {
  let httpServer: HttpServer;
  let io: Server;
  let bus: EventBus<SimEventMap>;
  let system: SystemSimulation;
  let url: string;

  beforeAll(async () => {
    system = new SystemSimulation(seed);
    const rules = new RuleStore([]);
    const logs = new LogStore(100);
    bus = new EventBus<SimEventMap>();
    const events = new EventEngine(system, bus, logs, {
      enabled: false,
      intervalMs: 5000,
      probabilities: {},
    });
    const engine = new SimulationEngine({ system, rules, logs, bus, events }, 1000);
    const ctx: AppContext = { system, rules, logs, engine, bus, events };
    const app = buildHttpServer(ctx, 'http://localhost:5173', false);
    httpServer = createServer(app);
    io = new Server(httpServer, { cors: { origin: '*' } });
    attachSockets(io, bus);
    await new Promise<void>((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
    const address = httpServer.address() as AddressInfo;
    url = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => io.close(() => resolve()));
  });

  it('entrega state:update y se recupera tras reconectar', async () => {
    const client = createClient(url, {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    await waitForConnect(client);

    const first = nextPacket(client);
    bus.emit('state:update', system.getSnapshot());
    const packet = await first;
    expect(packet.type).toBe('state:update');
    expect(packet.payload.workers).toHaveLength(2);

    const disconnected = new Promise<void>((resolve) => client.once('disconnect', () => resolve()));
    client.disconnect();
    await disconnected;

    const reconnected = waitForConnect(client);
    client.connect();
    await reconnected;

    let received = 0;
    client.on('state:update', () => {
      received += 1;
    });
    const second = nextPacket(client);
    bus.emit('state:update', system.getSnapshot());
    await second;
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(received).toBe(1);

    client.disconnect();
  });
});
