/** One verification at a time, without stopping the video or decoder. */
export class ScanSession {
  private busy = false;
  private current: string | null = null;
  private seen = new Map<string, number>();
  private retryAfter = new Map<string, number>();

  claim(payload: string, now = Date.now()): boolean {
    if (now < (this.retryAfter.get(payload) ?? 0)) return false;
    for (const [code, until] of this.retryAfter) {
      if (now >= until) this.retryAfter.delete(code);
    }
    const lastSeen = this.seen.get(payload);
    if (lastSeen !== undefined && now - lastSeen < 2500) {
      this.seen.set(payload, now);
      return false;
    }
    if (this.busy) return false;
    for (const [code, at] of this.seen) {
      if (now - at >= 2500) this.seen.delete(code);
    }
    this.seen.set(payload, now);
    this.current = payload;
    this.busy = true;
    return true;
  }

  release(retry = false, now = Date.now()): void {
    if (retry && this.current) {
      this.seen.delete(this.current);
      this.retryAfter.set(this.current, now + 1000);
    }
    this.current = null;
    this.busy = false;
  }
}

export interface CameraEngine {
  start(): Promise<void>;
  destroy(): void;
}

/** Serialize camera acquisition, including stop/restart during permission prompts. */
export class CameraSession {
  private pending: Promise<void> = Promise.resolve();
  private generation = 0;
  private engine: CameraEngine | null = null;

  start(factory: () => CameraEngine): Promise<void> {
    this.stop();
    const generation = this.generation;
    const opening = this.pending.catch(() => {}).then(async () => {
      if (generation !== this.generation) return;
      const engine = factory();
      this.engine = engine;
      try {
        await engine.start();
      } catch (error) {
        engine.destroy();
        if (this.engine === engine) this.engine = null;
        throw error;
      } finally {
        if (generation !== this.generation) engine.destroy();
      }
    });
    this.pending = opening;
    return opening;
  }

  stop(): void {
    this.generation += 1;
    this.engine?.destroy();
    this.engine = null;
  }
}
