import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), db: vi.fn(), event: vi.fn(), tickets: vi.fn(), bulk: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.db }));
vi.mock("@/models", () => ({ Event: { findById: mocks.event }, Ticket: { find: mocks.tickets }, Participant: { bulkWrite: mocks.bulk } }));
import { POST } from "@/app/api/admin/attendees/import/route";
const eventId = "507f1f77bcf86cd799439011";
const rows = Array.from({ length: 150 }, (_, i) => ({ name: `Person ${i}`, email: `person${i}@example.com` }));
const request = (participants: unknown = rows, id = eventId) => new Request("http://localhost/api/admin/attendees/import", { method: "POST", body: JSON.stringify({ eventId: id, participants }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.event.mockResolvedValue({ _id: eventId });
  mocks.tickets.mockReturnValue({ select: vi.fn().mockResolvedValue([]) });
  mocks.bulk.mockResolvedValue({ upsertedCount: 150, upsertedIds: Object.fromEntries(rows.map((_, i) => [i, String(i + 1).padStart(24, "0")])) });
});
describe("bulk participant import API", () => {
  it("requires an active admin before accessing registrations", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("validates every row and event before writing", async () => {
    expect((await POST(request([{ name: "Aline", email: "invalid" }]))).status).toBe(400);
    expect((await POST(request(rows, "bad-id"))).status).toBe(400);
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it("imports 150 people using insert-only upserts and safely skips a repeated batch", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect((await response.json()).participantIds).toHaveLength(150);
    const [operations, options] = mocks.bulk.mock.calls[0];
    expect(operations).toHaveLength(150);
    expect(operations[0].updateOne).toMatchObject({ filter: { event: eventId, email: rows[0].email }, upsert: true });
    expect(Object.keys(operations[0].updateOne.update)).toEqual(["$setOnInsert"]);
    expect(options).toEqual({ ordered: false, timestamps: false });
    mocks.bulk.mockResolvedValue({ upsertedCount: 0 });
    expect(await (await POST(request())).json()).toMatchObject({ imported: 0, skipped: 150, participantIds: [] });
  });
  it("preserves an archived holder instead of recreating their registration", async () => {
    mocks.tickets.mockReturnValue({ select: vi.fn().mockResolvedValue([{ holder: { email: rows[0].email } }]) });
    expect(await (await POST(request([rows[0]]))).json()).toMatchObject({ imported: 0, skipped: 1 });
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it("rejects archived events without writing", async () => {
    mocks.event.mockResolvedValue({ _id: eventId, archivedAt: new Date() });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.bulk).not.toHaveBeenCalled();
  });
  it("handles concurrent duplicate-key races without overwriting records", async () => {
    mocks.bulk.mockRejectedValue({ writeErrors: [{ code: 11000 }], result: { upsertedCount: 149 } });
    expect(await (await POST(request())).json()).toMatchObject({ imported: 149, skipped: 1 });
  });
  it("does not hide database errors as skipped rows", async () => {
    mocks.bulk.mockRejectedValue(new Error("database unavailable"));
    await expect(POST(request())).rejects.toThrow("database unavailable");
  });
});
