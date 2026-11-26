import { afterEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { decodeJwt } from "jose";
import { qrWorkerDecoder } from "../helpers/qrWorker";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
it("keeps the email PNG and application data URL identical across server restarts", async () => {
  vi.stubEnv("JWT_SECRET", "canonical-qr-test-secret-not-for-real-tickets");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T10:00:00Z"));
  const ticket = { code: "canonical-test-code-42", issuedAt: new Date("2026-11-17T08:00:00Z") };
  const first = await import("@/lib/qr");
  const png = await first.canonicalTicketQrPng(ticket);
  expect(await first.canonicalTicketQrUrl(ticket)).toBe(`data:image/png;base64,${png.toString("base64")}`);
  vi.resetModules();
  vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
  const restarted = await import("@/lib/qr");
  expect(await restarted.canonicalTicketQrPng(ticket)).toEqual(png);
  const image = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const token = qrWorkerDecoder()(new Uint8ClampedArray(image.data), image.info.width, image.info.height)!;
  expect(decodeJwt(token)).toMatchObject({ kind: "qr", t: ticket.code, iat: ticket.issuedAt.getTime() / 1000, exp: ticket.issuedAt.getTime() / 1000 + 180 * 86400 });
  const { verifyQrToken } = await import("@/lib/auth");
  expect(await verifyQrToken(token)).toMatchObject({ code: ticket.code });
  expect(await restarted.canonicalTicketQrPng({ ...ticket, code: "rotated-test-code-43", qrIssuedAt: new Date() })).not.toEqual(png);
});
