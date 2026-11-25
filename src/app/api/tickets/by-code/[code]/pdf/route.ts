import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models";
import { ticketDocument } from "@/lib/ticketDocument";
import { notFound } from "@/lib/http";

/* The secret code grants the same access as the existing emailed ticket link.
   Printed ticket numbers and database ids are never accepted here. */
export async function GET(_req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  if (code.length < 6 || code.length > 200) return notFound("Ticket");
  await dbConnect();
  const ticket = await Ticket.findOne({ code });
  if (!ticket) return notFound("Ticket");
  const pdf = await ticketDocument(ticket);
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="ticket-${ticket.ticketNumber}.pdf"`,
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow, noarchive",
    "Referrer-Policy": "no-referrer",
  } });
}
