// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { prepareImageUpload } from "@/lib/prepareImageUpload";
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("reduces a large browser image before multipart transfer", async () => {
  const close = vi.fn(); const draw = vi.fn();
  vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }));
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage: draw } as never);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((done) => done(new Blob([new Uint8Array(60_000)], { type: "image/webp" })));
  const file = new File([new Uint8Array(3_000_000)], "poster.jpg", { type: "image/jpeg" });
  const result = await prepareImageUpload(file);
  expect(result.size).toBe(60_000); expect(result.type).toBe("image/webp"); expect(result.name).toBe("poster.webp");
  expect(draw.mock.calls[0].slice(1)).toEqual([0, 0, 1600, 1200]); expect(close).toHaveBeenCalledOnce();
});
it("preserves the original file if browser decoding is unavailable or fails", async () => {
  vi.stubGlobal("createImageBitmap", vi.fn().mockRejectedValue(new Error("unsupported decoder")));
  const file = new File([new Uint8Array(300_000)], "poster.png", { type: "image/png" });
  expect(await prepareImageUpload(file)).toBe(file);
});
it("rejects files over the existing upload limit before sending any data", async () => {
  await expect(prepareImageUpload(new File([new Uint8Array(9 * 1024 * 1024)], "large.jpg", { type: "image/jpeg" }))).rejects.toThrow("under 8MB");
});
