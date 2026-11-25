import { afterEach, describe, expect, it, vi } from "vitest";
const sendMail = vi.hoisted(() => vi.fn(async (options: unknown) => { void options; return {}; }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock("@/lib/db", () => ({ dbConnect: async () => {} }));
vi.mock("@/models/EmailLog", () => ({ EmailLog: { create: async () => ({}) } }));
import { renderTicketEmail, sendTicketEmail } from "@/lib/mailer";
const data = { to: "guest@example.com", name: "Aline Uwase", type: "GENERAL", eventName: "Community Meetup", ticketCode: "secret-ticket-code", ticketUrl: "https://example.com/ticket/secret-ticket-code", pdf: Buffer.from("%PDF-ticket") };
afterEach(() => { vi.unstubAllEnvs(); sendMail.mockClear(); });
describe("ticket email", () => {
  it("delivers one PDF attachment without a second QR image or HTML pass", async () => {
    await sendTicketEmail(data);
    const mail = sendMail.mock.calls[0][0] as unknown as { attachments: { contentType: string; filename: string }[]; html: string };
    expect(mail.attachments).toHaveLength(1);
    expect(mail.attachments[0]).toMatchObject({ contentType: "application/pdf", filename: "ticket.pdf" });
    expect(mail.html.match(/<img /g)).toHaveLength(1);
    expect(mail.html).toContain('alt="Igire Rwanda Logo"');
    expect(mail.html).toContain("Open my ticket");
  });
  it("describes the PDF as the ticket instead of offering a second pass below", () => {
    const rendered = renderTicketEmail(data);
    expect(rendered.html).toContain("Your ticket is the PDF attached");
    expect(rendered.html).not.toContain("pass is below");
    expect(rendered.html).not.toContain("Admissions &amp; Bootcamp Team");
    expect(rendered.html).not.toContain("Sincerely,");
    expect(rendered.html).toContain("Scroll to the bottom of this email to find the attached ticket.pdf file.");
    expect(rendered.html).toContain("margin:0 auto;height:80px");
    expect(rendered.html).toContain('height="80"');
    expect(rendered.html).not.toContain("Official event communication");
  });
  it("uses the configured no-reply sender and the branded email layout", async () => {
    vi.stubEnv("MAIL_FROM_ADDRESS", "no-reply@example.com");
    vi.stubEnv("MAIL_REPLY_TO", "");
    await sendTicketEmail(data);
    const mail = sendMail.mock.calls[0][0] as { from: string; replyTo: string; html: string; text: string };
    expect(mail.from).toContain("<no-reply@example.com>");
    expect(mail.replyTo).toBe("no-reply@example.com");
    expect(mail.html).toContain("Official Communication from Igire Rwanda Organization");
    expect(mail.html).not.toContain("This is an automated message");
    expect(mail.html).not.toContain("For assistance, please contact your event organiser");
    expect(mail.text).toContain("Open my ticket");
  });
});
