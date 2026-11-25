import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ event: vi.fn(), identity: vi.fn(), image: vi.fn(), sign: vi.fn(), render: vi.fn() }));
vi.mock("@/models", () => ({ Event: { findById: mocks.event }, eventDeadline: (event: { endTime: Date }) => event.endTime }));
vi.mock("@/lib/tickets", () => ({ ticketIdentity: mocks.identity }));
vi.mock("@/lib/imageFetch", () => ({ fetchImageBuffer: mocks.image }));
vi.mock("@/lib/qr", () => ({ canonicalTicketQrPng: mocks.sign }));
vi.mock("@/lib/ticketPdf", () => ({ ticketPdfBuffer: mocks.render }));
const ticket = { code: "secret", ticketNumber: "IRO-1", event: "event-id", status: "VALID" };
const event = { name: "Conference", startTime: new Date("2030-11-21"), endTime: new Date("2030-11-22"), gallery: ["https://example.com/poster.png"] };
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks();
  mocks.event.mockResolvedValue(event); mocks.identity.mockResolvedValue({ name: "Aline", type: "PARTICIPANT" });
  mocks.render.mockResolvedValue(Buffer.from("pdf"));
  mocks.sign.mockResolvedValue(Buffer.from("canonical-qr"));
});
it("reuses the PDF and coalesces concurrent downloads while checking fresh ticket metadata", async () => {
  const { ticketDocument } = await import("@/lib/ticketDocument");
  await Promise.all([ticketDocument(ticket as never), ticketDocument(ticket as never)]);
  await ticketDocument(ticket as never);
  expect(mocks.render).toHaveBeenCalledOnce(); expect(mocks.image).toHaveBeenCalledOnce();
  expect(mocks.event).toHaveBeenCalledTimes(3);
  expect(mocks.render).toHaveBeenCalledWith(expect.objectContaining({ qrPng: Buffer.from("canonical-qr") }));
});
it("regenerates the PDF when its QR, status, holder, or event artwork changes", async () => {
  const { ticketDocument } = await import("@/lib/ticketDocument");
  await ticketDocument(ticket as never);
  await ticketDocument({ ...ticket, code: "rotated" } as never);
  await ticketDocument({ ...ticket, status: "REVOKED" } as never);
  mocks.identity.mockResolvedValue({ name: "Renamed", type: "PARTICIPANT" });
  await ticketDocument(ticket as never);
  mocks.event.mockResolvedValue({ ...event, gallery: ["https://example.com/new-poster.png"] });
  await ticketDocument(ticket as never);
  expect(mocks.render).toHaveBeenCalledTimes(5);
});
it("does not cache failed PDF generation", async () => {
  const { ticketDocument } = await import("@/lib/ticketDocument");
  mocks.render.mockRejectedValueOnce(new Error("temporary failure"));
  await expect(ticketDocument(ticket as never)).rejects.toThrow("temporary failure");
  await expect(ticketDocument(ticket as never)).resolves.toEqual(Buffer.from("pdf"));
  expect(mocks.render).toHaveBeenCalledTimes(2);
});
it("does not reuse a valid PDF after the event expires", async () => {
  const { ticketDocument } = await import("@/lib/ticketDocument");
  await ticketDocument(ticket as never);
  mocks.event.mockResolvedValue({ ...event, endTime: new Date("2000-01-01") });
  await ticketDocument(ticket as never);
  expect(mocks.render.mock.calls.at(-1)![0].status).toBe("EXPIRED");
  expect(mocks.render).toHaveBeenCalledTimes(2);
});
