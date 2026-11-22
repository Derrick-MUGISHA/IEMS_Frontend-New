import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireScanner: vi.fn(), verifyQrToken: vi.fn(), dbConnect: vi.fn(),
  getAuth: vi.fn(), requireAdmin: vi.fn(),
  findTicket: vi.fn(), findTicketById: vi.fn(), claimTicket: vi.fn(),
  findEvent: vi.fn(), findParticipant: vi.fn(), findGuest: vi.fn(),
  createLog: vi.fn(), publishScan: vi.fn(), notifyAdmins: vi.fn(), identity: vi.fn(),
  deleteParticipant: vi.fn(), deleteGuests: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  requireScanner: mocks.requireScanner, verifyQrToken: mocks.verifyQrToken,
  getAuth: mocks.getAuth, requireAdmin: mocks.requireAdmin,
}));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.dbConnect }));
vi.mock("@/lib/scanBus", () => ({ publishScan: mocks.publishScan }));
vi.mock("@/lib/notify", () => ({ notifyAdmins: mocks.notifyAdmins }));
vi.mock("@/lib/tickets", () => ({ ticketIdentity: mocks.identity }));
vi.mock("@/models", () => ({
  Ticket: { findOne: mocks.findTicket, findById: mocks.findTicketById, findOneAndUpdate: mocks.claimTicket },
  Event: { findById: mocks.findEvent },
  Participant: { findById: mocks.findParticipant, deleteOne: mocks.deleteParticipant },
  Guest: { findById: mocks.findGuest, deleteMany: mocks.deleteGuests },
  ScanLog: { create: mocks.createLog },
  eventDeadline: (event: { endTime: Date }) => event.endTime,
}));

import { POST as scan } from "@/app/api/scan/route";
import { POST as validate } from "@/app/api/tickets/validate/route";
import { GET as download } from "@/app/api/tickets/[id]/download/route";
import { POST as reset } from "@/app/api/admin/tickets/[id]/reset/route";
const request = (body: unknown) => new Request("http://localhost/api/scan", {
  method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
});
const ticket = { _id: "ticket-id", code: "secret-code", status: "VALID", holderType: "Participant", holderId: "holder-id", event: "event-id" };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireScanner.mockResolvedValue({ adminId: "admin-id" });
  mocks.verifyQrToken.mockResolvedValue({ code: ticket.code });
  mocks.findTicket.mockResolvedValue({ ...ticket });
  mocks.findTicketById.mockResolvedValue({ ...ticket });
  mocks.claimTicket.mockResolvedValue({ ...ticket, status: "USED" });
  mocks.findEvent.mockResolvedValue({ _id: "event-id", name: "Conference", endTime: new Date("2099-01-01") });
  mocks.findParticipant.mockResolvedValue({ _id: "holder-id", name: "Attendee", email: "attendee@example.com", stack: "FRONTEND" });
  mocks.identity.mockResolvedValue({ name: "Attendee", type: "PARTICIPANT" });
});

describe("gate check-in", () => {
  it("requires a staff session before accessing tickets", async () => {
    mocks.requireScanner.mockResolvedValue(null);
    expect((await scan(request({ qr: "signed-token" }))).status).toBe(401);
    expect(mocks.findTicket).not.toHaveBeenCalled();
  });

  it("rejects unsigned QR data without claiming a ticket", async () => {
    mocks.verifyQrToken.mockResolvedValue(null);
    expect((await (await scan(request({ qr: "unsigned-token" }))).json()).result).toBe("INVALID");
    expect(mocks.claimTicket).not.toHaveBeenCalled();
  });

  it("keeps attendee and plus-one records and archives identity in the atomic claim", async () => {
    expect((await (await scan(request({ qr: "signed-token" }))).json()).result).toBe("ACCEPTED");
    expect(mocks.claimTicket).toHaveBeenCalledWith(
      { code: ticket.code, status: "VALID" },
      { $set: expect.objectContaining({ status: "USED", holder: expect.objectContaining({ name: "Attendee", email: "attendee@example.com" }) }) },
      { new: true },
    );
    expect(mocks.deleteParticipant).not.toHaveBeenCalled();
    expect(mocks.deleteGuests).not.toHaveBeenCalled();
  });

  it.each(["USED", "REVOKED"])("does not admit a %s ticket", async (status) => {
    mocks.findTicket.mockResolvedValue({ ...ticket, status });
    const result = await (await scan(request({ qr: "signed-token" }))).json();
    expect(result.result).toBe(status === "USED" ? "ALREADY_USED" : "REVOKED");
    expect(mocks.claimTicket).not.toHaveBeenCalled();
  });

  it("does not admit an expired ticket or one whose event was deleted", async () => {
    mocks.findEvent.mockResolvedValueOnce({ endTime: new Date("2000-01-01") }).mockResolvedValueOnce(null);
    expect((await (await scan(request({ qr: "signed-token" }))).json()).result).toBe("EXPIRED");
    expect((await (await scan(request({ qr: "signed-token" }))).json()).result).toBe("INVALID");
    expect(mocks.claimTicket).not.toHaveBeenCalled();
  });

  it.each([["REVOKED", "REVOKED"], ["USED", "ALREADY_USED"], ["VALID", "INVALID"]])("reports a concurrent %s change accurately", async (status, expected) => {
    mocks.claimTicket.mockResolvedValue(null);
    mocks.findTicketById.mockResolvedValue({ ...ticket, status, scannedAt: null });
    expect((await (await scan(request({ qr: "signed-token" }))).json()).result).toBe(expected);
  });
});

describe("read-only ticket lookup", () => {
  it("accepts the printed ticket number without consuming the pass", async () => {
    const result = await (await validate(request({ code: "  con-000042  " }))).json();
    expect(result.valid).toBe(true);
    expect(mocks.findTicket).toHaveBeenCalledWith({ $or: [{ code: "con-000042" }, { ticketNumber: "CON-000042" }] });
    expect(mocks.claimTicket).not.toHaveBeenCalled();
    expect(mocks.createLog).not.toHaveBeenCalled();
  });

  it("does not treat an orphaned event's ticket as valid", async () => {
    mocks.findEvent.mockResolvedValue(null);
    const result = await (await validate(request({ code: "CON-000042" }))).json();
    expect(result).toMatchObject({ valid: false, reason: "UNKNOWN_EVENT" });
  });

  it("does not bypass signature verification when both a code and QR are supplied", async () => {
    mocks.verifyQrToken.mockResolvedValue(null);
    const result = await (await validate(request({ code: "CON-000042", qr: "unsigned-token" }))).json();
    expect(result.valid).toBe(false);
    expect(mocks.findTicket).not.toHaveBeenCalled();
  });
});

describe("admin pass actions", () => {
  const context = { params: Promise.resolve({ id: "507f1f77bcf86cd799439011" }) };

  it("rejects a PDF download using a deactivated admin's token", async () => {
    mocks.getAuth.mockResolvedValue({ kind: "admin", sub: "admin-id" });
    mocks.requireAdmin.mockResolvedValue(null);
    expect((await download(request({}), context)).status).toBe(401);
    expect(mocks.findTicketById).not.toHaveBeenCalled();
  });

  it.each(["USED", "REVOKED"])("does not reset a %s ticket into a usable pass", async (status) => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin-id" });
    mocks.findTicketById.mockResolvedValue({ ...ticket, status });
    expect((await reset(request({}), context)).status).toBe(409);
  });
});
