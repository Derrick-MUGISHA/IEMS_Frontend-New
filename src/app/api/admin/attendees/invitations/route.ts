import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { dbConnect } from "@/lib/db";
import { Event, Participant, Ticket } from "@/models";
import { sendParticipantInvitation } from "@/lib/participantInvitation";
import { ok, fail, unauthorized } from "@/lib/http";

const Body = z.object({ participantIds: z.array(z.string().refine(isValidObjectId)).min(1).max(10) });

export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Choose 1–10 valid participants per invitation batch.");
  await dbConnect();
  const ids = [...new Set(parsed.data.participantIds)];
  const participants = await Participant.find({ _id: { $in: ids } });
  const byId = new Map(participants.map((p) => [p._id.toString(), p]));
  const sent: string[] = [];
  const failed: { id: string; error: string }[] = [];
  for (let offset = 0; offset < ids.length; offset += 4) {
    await Promise.all(ids.slice(offset, offset + 4).map(async (id) => {
      try {
        const participant = byId.get(id);
        if (!participant) throw new Error("Participant not found.");
        if (participant.registrationStatus === "REJECTED") throw new Error("Approve this participant before sending an invitation.");
        if (participant.status !== "PENDING") throw new Error("This participant has already verified their email.");
        if (await Ticket.exists({ holderType: "Participant", holderId: participant._id, status: "USED" })) {
          throw new Error("This participant’s ticket has already been used.");
        }
        const event = await Event.findById(participant.event);
        if (!event || event.archivedAt) throw new Error("The participant’s event is unavailable or archived.");
        await sendParticipantInvitation(participant, event.name);
        sent.push(id);
      } catch (error) {
        failed.push({ id, error: error instanceof Error ? error.message : "Invitation could not be sent." });
      }
    }));
  }
  return ok({ sent, failed });
}
