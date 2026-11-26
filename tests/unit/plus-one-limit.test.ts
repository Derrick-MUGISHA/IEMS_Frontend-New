import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

const mocks = vi.hoisted(() => ({
  findOneAndUpdate: vi.fn(),
  eventUpdateOne: vi.fn(),
  participantUpdateOne: vi.fn(),
  guestDistinct: vi.fn(),
  participantUpdateMany: vi.fn(),
  participantFindById: vi.fn(),
  aggregate: vi.fn(),
  bulkWrite: vi.fn(),
  notifyAdmins: vi.fn(),
}));
vi.mock("@/models", () => ({
  Event: { findOneAndUpdate: mocks.findOneAndUpdate, updateOne: mocks.eventUpdateOne, bulkWrite: mocks.bulkWrite },
  Participant: {
    updateOne: mocks.participantUpdateOne,
    updateMany: mocks.participantUpdateMany,
    findById: mocks.participantFindById,
    aggregate: mocks.aggregate,
  },
  Guest: { distinct: mocks.guestDistinct },
}));
vi.mock("@/lib/notify", () => ({ notifyAdmins: mocks.notifyAdmins }));

import { claimPlusOneSlot, syncPlusOneSlots } from "@/lib/plusOneSlots";
import { plusOnePlaces } from "@/models/Event";
import { renderRegistrationConfirmation } from "@/lib/mailer";

const eventId = new Types.ObjectId();
const participant = (over: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(),
  event: eventId,
  status: "VERIFIED",
  plusOneAllowed: null as boolean | null,
  ...over,
});
const claimedEvent = (taken: number, limit: number) => ({
  select: vi.fn().mockResolvedValue({ _id: eventId, name: "Demo Day", plusOneLimit: limit, plusOneSlotsTaken: taken }),
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.guestDistinct.mockResolvedValue([]);
  mocks.aggregate.mockResolvedValue([]);
  mocks.participantFindById.mockReturnValue({ select: vi.fn().mockResolvedValue({ plusOneAllowed: null }) });
  mocks.participantUpdateOne.mockResolvedValue({ modifiedCount: 1 });
});

describe("plusOnePlaces", () => {
  it("treats 0 as unlimited", () => {
    expect(plusOnePlaces({ plusOneLimit: 0, plusOneSlotsTaken: 12 })).toEqual({ limit: 0, taken: 12, remaining: null, full: false });
  });
  it("reports full once every place is claimed", () => {
    expect(plusOnePlaces({ plusOneLimit: 40, plusOneSlotsTaken: 40 })).toMatchObject({ remaining: 0, full: true });
    expect(plusOnePlaces({ plusOneLimit: 40, plusOneSlotsTaken: 39 })).toMatchObject({ remaining: 1, full: false });
  });
});

describe("claimPlusOneSlot", () => {
  it("never gives a place before the invitation is accepted", async () => {
    expect(await claimPlusOneSlot(participant({ status: "PENDING" }))).toBe(false);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("keeps a place already held without touching the counter", async () => {
    expect(await claimPlusOneSlot(participant({ plusOneAllowed: true }))).toBe(true);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it("only increments while under the limit, or when unlimited", async () => {
    mocks.findOneAndUpdate.mockReturnValue(claimedEvent(5, 40));
    expect(await claimPlusOneSlot(participant())).toBe(true);
    const [filter, update] = mocks.findOneAndUpdate.mock.calls[0];
    expect(filter.$expr.$or).toHaveLength(2);
    expect(update).toEqual({ $inc: { plusOneSlotsTaken: 1 } });
    expect(mocks.notifyAdmins).not.toHaveBeenCalled();
  });

  it("tells the admins when the last place is taken", async () => {
    mocks.findOneAndUpdate.mockReturnValue(claimedEvent(40, 40));
    expect(await claimPlusOneSlot(participant())).toBe(true);
    expect(mocks.notifyAdmins).toHaveBeenCalledWith(expect.objectContaining({ title: "Plus-one places are full for Demo Day" }));
  });

  it("refuses once full and records the refusal", async () => {
    mocks.findOneAndUpdate.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
    const p = participant();
    expect(await claimPlusOneSlot(p)).toBe(false);
    expect(mocks.participantUpdateOne).toHaveBeenCalledWith({ _id: p._id, plusOneAllowed: null }, { plusOneAllowed: false });
  });

  it("re-checks a refused participant so a raised limit reopens their place", async () => {
    mocks.findOneAndUpdate.mockReturnValue(claimedEvent(41, 50));
    expect(await claimPlusOneSlot(participant({ plusOneAllowed: false }))).toBe(true);
  });

  it("returns the extra place when a parallel call already granted one", async () => {
    mocks.findOneAndUpdate.mockReturnValue(claimedEvent(6, 40));
    mocks.participantUpdateOne.mockResolvedValue({ modifiedCount: 0 });
    expect(await claimPlusOneSlot(participant())).toBe(true);
    expect(mocks.eventUpdateOne).toHaveBeenCalledWith(
      { _id: eventId, plusOneSlotsTaken: { $gt: 0 } },
      { $inc: { plusOneSlotsTaken: -1 } }
    );
  });
});

describe("existing plus-ones", () => {
  it("count toward the limit without deleting anything", async () => {
    const inviter = new Types.ObjectId();
    mocks.guestDistinct.mockResolvedValue([inviter]);
    mocks.aggregate.mockResolvedValue([{ _id: eventId, n: 22 }]);
    await syncPlusOneSlots();
    expect(mocks.participantUpdateMany).toHaveBeenCalledWith(
      { plusOneAllowed: { $ne: true }, $or: [{ _id: { $in: [inviter] } }, { plusOne: { $ne: null } }] },
      { $set: { plusOneAllowed: true } }
    );
    expect(mocks.bulkWrite).toHaveBeenCalledWith([
      { updateOne: { filter: { _id: eventId }, update: { $max: { plusOneSlotsTaken: 22 } } } },
    ]);
  });

  it("are not counted twice when their participant opens the dashboard", async () => {
    mocks.participantFindById.mockReturnValue({ select: vi.fn().mockResolvedValue({ plusOneAllowed: true }) });
    expect(await claimPlusOneSlot(participant())).toBe(true);
    expect(mocks.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe("registration confirmation email", () => {
  it("doesn't mention plus-ones at all when no place is left", () => {
    const { html } = renderRegistrationConfirmation({ name: "Aline", eventName: "Demo Day", plusOne: { allowed: false, limit: 40 } });
    expect(html).not.toMatch(/plus-one/i);
    expect(html).not.toMatch(/full|filled/i);
  });
  it("offers the plus-one without counts to those who got a place", () => {
    const { html } = renderRegistrationConfirmation({ name: "Aline", eventName: "Demo Day", plusOne: { allowed: true, limit: 40 } });
    expect(html).toContain("You can also bring a plus-one");
    expect(html).not.toMatch(/40 plus-one|places/);
  });
  it("mentions no limit when plus-ones are unlimited", () => {
    const { html } = renderRegistrationConfirmation({ name: "Aline", eventName: "Demo Day", plusOne: { allowed: true, limit: 0 } });
    expect(html).toContain("You can also bring a plus-one");
    expect(html).not.toContain("places");
  });
});
