import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), db: vi.fn(), find: vi.fn(), event: vi.fn(), send: vi.fn(), used: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.db }));
vi.mock("@/lib/participantInvitation", () => ({ sendParticipantInvitation: mocks.send }));
vi.mock("@/models", () => ({ Participant: { find: mocks.find }, Event: { findById: mocks.event }, Ticket: { exists: mocks.used } }));
import { POST } from "@/app/api/admin/attendees/invitations/route";
const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];
const people = ids.map((_id, i) => ({ _id, name: `Person ${i}`, email: `p${i}@example.com`, event: "event-id", registrationStatus: "APPROVED", status: "PENDING" }));
const request = (participantIds: unknown = ids) => new Request("http://localhost/api/admin/attendees/invitations", { method: "POST", body: JSON.stringify({ participantIds }) });
beforeEach(() => {
  vi.resetAllMocks(); mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.find.mockResolvedValue(people); mocks.event.mockResolvedValue({ name: "Graduation" });
});
describe("participant invitation batches", () => {
  it("requires authentication before reading participants or sending mail", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled(); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("rejects invalid ids and oversized batches", async () => {
    expect((await POST(request(["bad-id"]))).status).toBe(400);
    expect((await POST(request(Array(11).fill(ids[0])))).status).toBe(400);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("deduplicates recipients and sends the correct participant and event", async () => {
    const result = await (await POST(request([ids[0], ids[0]]))).json();
    expect(result).toEqual({ sent: [ids[0]], failed: [] });
    expect(mocks.send).toHaveBeenCalledExactlyOnceWith(people[0], "Graduation");
  });
  it("reports delivery failures without hiding successfully sent invitations", async () => {
    mocks.send.mockImplementation(async (p) => { if (p._id === ids[1]) throw new Error("SMTP unavailable"); });
    expect(await (await POST(request())).json()).toEqual({ sent: [ids[0]], failed: [{ id: ids[1], error: "SMTP unavailable" }] });
  });
  it("does not email missing or rejected participants", async () => {
    mocks.find.mockResolvedValue([{ ...people[0], registrationStatus: "REJECTED" }]);
    const result = await (await POST(request())).json();
    expect(result.sent).toEqual([]); expect(result.failed).toHaveLength(2); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not invite people to archived events", async () => {
    mocks.event.mockResolvedValue({ name: "Old event", archivedAt: new Date() });
    expect((await (await POST(request())).json()).failed).toHaveLength(2);
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it.each(["VERIFIED", "COMPLETE"])("does not resend to a %s participant", async (status) => {
    mocks.find.mockResolvedValue([{ ...people[0], status }]);
    expect((await (await POST(request([ids[0]]))).json()).failed[0].error).toContain("already verified");
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not resend when the ticket has already been used", async () => {
    mocks.used.mockResolvedValue({ _id: "used-ticket" });
    expect((await (await POST(request([ids[0]]))).json()).failed[0].error).toContain("already been used");
    expect(mocks.send).not.toHaveBeenCalled();
  });
});
