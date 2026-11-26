import { isValidObjectId, Types } from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Event } from "@/models";
import { requireAdmin } from "@/lib/auth";
import { retryFailedEmails, RETRYABLE_EMAIL_KINDS } from "@/lib/emailRetry";
import { ok, fail, unauthorized, notFound } from "@/lib/http";

const Body = z.object({ kind: z.enum(RETRYABLE_EMAIL_KINDS) });

/* Admin: re-send one kind of failed email to this event's people whose latest
   attempt still failed and who still need it. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(req))) return unauthorized();

  const { id } = await ctx.params;
  if (!isValidObjectId(id)) return notFound("Event");
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("This email type can't be retried");

  await dbConnect();
  if (!(await Event.exists({ _id: id }))) return notFound("Event");

  const summary = await retryFailedEmails(new Types.ObjectId(id), parsed.data.kind);
  if (!summary) return fail("A retry for these emails is already running", 409);
  return ok(summary);
}
