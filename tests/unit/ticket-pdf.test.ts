import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ticketPdfBuffer, TICKET_PDF_SIZE, type TicketPdfInput } from "@/lib/ticketPdf";
import { signQrToken, verifyQrToken } from "@/lib/auth";
import { ticketQrPngBuffer } from "@/lib/qr";
import { qrWorkerDecoder } from "../helpers/qrWorker";

const directory = mkdtempSync(join(tmpdir(), "iems-pdf-test-"));
const canRender = !spawnSync("pdftoppm", ["-v"]).error;
const code = "9de34294-1d79-49ae-8390-a2dc42855064";
let base: TicketPdfInput;
let pdf: Buffer;
let originalSecret: string | undefined;
beforeAll(async () => {
  originalSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = "ticket-pdf-render-test-secret-not-for-live-entry";
  const poster = await sharp(Buffer.from('<svg width="800" height="400"><rect width="800" height="400" fill="#145b49"/><circle cx="600" cy="200" r="180" fill="#f59300"/></svg>')).webp().toBuffer();
  base = {
    name: "Aline Uwase", eventName: "Women in Technology", type: "PARTICIPANT",
    eventDate: new Date("2027-07-29T08:00:00+02:00"), venue: "Kigali Convention Centre",
    code, ticketNumber: "IRO-000042", qrPayload: await signQrToken(code),
    qrPng: await ticketQrPngBuffer(code), eventImage: poster, price: "Free",
  };
  pdf = await ticketPdfBuffer(base);
  writeFileSync(join(directory, "ticket.pdf"), pdf);
});
afterAll(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  rmSync(directory, { recursive: true, force: true });
});

describe("generated event ticket PDF", () => {
  it("matches the reference's 200 x 100 mm page and embeds the WebP poster", () => {
    const raw = pdf.toString("latin1");
    expect(raw).toContain(`/MediaBox [0 0 ${TICKET_PDF_SIZE[0]} ${TICKET_PDF_SIZE[1]}]`);
    expect(raw.match(/\/Type \/Page\b/g)).toHaveLength(1);
    expect(raw).toContain("/Width 640");
    // Poster plus the shared QR image and its alpha mask.
    expect(raw.match(/\/Subtype \/Image\b/g)).toHaveLength(3);
  });

  it("keeps long titles, venues and attendee names on one page", async () => {
    const long = await ticketPdfBuffer({ ...base,
      eventName: "International Women in Technology and Entrepreneurship Conference",
      name: "Aline Uwase Mukamana Nyiransabimana",
      venue: "Kigali Convention Centre, Main Auditorium and Exhibition Hall",
      subtitle: "Workshops, talks, mentoring and networking for the next generation of technology leaders.",
    });
    expect(long.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
  });

  it.skipIf(!canRender)("fills the entire ticket with a faint portrait poster background", async () => {
    const eventImage = await sharp({ create: { width: 200, height: 400, channels: 3, background: "#145b49" } }).png().toBuffer();
    const portrait = await ticketPdfBuffer({ ...base, eventImage });
    const raw = portrait.toString("latin1");
    expect(raw).toContain("/Width 200");
    expect(raw).toContain("/Height 400");
    writeFileSync(join(directory, "portrait.pdf"), portrait);
    execFileSync("pdftoppm", ["-r", "150", "-singlefile", "-png", join(directory, "portrait.pdf"), join(directory, "portrait")]);
    const rendered = await sharp(readFileSync(join(directory, "portrait.png"))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    for (const x of [2, Math.floor(rendered.info.width / 2), rendered.info.width - 3]) {
      const offset = (2 * rendered.info.width + x) * rendered.info.channels;
      for (const channel of rendered.data.subarray(offset, offset + 3)) {
        expect(channel).toBeGreaterThan(230);
        expect(channel).toBeLessThan(250);
      }
    }
  });

  it("renders safely when event artwork is missing or corrupt", async () => {
    for (const eventImage of [null, Buffer.from("not-an-image")]) {
      const fallback = await ticketPdfBuffer({ ...base, eventImage });
      expect(fallback.toString("latin1").match(/\/Type \/Page\b/g)).toHaveLength(1);
      expect(fallback.toString("latin1")).toContain("/Width 640");
      expect(fallback.toString("latin1").match(/\/Subtype \/Image\b/g)).toHaveLength(2);
    }
  });

  it.skipIf(!canRender)("decodes the QR from the rendered PDF with the gate scanner's engine", async () => {
    execFileSync("pdftoppm", ["-r", "150", "-singlefile", "-png", join(directory, "ticket.pdf"), join(directory, "rendered")]);
    const png = readFileSync(join(directory, "rendered.png"));
    const metadata = await sharp(png).metadata();
    const scale = metadata.width! / TICKET_PDF_SIZE[0];
    const qrWidth = (TICKET_PDF_SIZE[0] - 48) * 0.2;
    const image = await sharp(png).extract({
      left: Math.floor((TICKET_PDF_SIZE[0] - 24 - qrWidth) * scale),
      top: Math.floor(24 * scale), width: Math.ceil(qrWidth * scale), height: Math.ceil(qrWidth * scale),
    }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const token = qrWorkerDecoder()(new Uint8ClampedArray(image.data), image.info.width, image.info.height);
    expect(token).toBeTruthy();
    expect(await verifyQrToken(token!)).toMatchObject({ code });
  });
});
