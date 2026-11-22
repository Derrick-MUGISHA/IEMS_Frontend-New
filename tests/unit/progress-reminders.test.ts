import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ events: vi.fn(), participants: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbConnect: async () => {} }));
vi.mock("@/lib/mailer", () => ({ sendProgressReminderEmail: vi.fn() }));
vi.mock("@/models", () => ({ Event: { find: mocks.events }, Participant: { find: mocks.participants }, Guest: {}, VerificationToken: {}, EmailLog: {} }));
import { runDailyReminders } from "@/lib/reminders";
beforeEach(() => { vi.resetAllMocks(); mocks.events.mockReturnValue({ select: vi.fn().mockResolvedValue([]) }); });
describe("reminder recipient scope", () => {
  it("restricts a manual run to its selected event before loading any recipients", async () => {
    await runDailyReminders("507f1f77bcf86cd799439011");
    expect(mocks.events).toHaveBeenCalledWith({ _id: "507f1f77bcf86cd799439011", startTime: { $gt: expect.any(Date) }, archivedAt: null, status: "OPEN" });
    expect(mocks.participants).not.toHaveBeenCalled();
  });
  it("preserves the scheduled daily run across eligible events", async () => {
    const summary = await runDailyReminders();
    expect(mocks.events).toHaveBeenCalledWith({ startTime: { $gt: expect.any(Date) }, archivedAt: null, status: "OPEN" });
    expect(summary).toEqual({ scanned: 0, sent: 0, skipped: 0, failed: 0 });
  });
});
