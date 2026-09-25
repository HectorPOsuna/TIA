import type { Server } from 'socket.io';
import type { EventBus } from '../engine/eventBus.js';
import type { SimEventMap } from '../engine/events.js';

const nodeRoom = (nodeId: string): string => `node:${nodeId}`;

type SocketEventName = keyof SimEventMap;

const EVENT_NAMES: readonly SocketEventName[] = [
  'state:update',
  'node:updated',
  'rule:triggered',
  'task:queued',
  'task:completed',
  'alert',
];

interface SocketPacket {
  type: SocketEventName;
  ts: number;
  payload: unknown;
}

export function attachSockets(io: Server, bus: EventBus<SimEventMap>): void {
  for (const name of EVENT_NAMES) {
    bus.on(name, (payload) => {
      const packet: SocketPacket = { type: name, ts: Date.now(), payload };
      io.emit(name, packet);
    });
  }

  io.on('connection', (socket) => {
    socket.on('node:subscribe', (nodeId: unknown) => {
      if (typeof nodeId === 'string') {
        socket.join(nodeRoom(nodeId));
      }
    });

    socket.on('node:unsubscribe', (nodeId: unknown) => {
      if (typeof nodeId === 'string') {
        socket.leave(nodeRoom(nodeId));
      }
    });
  });
}

export { nodeRoom };