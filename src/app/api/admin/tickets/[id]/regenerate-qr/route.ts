import { randomUUID } from "crypto";
import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Ticket } from "@/models";
import { requireAdmin } from "@/lib/auth";
import { canonicalTicketQrUrl } from "@/lib/qr";
import { ok, unauthorized, notFound, fail } from "@/lib/http";

/* Admin: rotate a ticket's QR secret. The old QR/code is invalidated the
   moment `code` changes, so a leaked screenshot can be revoked without
   cancelling the ticket. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorized();

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return notFound("Ticket");

  await dbConnect();
  const ticket = await Ticket.findById(id);
  if (!ticket) return notFound("Ticket");
  if (ticket.status !== "VALID") return fail("Only an unused, valid ticket can receive a new QR", 409);

  ticket.code = randomUUID();
  ticket.qrIssuedAt = new Date();
  await ticket.save();

  const qrDataUrl = await canonicalTicketQrUrl(ticket);

  return ok({ ticket: { id: ticket._id, ticketNumber: ticket.ticketNumber }, qrDataUrl });
}
