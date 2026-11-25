import { requireAdmin } from "@/lib/auth";
import { runDailyReminders } from "@/lib/reminders";
import { ok, fail, unauthorized } from "@/lib/http";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { dbConnect } from "@/lib/db";
import { Event } from "@/models";

const Body = z.object({ eventId: z.string().refine(isValidObjectId) });

/* Admin "run now" trigger for the daily progress reminders — the same pass the
   Vercel cron runs, on demand from the Emails page. */
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Choose a programme or event before sending reminders");

  await dbConnect();
  const event = await Event.exists({
    _id: parsed.data.eventId,
    startTime: { $gt: new Date() },
    archivedAt: null,
    status: "OPEN",
  });
  if (!event) return fail("Select an upcoming, open programme or event", 400);

  const summary = await runDailyReminders(parsed.data.eventId);
  return ok(summary);
}
