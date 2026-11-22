import { expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ qr: vi.fn(), pdf: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/qr", () => ({ canonicalTicketQrPng: mocks.qr, canonicalTicketQrUrl: vi.fn() }));
vi.mock("@/lib/ticketPdf", () => ({ ticketPdfBuffer: mocks.pdf }));
vi.mock("@/lib/imageFetch", () => ({ fetchImageBuffer: async () => null }));
vi.mock("@/lib/mailer", () => ({ sendTicketEmail: mocks.send }));
import { emailTicket } from "@/lib/tickets";
it("embeds the canonical ticket QR in the emailed PDF, including document getter fields", async () => {
  const issuedAt = new Date();
  const ticket = Object.create({ issuedAt, qrIssuedAt: null, ticketNumber: "IRO-42", status: "VALID" });
  mocks.qr.mockResolvedValue(Buffer.from("shared-qr-png"));
  mocks.pdf.mockResolvedValue(Buffer.from("ticket-pdf"));
  await emailTicket({ kind: "Participant", doc: { name: "Aline", email: "test@example.com", stack: "FRONTEND" } } as never, { name: "Graduation", startTime: new Date(), endTime: new Date(Date.now() + 86400000), gallery: [] } as never, "test-code", ticket);
  expect(mocks.qr).toHaveBeenCalledExactlyOnceWith({ code: "test-code", issuedAt, qrIssuedAt: null });
  expect(mocks.pdf).toHaveBeenCalledWith(expect.objectContaining({ qrPng: Buffer.from("shared-qr-png"), ticketNumber: "IRO-42" }));
  expect(mocks.pdf.mock.calls[0][0].qrPayload).toBeUndefined();
  expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ pdf: Buffer.from("ticket-pdf") }));
});
