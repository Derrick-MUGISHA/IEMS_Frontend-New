import type { Types } from "mongoose";
import { Event, Guest, Participant } from "@/models";
import { notifyAdmins } from "./notify";

export const PLUS_ONE_FULL_MESSAGE =
  "All plus-one places for this event have already been filled. Your own registration is confirmed.";

export const PLUS_ONE_FULL_GUEST_MESSAGE =
  "Sorry, all plus-one places for this event have already been filled, so this invite can no longer be used.";

/* Whether a participant holds one of the event's plus-one places (plusOneLimit,
   0 = unlimited). Places go to participants in the order they accept their
   invitation. A held place is kept for good; a refusal is re-checked on each
   call, so raising or removing the limit reopens plus-ones for those turned away.
   The conditional $inc keeps the counter from passing the limit under load. */
export async function claimPlusOneSlot(participant: {
  _id: Types.ObjectId;
  event: Types.ObjectId;
  status?: string;
  plusOneAllowed?: boolean | null;
}): Promise<boolean> {
  if (participant.status === "PENDING") return false;
  if (participant.plusOneAllowed === true) return true;

  /* plus-ones added before the limit existed must be counted before we claim */
  await syncPlusOneSlots([participant.event]);
  const synced = await Participant.findById(participant._id).select("plusOneAllowed");
  if (synced?.plusOneAllowed === true) {
    participant.plusOneAllowed = true;
    return true;
  }

  const claimed = await Event.findOneAndUpdate(
    {
      _id: participant.event,
      $expr: {
        $or: [
          { $lte: [{ $ifNull: ["$plusOneLimit", 0] }, 0] },
          { $lt: [{ $ifNull: ["$plusOneSlotsTaken", 0] }, "$plusOneLimit"] },
        ],
      },
    },
    { $inc: { plusOneSlotsTaken: 1 } },
    { returnDocument: "after" }
  ).select("name plusOneLimit plusOneSlotsTaken");

  if (!claimed) {
    if (participant.plusOneAllowed !== false) {
      await Participant.updateOne(
        { _id: participant._id, plusOneAllowed: null },
        { plusOneAllowed: false }
      );
      participant.plusOneAllowed = false;
    }
    return false;
  }

  const res = await Participant.updateOne(
    { _id: participant._id, plusOneAllowed: { $ne: true } },
    { plusOneAllowed: true }
  );
  if (res.modifiedCount === 0) {
    /* a parallel call already gave them a place: hand ours back */
    await releasePlusOneSlot(participant.event);
    participant.plusOneAllowed = true;
    return true;
  }
  participant.plusOneAllowed = true;

  if (claimed.plusOneLimit > 0 && claimed.plusOneSlotsTaken === claimed.plusOneLimit) {
    await notifyAdmins({
      kind: "SYSTEM",
      severity: "warning",
      title: `Plus-one places are full for ${claimed.name}`,
      body: `All ${claimed.plusOneLimit} plus-one places have been claimed. Participants who accept from now on will register without a plus-one. Raise the limit on the event to reopen them.`,
      eventId: claimed._id,
    });
  }
  return true;
}

/* Count plus-ones that already exist toward the limit: participants who have a
   plus-one (live, or checked in and archived) are marked as holding a place, and
   the counter is raised to match. Only adds data, and $max never lowers the
   counter, so it is safe to run at any time, even alongside live claims. */
export async function syncPlusOneSlots(eventIds?: Types.ObjectId[]) {
  const scope = eventIds ? { event: { $in: eventIds } } : {};
  const inviters = await Guest.distinct("inviter", {
    ...scope,
    guestType: "PLUS_ONE",
    inviter: { $ne: null },
  });
  await Participant.updateMany(
    {
      ...scope,
      plusOneAllowed: { $ne: true },
      $or: [{ _id: { $in: inviters } }, { plusOne: { $ne: null } }],
    },
    { $set: { plusOneAllowed: true } }
  );
  const counts: { _id: Types.ObjectId; n: number }[] = await Participant.aggregate([
    { $match: { ...scope, plusOneAllowed: true } },
    { $group: { _id: "$event", n: { $sum: 1 } } },
  ]);
  if (counts.length) {
    await Event.bulkWrite(
      counts.map((c) => ({
        updateOne: { filter: { _id: c._id }, update: { $max: { plusOneSlotsTaken: c.n } } },
      }))
    );
  }
}

export async function releasePlusOneSlot(eventId: Types.ObjectId) {
  await Event.updateOne(
    { _id: eventId, plusOneSlotsTaken: { $gt: 0 } },
    { $inc: { plusOneSlotsTaken: -1 } }
  );
}
