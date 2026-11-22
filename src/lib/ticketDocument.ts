import { Event, eventDeadline, type TicketDoc } from "@/models";
import { canonicalTicketQrPng } from "./qr";
import { ticketIdentity } from "./tickets";
import { fetchImageBuffer } from "./imageFetch";
import { ticketPdfBuffer } from "./ticketPdf";

const documents = new Map<string, { until: number; pdf: Promise<Buffer> }>();

/** One PDF renderer for the owner, admin, and private ticket-link views. */
export async function ticketDocument(ticket: TicketDoc): Promise<Buffer> {
  const [event, who] = await Promise.all([Event.findById(ticket.event), ticketIdentity(ticket)]);
  const status = ticket.status === "VALID" && event && new Date() > eventDeadline(event) ? "EXPIRED" : ticket.status;
  const key = JSON.stringify([ticket.code, ticket.qrIssuedAt ?? ticket.issuedAt, ticket.ticketNumber, status, who.name, who.type,
    event?.name, event?.startTime, event?.location, event?.gallery?.[0], event?.details,
    event?.type, event?.price, event?.organiser]);
  const cached = documents.get(key);
  if (cached && cached.until > Date.now()) return cached.pdf;
  const pdf = (async () => {
    const [eventImage, qrPng] = await Promise.all([
      fetchImageBuffer(event?.gallery?.[0]), canonicalTicketQrPng(ticket),
    ]);
    return ticketPdfBuffer({
    name: who.name, type: who.type, eventName: event?.name ?? "Event",
    eventDate: event?.startTime, venue: event?.location, code: ticket.code,
    ticketNumber: ticket.ticketNumber,
    status,
    qrPng, subtitle: event?.details, eventImage,
    eventType: event?.type, price: event?.price, organiser: event?.organiser,
    });
  })();
  documents.delete(key);
  documents.set(key, { until: Date.now() + 5 * 60_000, pdf });
  if (documents.size > 32) documents.delete(documents.keys().next().value!);
  try { return await pdf; }
  catch (error) { documents.delete(key); throw error; }
}
