import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models";
import { getAuth, requireAdmin } from "@/lib/auth";
import { ticketDocument } from "@/lib/ticketDocument";
import { participantOwnsTicket } from "@/lib/tickets";
import { unauthorized, forbidden, notFound } from "@/lib/http";

/* Stream the printable PDF pass. Owner (participant) or admin only. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getAuth(req);
  if (!auth || auth.kind === "scanner") return unauthorized();
  if (auth.kind === "admin" && !(await requireAdmin(req))) return unauthorized();

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return notFound("Ticket");

  await dbConnect();
  const ticket = await Ticket.findById(id);
  if (!ticket) return notFound("Ticket");

  if (auth.kind === "attendee" && !(await participantOwnsTicket(ticket, auth.sub))) {
    return forbidden();
  }

  const pdf = await ticketDocument(ticket);

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="ticket-${ticket.ticketNumber}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
