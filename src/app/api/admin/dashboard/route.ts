import { isValidObjectId } from "mongoose";
import { dbConnect } from "@/lib/db";
import { Event, Guest, Participant, ScanLog, Ticket, eventDeadline } from "@/models";
import { requireAdmin } from "@/lib/auth";
import { ok, fail, unauthorized } from "@/lib/http";

/* Admin dashboard: global counts + attendance analytics (§6). The payload is
   the same for every admin and each load fires ~11 DB ops (2 aggregations +
   counts), so cache it briefly in-process. Live check-ins already stream over
   SSE, so a few seconds of staleness on the summary numbers is invisible.
   Per-instance, like the app's other in-process caches. */
const CACHE_TTL_MS = 15_000;
const cache = new Map<string, { at: number; payload: unknown }>();

export async function GET(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin) return unauthorized();

  const eventId = new URL(req.url).searchParams.get("event");
  if (eventId && !isValidObjectId(eventId)) return fail("Choose a valid event");
  const key = eventId ?? "all";
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return ok(cached.payload);
  await dbConnect();
  const scope = eventId ? { event: eventId } : {};
  const scopeTickets = eventId ? await Ticket.find(scope).select("_id") : [];
  const scanScope = eventId ? { ticket: { $in: scopeTickets.map((ticket) => ticket._id) } } : {};
  const now = new Date();
  const since24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const [
    events,
    participants,
    guests,
    ticketsGenerated,
    ticketsSent,
    ticketsScanned,
    totalAttendance,
    hourly,
    daily,
  ] = await Promise.all([
    Event.find(eventId ? { _id: eventId } : {}).select("startTime endTime archivedAt registeredCount"),
    Participant.countDocuments(scope),
    Guest.countDocuments(scope),
    Ticket.countDocuments(scope),
    Ticket.countDocuments({ ...scope, sentAt: { $ne: null } }),
    Ticket.countDocuments({ ...scope, status: "USED" }),
    ScanLog.countDocuments({ ...scanScope, result: "ACCEPTED" }),
    ScanLog.aggregate<{ _id: string; n: number }>([
      { $match: { ...scanScope, result: "ACCEPTED", createdAt: { $gte: since24h } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%dT%H:00", date: "$createdAt", timezone: "Africa/Kigali" } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    ScanLog.aggregate<{ _id: string; n: number }>([
      { $match: { ...scanScope, result: "ACCEPTED" } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Africa/Kigali" } }, n: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  /* lifecycle buckets (time-based; archived events excluded from active) */
  let active = 0;
  let completed = 0;
  let upcoming = 0;
  const ongoingEventIds: typeof events = [];
  for (const e of events) {
    if (e.archivedAt) continue;
    const deadline = eventDeadline(e);
    if (now > deadline) completed += 1;
    else if (now >= e.startTime) {
      active += 1;
      ongoingEventIds.push(e);
    } else upcoming += 1;
  }

  /* attendance for events happening right now */
  const ongoingIds = ongoingEventIds.map((e) => e._id);
  const [currentAttendance, ongoingIssued] = await Promise.all([
    ongoingIds.length
      ? Ticket.countDocuments({ event: { $in: ongoingIds }, status: "USED" })
      : 0,
    ongoingIds.length
      ? Ticket.countDocuments({ event: { $in: ongoingIds }, status: { $ne: "REVOKED" } })
      : 0,
  ]);

  const nonArchived = events.filter((e) => !e.archivedAt).length;
  const averageAttendance = nonArchived ? Math.round((totalAttendance / nonArchived) * 10) / 10 : 0;
  const liveAttendanceRate = ongoingIssued
    ? Math.round((currentAttendance / ongoingIssued) * 100)
    : 0;

  const payload = {
    global: {
      totalEvents: events.length,
      totalGuests: participants + guests,
      totalTicketsGenerated: ticketsGenerated,
      totalTicketsSent: ticketsSent,
      totalTicketsScanned: ticketsScanned,
      activeEvents: active,
      completedEvents: completed,
      upcomingEvents: upcoming,
    },
    attendance: {
      currentAttendance,
      totalAttendance,
      liveAttendanceRate,
      averageAttendance,
      hourlyCheckins: hourly.map((h) => ({ hour: h._id, count: h.n })),
      dailyCheckins: daily.map((d) => ({ day: d._id, count: d.n })),
    },
  };
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), payload });
  return ok(payload);
}
