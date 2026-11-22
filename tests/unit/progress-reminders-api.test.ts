import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), db: vi.fn(), event: vi.fn(), run: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.db }));
vi.mock("@/models", () => ({ Event: { exists: mocks.event } }));
vi.mock("@/lib/reminders", () => ({ runDailyReminders: mocks.run }));
import { POST } from "@/app/api/admin/reminders/run/route";
const eventId = "507f1f77bcf86cd799439011";
const request = (body?: unknown) => new Request("http://localhost/api/admin/reminders/run", { method: "POST", ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
beforeEach(() => {
  vi.resetAllMocks();
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.event.mockResolvedValue({ _id: eventId });
  mocks.run.mockResolvedValue({ scanned: 3, sent: 2, skipped: 1, failed: 0 });
});
describe("programme-specific progress reminders", () => {
  it("requires an admin before accessing recipients", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request({ eventId }))).status).toBe(401);
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it.each([undefined, {}, { eventId: "all" }, { eventId: "invalid" }])("rejects missing or invalid programme selections: %j", async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.db).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("rejects missing, archived, closed or past programmes", async () => {
    mocks.event.mockResolvedValue(null);
    expect((await POST(request({ eventId }))).status).toBe(400);
    expect(mocks.event).toHaveBeenCalledWith({ _id: eventId, archivedAt: null, status: "OPEN", startTime: { $gt: expect.any(Date) } });
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it("sends only for the selected programme and returns delivery counts", async () => {
    const result = await POST(request({ eventId }));
    expect(result.status).toBe(200);
    expect(mocks.run).toHaveBeenCalledExactlyOnceWith(eventId);
    expect(await result.json()).toEqual({ scanned: 3, sent: 2, skipped: 1, failed: 0 });
  });
});
