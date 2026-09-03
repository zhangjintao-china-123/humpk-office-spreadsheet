type Handler = (...args: unknown[]) => void;

export class Emitter {
  private listeners = new Map<string, Set<Handler>>();

  on(event: string, handler: Handler): this {
    let bucket = this.listeners.get(event);
    if (!bucket) {
      bucket = new Set();
      this.listeners.set(event, bucket);
    }
    bucket.add(handler);
    return this;
  }

  off(event: string, handler?: Handler): this {
    if (!handler) {
      this.listeners.delete(event);
      return this;
    }
    this.listeners.get(event)?.delete(handler);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    const bucket = this.listeners.get(event);
    if (!bucket) {
      return;
    }
    for (const handler of bucket) {
      handler(...args);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}
