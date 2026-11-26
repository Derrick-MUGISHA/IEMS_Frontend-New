import { dbConnect } from "@/lib/db";
import { Event } from "@/models";
import { ok } from "@/lib/http";
import { toVenueEvent } from "@/lib/eventView";
import type { VenueEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

async function loadEvents(): Promise<VenueEvent[]> {
  await dbConnect();
  const events = await Event.find({
    status: { $ne: "DRAFT" },
    isPublished: true,
    archivedAt: null,
  }).sort({ startTime: 1 });
  const now = new Date();
  return events.map((e) => toVenueEvent(e, now));
}

export async function GET() {
  const res = ok({ events: await loadEvents() });
  res.headers.set("Cache-Control", "no-store, max-age=0");
  res.headers.set("CDN-Cache-Control", "no-store");
  res.headers.set("Vercel-CDN-Cache-Control", "no-store");
  return res;
}
