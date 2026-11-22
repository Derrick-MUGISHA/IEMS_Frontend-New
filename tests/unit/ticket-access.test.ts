import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findOne: vi.fn(), findById: vi.fn(), document: vi.fn(), connect: vi.fn(),
  getAuth: vi.fn(), requireAdmin: vi.fn(), owns: vi.fn(),
}));
vi.mock("@/models", () => ({ Ticket: { findOne: mocks.findOne, findById: mocks.findById } }));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.connect }));
vi.mock("@/lib/auth", () => ({ getAuth: mocks.getAuth, requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/tickets", () => ({ participantOwnsTicket: mocks.owns }));
vi.mock("@/lib/ticketDocument", () => ({ ticketDocument: mocks.document }));
import { GET as shared } from "@/app/api/tickets/by-code/[code]/pdf/route";
import { GET as owned } from "@/app/api/tickets/[id]/download/route";

const ticket = { _id: "507f1f77bcf86cd799439011", code: "secret-random-ticket-code", ticketNumber: "IRO-000042" };
const request = new Request("http://localhost/ticket");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.document.mockResolvedValue(Buffer.from("%PDF-same-ticket"));
  mocks.findOne.mockResolvedValue(ticket);
  mocks.findById.mockResolvedValue(ticket);
});

describe("one PDF ticket through every access path", () => {
  it("lets the emailed secret link view the PDF without an admin login", async () => {
    const res = await shared(request, { params: Promise.resolve({ code: ticket.code }) });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    expect(mocks.findOne).toHaveBeenCalledWith({ code: ticket.code });
    expect(mocks.document).toHaveBeenCalledWith(ticket);
  });
  it("never looks up a public link by ticket number or database id", async () => {
    mocks.findOne.mockResolvedValue(null);
    expect((await shared(request, { params: Promise.resolve({ code: ticket.ticketNumber }) })).status).toBe(404);
    expect(mocks.findOne).toHaveBeenCalledWith({ code: ticket.ticketNumber });
    expect(mocks.document).not.toHaveBeenCalled();
  });
  it("rejects malformed link codes before accessing the database", async () => {
    expect((await shared(request, { params: Promise.resolve({ code: "x" }) })).status).toBe(404);
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("uses the same PDF renderer for an authorized participant", async () => {
    mocks.getAuth.mockResolvedValue({ kind: "attendee", sub: "participant-id" });
    mocks.owns.mockResolvedValue(true);
    const res = await owned(request, { params: Promise.resolve({ id: ticket._id }) });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("%PDF-same-ticket");
    expect(mocks.document).toHaveBeenCalledWith(ticket);
  });
  it("does not let a participant access somebody else's ticket by id", async () => {
    mocks.getAuth.mockResolvedValue({ kind: "attendee", sub: "other-participant" });
    mocks.owns.mockResolvedValue(false);
    expect((await owned(request, { params: Promise.resolve({ id: ticket._id }) })).status).toBe(403);
    expect(mocks.document).not.toHaveBeenCalled();
  });
});
