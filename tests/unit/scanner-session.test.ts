import { describe, expect, it, vi } from "vitest";
import { CameraSession, ScanSession } from "@/lib/scannerSession";

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

describe("continuous scan session", () => {
  it("accepts the next attendee immediately after verification, without a feedback cooldown", () => {
    const session = new ScanSession();
    expect(session.claim("ticket-a", 0)).toBe(true);
    expect(session.claim("ticket-b", 10)).toBe(false);
    session.release();
    expect(session.claim("ticket-b", 20)).toBe(true);
  });

  it("suppresses a held ticket continuously, even across multiple seconds", () => {
    const session = new ScanSession();
    expect(session.claim("ticket-a", 0)).toBe(true);
    session.release();
    for (let now = 100; now < 10_000; now += 100) expect(session.claim("ticket-a", now)).toBe(false);
    expect(session.claim("ticket-b", 10_000)).toBe(true);
  });

  it("remembers a ticket when two visible codes alternate", () => {
    const session = new ScanSession();
    session.claim("ticket-a", 0);
    session.release();
    session.claim("ticket-b", 100);
    session.release();
    expect(session.claim("ticket-a", 200)).toBe(false);
  });

  it("allows retry after a network failure or timeout without logging out", () => {
    const session = new ScanSession();
    session.claim("ticket-a", 0);
    session.release(true, 0);
    expect(session.claim("ticket-a", 1000)).toBe(true);
  });

  it("backs off a failed ticket without delaying a different attendee", () => {
    const session = new ScanSession();
    session.claim("ticket-a", 0);
    session.release(true, 0);
    expect(session.claim("ticket-a", 100)).toBe(false);
    expect(session.claim("ticket-b", 100)).toBe(true);
  });

  it("allows an intentional rescan after removing the pass", () => {
    const session = new ScanSession();
    session.claim("ticket-a", 0);
    session.release();
    expect(session.claim("ticket-a", 2501)).toBe(true);
  });
});

describe("camera lifecycle", () => {
  it("stops a camera opened after the component was removed", async () => {
    const session = new CameraSession();
    const permission = deferred();
    const engine = { start: vi.fn(() => permission.promise), destroy: vi.fn() };
    const opening = session.start(() => engine);
    await Promise.resolve();
    await Promise.resolve();
    session.stop();
    permission.resolve();
    await opening;
    expect(engine.destroy).toHaveBeenCalled();
  });

  it("serializes restart while permission is still resolving", async () => {
    const session = new CameraSession();
    const permission = deferred();
    const oldEngine = { start: vi.fn(() => permission.promise), destroy: vi.fn() };
    const newEngine = { start: vi.fn(async () => {}), destroy: vi.fn() };
    const opening = session.start(() => oldEngine);
    await Promise.resolve();
    await Promise.resolve();
    const restarting = session.start(() => newEngine);
    expect(newEngine.start).not.toHaveBeenCalled();
    permission.resolve();
    await Promise.all([opening, restarting]);
    expect(oldEngine.destroy).toHaveBeenCalled();
    expect(newEngine.start).toHaveBeenCalledOnce();
  });

  it("recovers from camera startup errors without creating a new login session", async () => {
    const session = new CameraSession();
    const broken = { start: vi.fn(async () => { throw new Error("camera busy"); }), destroy: vi.fn() };
    await expect(session.start(() => broken)).rejects.toThrow("camera busy");
    expect(broken.destroy).toHaveBeenCalled();
    const working = { start: vi.fn(async () => {}), destroy: vi.fn() };
    await session.start(() => working);
    expect(working.start).toHaveBeenCalledOnce();
    session.stop();
    expect(working.destroy).toHaveBeenCalled();
  });

  it("does not open a cancelled camera before a rapid restart", async () => {
    const session = new CameraSession();
    const factory = vi.fn(() => ({ start: async () => {}, destroy: () => {} }));
    const opening = session.start(factory);
    session.stop();
    await opening;
    expect(factory).not.toHaveBeenCalled();
  });
});
