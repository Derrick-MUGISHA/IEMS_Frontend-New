import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fetchImage = vi.fn();
beforeEach(() => { vi.resetModules(); fetchImage.mockReset(); vi.stubGlobal("fetch", fetchImage); vi.useFakeTimers({ toFake: ["Date"] }); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
it("shares a poster download across concurrent ticket renders and expires it", async () => {
  fetchImage.mockImplementation(async () => new Response("poster"));
  const { fetchImageBuffer } = await import("@/lib/imageFetch");
  const images = await Promise.all([fetchImageBuffer("https://example.com/poster"), fetchImageBuffer("https://example.com/poster")]);
  expect(images).toEqual([Buffer.from("poster"), Buffer.from("poster")]);
  expect(fetchImage).toHaveBeenCalledOnce();
  await fetchImageBuffer("https://example.com/poster"); expect(fetchImage).toHaveBeenCalledOnce();
  vi.setSystemTime(Date.now() + 60_001);
  await fetchImageBuffer("https://example.com/poster"); expect(fetchImage).toHaveBeenCalledTimes(2);
});
it("retries a failed image instead of caching a missing poster", async () => {
  fetchImage.mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(new Response("poster"));
  const { fetchImageBuffer } = await import("@/lib/imageFetch");
  expect(await fetchImageBuffer("https://example.com/poster")).toBeNull();
  expect(await fetchImageBuffer("https://example.com/poster")).toEqual(Buffer.from("poster"));
  expect(fetchImage).toHaveBeenCalledTimes(2);
});
