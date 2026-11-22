import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ event: vi.fn(), holder: vi.fn(), qr: vi.fn() }));
vi.mock("@/models", () => ({ Event: { findById: mocks.event }, eventDeadline: (event: { endTime: Date }) => event.endTime }));
vi.mock("@/lib/tickets", () => ({ ticketIdentity: mocks.holder }));
vi.mock("@/lib/qr", () => ({ canonicalTicketQrUrl: mocks.qr }));
import { ticketPreview } from "@/lib/ticketPreview";
const ticket = { code: "secret", ticketNumber: "IRO-1", event: "event", status: "VALID" };
const event = { name: "Graduation", startTime: new Date("2030-11-21"), endTime: new Date("2030-11-22"), gallery: ["https://example.com/poster.png"], price: "Free" };
beforeEach(() => { vi.resetAllMocks(); mocks.qr.mockResolvedValue("data:image/png;base64,signed-qr"); });
it("builds the initial preview using already loaded dashboard data without another event or holder lookup", async () => {
  const preview = await ticketPreview(ticket as never, { event: event as never, holder: { name: "Aline", type: "PARTICIPANT" } });
  expect(preview).toMatchObject({ name: "Aline", eventName: "Graduation", number: "IRO-1", images: event.gallery, qr: "data:image/png;base64,signed-qr" });
  expect(mocks.event).not.toHaveBeenCalled(); expect(mocks.holder).not.toHaveBeenCalled();
  expect(mocks.qr).toHaveBeenCalledWith(ticket);
});
it("marks an expired ticket consistently with the PDF", async () => {
  const preview = await ticketPreview(ticket as never, { event: { ...event, endTime: new Date("2000-01-01") } as never, holder: { name: "Aline", type: "PARTICIPANT" } });
  expect(preview.status).toBe("EXPIRED");
});
