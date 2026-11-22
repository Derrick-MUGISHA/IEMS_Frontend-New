import QRCode from "qrcode";
import { signQrToken, type QrIdentity } from "./auth";
import type { TicketDoc } from "@/models/Ticket";

const SIZE = 640;

const QR_OPTS = {
  width: SIZE,
  margin: 4,
  errorCorrectionLevel: "M" as const,
  color: { dark: "#000000ff", light: "#ffffffff" },
};

async function renderQr(ticketCode: string, who: QrIdentity, issuedAt?: Date): Promise<Buffer> {
  return QRCode.toBuffer(await signQrToken(ticketCode, who, issuedAt), QR_OPTS);
}

// Share in-flight renders as well as finished images across ticket views and PDFs.
const QR_CACHE_MAX = 500;
const qrCache = new Map<string, Promise<Buffer>>();

function cacheKey(code: string, who: QrIdentity): string {
  return `${code}|${who.name ?? ""}|${who.type ?? ""}|${who.eventName ?? ""}`;
}

async function buildQr(ticketCode: string, who: QrIdentity, issuedAt?: Date): Promise<Buffer> {
  const key = `${cacheKey(ticketCode, who)}|${issuedAt?.toISOString() ?? ""}`;
  const hit = qrCache.get(key);
  if (hit) {
    /* refresh recency (Map preserves insertion order) */
    qrCache.delete(key);
    qrCache.set(key, hit);
    return hit;
  }
  const png = renderQr(ticketCode, who, issuedAt);
  qrCache.set(key, png);
  if (qrCache.size > QR_CACHE_MAX) {
    /* evict the least-recently-used entry */
    qrCache.delete(qrCache.keys().next().value as string);
  }
  try { return await png; }
  catch (error) { qrCache.delete(key); throw error; }
}

export async function ticketQrPngBuffer(ticketCode: string, who: QrIdentity = {}): Promise<Buffer> {
  return buildQr(ticketCode, who);
}

export async function ticketQrDataUrl(ticketCode: string, who: QrIdentity = {}): Promise<string> {
  const png = await buildQr(ticketCode, who);
  return `data:image/png;base64,${png.toString("base64")}`;
}

type QrTicket = Pick<TicketDoc, "code" | "issuedAt" | "qrIssuedAt">;

// Fixed issuance time and code keep the emailed QR identical across views and restarts.
export function canonicalTicketQrPng(ticket: QrTicket): Promise<Buffer> {
  return buildQr(ticket.code, {}, ticket.qrIssuedAt ?? ticket.issuedAt);
}

export async function canonicalTicketQrUrl(ticket: QrTicket): Promise<string> {
  return `data:image/png;base64,${(await canonicalTicketQrPng(ticket)).toString("base64")}`;
}
