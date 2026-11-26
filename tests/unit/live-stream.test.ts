import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ token: vi.fn<() => string | null>(() => "admin-token") }));
vi.mock("@/lib/authBridge", () => ({ bridgeGetToken: mocks.token }));

class FakeSource {
  static instances: FakeSource[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  addEventListener = vi.fn();
  constructor(public url: string) { FakeSource.instances.push(this); }
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  FakeSource.instances = [];
  mocks.token.mockReturnValue("admin-token");
  vi.stubGlobal("EventSource", FakeSource);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("shared live streams", () => {
  it("recovers a stalled stream and treats heartbeats as liveness, not content changes", async () => {
    const { openEventStream } = await import("@/lib/eventStream");
    const changed = vi.fn(); const heartbeat = vi.fn(); const failed = vi.fn();
    const stream = openEventStream("/api/events/stream", { onMessage: changed, onHeartbeat: heartbeat, onError: failed });
    const source = FakeSource.instances[0]; source.onopen?.();
    vi.advanceTimersByTime(59_000);
    const beat = source.addEventListener.mock.calls.find((call) => call[0] === "heartbeat")![1];
    beat({ data: "{}" });
    expect(heartbeat).toHaveBeenCalledOnce(); expect(changed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(59_000); expect(failed).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(failed).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(1000); expect(FakeSource.instances).toHaveLength(2);
    stream.close();
  });
  it("shares one public connection and survives a development remount", async () => {
    const { subscribeEventsFeed } = await import("@/lib/liveStream");
    const first = vi.fn(); const second = vi.fn();
    const offFirst = subscribeEventsFeed(first);
    offFirst();
    const offSecond = subscribeEventsFeed(second);
    vi.advanceTimersByTime(250);
    expect(FakeSource.instances).toHaveLength(1);
    expect(FakeSource.instances[0].close).not.toHaveBeenCalled();
    FakeSource.instances[0].onmessage?.({ data: "{}" } as MessageEvent);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
    offSecond();
    vi.advanceTimersByTime(250);
    expect(FakeSource.instances[0].close).toHaveBeenCalledOnce();
  });

  it("keeps the admin stream open while any consumer still subscribes", async () => {
    const { subscribeLive, subscribeLiveStatus } = await import("@/lib/liveStream");
    const off = subscribeLive("admin", {});
    const offStatus = subscribeLiveStatus("admin", vi.fn());
    off();
    vi.advanceTimersByTime(250);
    expect(FakeSource.instances).toHaveLength(1);
    expect(FakeSource.instances[0].close).not.toHaveBeenCalled();
    offStatus();
    const offAgain = subscribeLive("admin", {});
    vi.advanceTimersByTime(250);
    expect(FakeSource.instances).toHaveLength(1);
    offAgain();
    vi.advanceTimersByTime(250);
    expect(FakeSource.instances[0].close).toHaveBeenCalledOnce();
  });

  it("refreshes public data when a connection opens again after missing updates", async () => {
    const { subscribeEventsFeed } = await import("@/lib/liveStream");
    const changed = vi.fn();
    const off = subscribeEventsFeed(changed);
    FakeSource.instances[0].onopen?.();
    expect(changed).toHaveBeenCalledTimes(1);
    FakeSource.instances[0].onerror?.();
    vi.advanceTimersByTime(1_000);
    FakeSource.instances[1].onopen?.();
    expect(changed).toHaveBeenCalledTimes(2);
    off();
    vi.advanceTimersByTime(250);
  });

  it("backs off repeated failures and cancels pending reconnects on cleanup", async () => {
    const { openEventStream } = await import("@/lib/eventStream");
    const stream = openEventStream("/api/events/stream", {});
    FakeSource.instances[0].onerror?.();
    expect(FakeSource.instances[0].close).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(999);
    expect(FakeSource.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeSource.instances).toHaveLength(2);
    FakeSource.instances[1].onopen?.();
    FakeSource.instances[1].onerror?.();
    vi.advanceTimersByTime(1_999);
    expect(FakeSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeSource.instances).toHaveLength(3);
    FakeSource.instances[2].onerror?.();
    stream.close();
    vi.advanceTimersByTime(60_000);
    expect(FakeSource.instances).toHaveLength(3);
  });

  it("does not open authenticated streams without a session", async () => {
    mocks.token.mockReturnValue(null);
    const { subscribeLive } = await import("@/lib/liveStream");
    subscribeLive("admin", {})();
    expect(FakeSource.instances).toHaveLength(0);
  });

  it("caps retry delays and resets backoff after a stable connection", async () => {
    const { openEventStream } = await import("@/lib/eventStream");
    const stream = openEventStream("/api/events/stream", {});
    for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
      const count = FakeSource.instances.length;
      FakeSource.instances.at(-1)!.onerror?.();
      vi.advanceTimersByTime(delay - 1);
      expect(FakeSource.instances).toHaveLength(count);
      vi.advanceTimersByTime(1);
      expect(FakeSource.instances).toHaveLength(count + 1);
    }
    FakeSource.instances.at(-1)!.onopen?.();
    vi.advanceTimersByTime(30_000);
    FakeSource.instances.at(-1)!.onerror?.();
    const count = FakeSource.instances.length;
    vi.advanceTimersByTime(1_000);
    expect(FakeSource.instances).toHaveLength(count + 1);
    stream.close();
  });
});
