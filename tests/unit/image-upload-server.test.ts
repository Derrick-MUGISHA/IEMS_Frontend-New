import { Writable } from "node:stream";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ upload: vi.fn(), config: vi.fn() }));
vi.mock("cloudinary", () => ({ v2: { config: mocks.config, uploader: { upload_stream: mocks.upload }, api: { ping: vi.fn() } } }));
import { uploadImage, prepareCloudinaryImage, InvalidImageError, ImageUploadError } from "@/lib/cloudinary";
let png: Buffer;
beforeEach(async () => {
  vi.resetAllMocks();
  png = await sharp({ create: { width: 3000, height: 2000, channels: 4, background: { r: 40, g: 160, b: 80, alpha: 0.5 } } }).png().toBuffer();
});
afterEach(() => vi.useRealTimers());
it("resizes and compresses actual bytes before sending them to Cloudinary while preserving transparency", async () => {
  const compact = await prepareCloudinaryImage(png);
  const meta = await sharp(compact).metadata();
  expect(meta.width).toBe(800); expect(meta.height).toBeLessThanOrEqual(800); expect(meta.hasAlpha).toBe(true);
  expect(compact.length).toBeLessThan(png.length);
});
it("rejects invalid bytes before an upload starts", async () => {
  await expect(uploadImage(Buffer.from("not an image"), "events")).rejects.toBeInstanceOf(InvalidImageError);
  expect(mocks.upload).not.toHaveBeenCalled();
});
it("retries a transient failure once with the already compressed image and reuses connections", async () => {
  const sent: Buffer[] = [];
  mocks.upload.mockImplementation((_options, done) => new Writable({ write(chunk, _encoding, next) { sent.push(chunk); next(); }, final(next) { done(sent.length === 1 ? { http_code: 503 } : null, sent.length > 1 ? { secure_url: "https://res.cloudinary.com/test/image.webp" } : undefined); next(); } }));
  expect(await uploadImage(png, "events")).toBe("https://res.cloudinary.com/test/image.webp");
  expect(mocks.upload).toHaveBeenCalledTimes(2); expect(sent[0]).toEqual(sent[1]); expect(sent[0].length).toBeLessThan(png.length);
  expect(mocks.upload.mock.calls[0][0]).toMatchObject({ folder: "iems/events", timeout: 25_000, agent: expect.objectContaining({ keepAlive: true }) });
});
it("does not retry permanent authentication errors", async () => {
  mocks.upload.mockImplementation(() => { throw Object.assign(new Error("Service credentials rejected"), { http_code: 401 }); });
  await expect(uploadImage(png, "events")).rejects.toBeInstanceOf(ImageUploadError);
  expect(mocks.upload).toHaveBeenCalledOnce();
});
it("ends a stalled upload within 30 seconds instead of silently retrying for minutes", async () => {
  vi.useFakeTimers();
  const stream = new Writable({ write(_chunk, _encoding, next) { next(); } });
  const destroy = vi.spyOn(stream, "destroy"); mocks.upload.mockReturnValue(stream);
  const assertion = expect(uploadImage(png, "events")).rejects.toMatchObject({ name: "ImageUploadError", status: 504 });
  await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  await vi.advanceTimersByTimeAsync(30_001); await assertion;
  expect(mocks.upload).toHaveBeenCalledOnce(); expect(destroy).toHaveBeenCalled();
});
