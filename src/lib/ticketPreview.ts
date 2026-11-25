import { Event, eventDeadline, type EventDoc, type TicketDoc } from "@/models";
import { ticketIdentity } from "./tickets";
import { canonicalTicketQrUrl } from "./qr";
import type { TicketArtworkData } from "@/components/admin/TicketArtwork";

export async function ticketPreview(ticket: TicketDoc, known?: {
  event: EventDoc | null;
  holder: { name: string; type: string };
}): Promise<TicketArtworkData> {
  const [event, holder] = known ? [known.event, known.holder] : await Promise.all([
    Event.findById(ticket.event), ticketIdentity(ticket),
  ]);
  return {
    name: holder.name, type: holder.type, eventName: event?.name ?? "Event",
    date: event?.startTime?.toISOString() ?? null, venue: event?.location,
    images: event?.gallery ?? [], organiser: event?.organiser,
    subtitle: event?.details, price: event?.price, number: ticket.ticketNumber,
    status: ticket.status === "VALID" && event && new Date() > eventDeadline(event) ? "EXPIRED" : ticket.status,
    qr: await canonicalTicketQrUrl(ticket),
  };
}
