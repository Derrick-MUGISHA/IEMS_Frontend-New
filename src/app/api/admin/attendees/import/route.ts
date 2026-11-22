import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { Event, Participant, Ticket } from "@/models";
import { importParticipantSchema, MAX_IMPORT_ROWS } from "@/lib/participantImport";
import { ok, fail, unauthorized } from "@/lib/http";

const Body = z.object({ eventId: z.string().refine(isValidObjectId, "Choose a valid event"), participants: z.array(importParticipantSchema).min(1).max(MAX_IMPORT_ROWS) });
export async function POST(req: Request) {
  if (!(await requireAdmin(req))) return unauthorized();
  const body = await req.text();
  if (body.length > 1_000_000) return fail("Import is too large. Use at most 1 MB.", 413);
  let input: unknown; try { input = JSON.parse(body); } catch { return fail("Invalid import data"); }
  const parsed = Body.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).slice(0, 5).join("; "));
  await dbConnect();
  const event = await Event.findById(parsed.data.eventId);
  if (!event) return fail("Event not found", 404);
  if (event.archivedAt) return fail("Choose an event that has not been archived", 409);
  const unique = [...new Map(parsed.data.participants.map((row) => [row.email, row])).values()];
  const archived = await Ticket.find({ event: event._id, holderType: "Participant", "holder.email": { $in: unique.map((row) => row.email) } }).select("holder.email");
  const archivedEmails = new Set(archived.map((ticket) => ticket.holder?.email.toLowerCase()));
  const rows = unique.filter((row) => !archivedEmails.has(row.email));
  if (!rows.length) return ok({ imported: 0, skipped: parsed.data.participants.length, received: parsed.data.participants.length, participantIds: [] });
  let imported = 0;
  let participantIds: string[] = [];
  const now = new Date();
  try {
    const result = await Participant.bulkWrite(rows.map((row) => ({ updateOne: {
      filter: { event: event._id, email: row.email },
      update: { $setOnInsert: { ...row, event: event._id, status: "PENDING", registrationStatus: "APPROVED", createdAt: now, updatedAt: now } },
      upsert: true,
    } })), { ordered: false, timestamps: false });
    imported = result.upsertedCount;
    participantIds = Object.values(result.upsertedIds ?? {}).map(String);
  } catch (cause) {
    // Simultaneous imports can race on the unique (event,email) index.
    const error = cause as { writeErrors?: { code: number }[]; result?: { upsertedCount: number; upsertedIds?: Record<string, unknown> } };
    if (!error.writeErrors?.length || !error.writeErrors.every((item) => item.code === 11000) || !error.result) throw cause;
    imported = error.result.upsertedCount;
    participantIds = Object.values(error.result.upsertedIds ?? {}).map(String);
  }
  return ok({ imported, skipped: parsed.data.participants.length - imported, received: parsed.data.participants.length, participantIds }, 201);
}
