import sharp from "sharp";
import { qrWorkerDecoder } from "../helpers/qrWorker";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketQrPngBuffer, canonicalTicketQrPng } from "@/lib/qr";
import { verifyQrToken } from "@/lib/auth";


let originalSecret: string | undefined;
beforeAll(() => {
  originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "scanner-test-secret-for-local-qr-decoding-only";
});
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
});

describe("ticket QR decoding with qr-scanner's worker fallback", () => {
  it.each([640, 320])("reads the plain pass at %ipx and preserves its signature", async (size) => {
    const code = "99df4294-1d79-49ae-8390-a2dc42855064";
    const png = await ticketQrPngBuffer(code, {
      name: "A participant with a long name", type: "PARTICIPANT", eventName: "Igire Rwanda conference",
    });
    const image = await sharp(png).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const token = qrWorkerDecoder()(new Uint8ClampedArray(image.data), image.info.width, image.info.height);
    expect(token).toBeTruthy();
    expect(await verifyQrToken(token!)).toMatchObject({ code });
  });
  it.each([160, 200, 256])("reads the shared logo-free ticket QR at %ipx", async (size) => {
    const ticket = { code: "99df4294-1d79-49ae-8390-a2dc42855064", issuedAt: new Date() };
    const png = await canonicalTicketQrPng(ticket);
    const original = await sharp(png).ensureAlpha().raw().toBuffer();
    let monochrome = true;
    for (let i = 0; i < original.length; i += 4) {
      if ((original[i] !== 0 && original[i] !== 255) || original[i + 1] !== original[i] || original[i + 2] !== original[i] || original[i + 3] !== 255) { monochrome = false; break; }
    }
    expect(monochrome).toBe(true);
    expect(original.subarray(0, 640 * 4).every((channel) => channel === 255)).toBe(true);
    const image = await sharp(png).resize(size, size).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const token = qrWorkerDecoder()(new Uint8ClampedArray(image.data), image.info.width, image.info.height);
    expect(token).toBeTruthy(); expect(await verifyQrToken(token!)).toMatchObject({ code: ticket.code });
  });
});
