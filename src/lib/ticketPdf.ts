import { join } from "node:path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { formatEventDate, formatEventTime } from "./time";

// Quario's event-ticket composition: 200 x 100 mm, 24 pt margins,
// 80/20 event/QR split and compact metadata grids. The event's own artwork
// is embedded beneath the paper so the exported PDF is self-contained.
export const TICKET_PDF_SIZE = [566.93, 283.46] as const;
const MARGIN = 24;
const INK = "#1e1f22";
const MUTED = "#5e6062";
const LABEL = "#777b76";
const SANS = "TicketSans";
const BOLD = "TicketSansBold";
const SERIF = "TicketSerif";
const MONO = "TicketMono";

export type TicketPdfInput = {
  name: string;
  role?: string;
  /** holder type (PARTICIPANT / GUEST / PLUS_ONE) */
  type: string;
  eventName: string;
  eventDate?: Date | null;
  venue?: string;
  code: string;
  ticketNumber?: string;
  /** Signed entry token. Modules are drawn as vector paths in the PDF. */
  qrPayload?: string;
  /** Shared plain QR used for ticket emails and application previews. */
  qrPng?: Buffer;
  photo?: Buffer | null;
  eventImage?: Buffer | null;
  eventType?: string;
  price?: string;
  organiser?: string;
  subtitle?: string;
  section?: string;
  row?: string;
  seat?: string;
  status?: string;
};

export async function ticketPdfBuffer(t: TicketPdfInput): Promise<Buffer> {
  // Cloudinary may negotiate WebP/AVIF; PDFKit embeds PNG/JPEG. Normalize the
  // event artwork once rather than silently dropping an unsupported poster.
  const eventImage = t.eventImage
    ? await sharp(t.eventImage).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 85 }).toBuffer().catch(() => null)
    : null;
  return new Promise((resolve, reject) => {
    const [width, height] = TICKET_PDF_SIZE;
    const doc = new PDFDocument({
      size: [width, height], margin: 0, compress: true,
      info: { Title: `${t.eventName} - ${t.ticketNumber ?? "Event ticket"}`, Author: t.organiser || "Igire Rwanda Organization" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      doc.registerFont(SANS, join(process.cwd(), "public/fonts/tickets/InstrumentSans-Regular.ttf"));
      doc.registerFont(BOLD, join(process.cwd(), "public/fonts/tickets/InstrumentSans-Bold.ttf"));
      doc.registerFont(SERIF, join(process.cwd(), "public/fonts/tickets/Newsreader-Semibold.ttf"));
      doc.registerFont(MONO, join(process.cwd(), "public/fonts/tickets/IBMPlexMono-Regular.ttf"));

      const contentWidth = width - MARGIN * 2;
      // Fit text in explicit boxes; a long name must never overlap another
      // field or silently create a second ticket page.
      const text = (value: string, x: number, y: number, w: number, h: number,
        font = SANS, size = 10, color = INK, align: "left" | "right" = "left", minSize = size) => {
        doc.font(font).fontSize(size);
        while (size > minSize && doc.heightOfString(value, { width: w, lineGap: 1 }) > h) {
          size -= 0.5;
          doc.fontSize(size);
        }
        doc.fillColor(color).text(value, x, y, { width: w, height: h, lineGap: 1, ellipsis: true, align });
      };
      const label = (value: string, x: number, y: number, w: number, align: "left" | "right" = "left") =>
        text(value.toUpperCase(), x, y, w, 10, MONO, 6, LABEL, align);

      doc.rect(0, 0, width, height).fill("#ffffff");
      if (eventImage) {
        doc.save();
        doc.rect(0, 0, width, height).clip();
        try {
          doc.image(eventImage, 0, 0, { cover: [width, height], align: "center", valign: "center" });
          doc.rect(0, 0, width, height).fillOpacity(0.92).fill("#ffffff");
        } catch {
          // A missing/unsupported poster does not invalidate an issued pass.
          doc.rect(0, 0, width, height).fillOpacity(1).fill("#ffffff");
        }
        doc.restore();
      }

      const qrSize = contentWidth * 0.2;
      const qrX = width - MARGIN - qrSize;
      const headingWidth = contentWidth * 0.8 - 18;
      text((t.organiser || "Igire Rwanda Organization").toUpperCase(), MARGIN, 24, headingWidth, 11, MONO, 7, LABEL);
      text(t.eventName, MARGIN, 40, headingWidth, 58, SERIF, 24, INK, "left", 16);
      const subtitle = (t.subtitle || t.role || t.eventType?.replaceAll("_", " ") || "Event admission")
        .replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
      text(subtitle, MARGIN, 105, headingWidth, 23, SANS, 9, MUTED, "left", 8);

      // Keep the full four-module quiet zone on opaque white, even on a poster.
      doc.rect(qrX, MARGIN, qrSize, qrSize).fill("#ffffff");
      if (t.qrPng) {
        doc.image(t.qrPng, qrX, MARGIN, { width: qrSize, height: qrSize });
      } else if (t.qrPayload) {
        const qr = QRCode.create(t.qrPayload, { errorCorrectionLevel: "M" });
        const quiet = 4;
        const moduleSize = qrSize / (qr.modules.size + quiet * 2);
        doc.fillColor("#000000");
        // Merge horizontal runs to keep vector PDFs small and sharp at any zoom.
        for (let row = 0; row < qr.modules.size; row += 1) {
          for (let col = 0; col < qr.modules.size; col += 1) {
            if (!qr.modules.get(row, col)) continue;
            const start = col;
            while (col + 1 < qr.modules.size && qr.modules.get(row, col + 1)) col += 1;
            doc.rect(qrX + (start + quiet) * moduleSize, MARGIN + (row + quiet) * moduleSize,
              (col - start + 1) * moduleSize, moduleSize);
          }
        }
        doc.fill();
      } else {
        throw new Error("A ticket requires a signed QR payload");
      }

      const widths = [contentWidth * 0.38, contentWidth * 0.38, contentWidth * 0.24];
      const xs = [MARGIN, MARGIN + widths[0], MARGIN + widths[0] + widths[1]];
      const labelY = 143;
      label("Date", xs[0], labelY, widths[0] - 12);
      label("Venue", xs[1], labelY, widths[1] - 12);
      label("Entry code", xs[2], labelY, widths[2]);
      text(t.eventDate ? formatEventDate(t.eventDate) : "Date to be confirmed", xs[0], 155, widths[0] - 12, 25, BOLD, 10, INK, "left", 8);
      text(t.venue || "Venue to be confirmed", xs[1], 155, widths[1] - 12, 25, BOLD, 10, INK, "left", 8);
      text(t.ticketNumber || t.code, xs[2], 155, widths[2], 25, MONO, 8, INK, "left", 6);
      text(t.eventDate ? `Starts ${formatEventTime(t.eventDate)} (Kigali)` : "Time to be confirmed", xs[0], 184, widths[0] - 12, 12, SANS, 9, MUTED);
      text(t.role || "Present this pass at the entrance", xs[1], 184, widths[1] + widths[2], 12, SANS, 8, MUTED);

      doc.moveTo(MARGIN, 202).lineTo(width - MARGIN, 202).lineWidth(0.5).stroke(INK);
      const holderWidths = [0.38, 0.12, 0.12, 0.14, 0.24].map((fraction) => fraction * contentWidth);
      const holderLabels = ["Ticket holder", "Section", "Row", "Seat", t.type.replaceAll("_", " ")];
      const admission = !t.price || /^free(?:\b|$)/i.test(t.price.trim()) ? "Complimentary" : t.price;
      const holderValues = [t.name, t.section || "General", t.row || "-", t.seat || "Open", admission];
      let x = MARGIN;
      holderWidths.forEach((w, index) => {
        const align = index === 4 ? "right" : "left";
        label(holderLabels[index], x, 211, w - (index === 4 ? 0 : 10), align);
        text(holderValues[index], x, 223, w - (index === 4 ? 0 : 10), 21,
          BOLD, index === 4 ? 12 : 13, INK, align, 8);
        x += w;
      });
      const status = t.status && t.status !== "VALID" ? `${t.status} - ` : "";
      text(`${status}Admits one. Scan the code at the door, on paper or on screen. Keep your entry code private.`,
        MARGIN, 250, contentWidth, 10, SANS, 7, MUTED);
      doc.end();
    } catch (error) {
      doc.destroy();
      reject(error);
    }
  });
}
