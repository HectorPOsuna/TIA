export type EventHandler<T> = (payload: T) => void;

export class EventBus<E extends object> {
  private readonly handlers = new Map<keyof E, Set<EventHandler<unknown>>>();

  on<K extends keyof E>(event: K, handler: EventHandler<E[K]>): () => void {
    let set = this.handlers.get(event);
    if (set === undefined) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<unknown>);
    return () => {
      set.delete(handler as EventHandler<unknown>);
    };
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const set = this.handlers.get(event);
    if (set === undefined || set.size === 0) {
      return;
    }
    for (const handler of [...set]) {
      (handler as EventHandler<E[K]>)(payload);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}