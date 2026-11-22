import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ dbConnect: async () => {} }));
vi.mock("@/models/EmailLog", () => ({ EmailLog: { create: async () => ({}) } }));
import {
  renderMagicLinkEmail, renderRegistrationConfirmation, renderPlusOneInviteEmail,
  renderEventUpdateEmail, renderEventReminderEmail, renderProgressReminderEmail,
  renderPlusOneRevokedEmail, renderTicketNudgeEmail, renderTicketEmail,
  type RenderedEmail,
} from "@/lib/mailer";
const sample = { name: "Aline Uwase", eventName: "Community Meetup", url: "https://example.com/verify/token", whenLabel: "tomorrow" };
const templates: [string, () => RenderedEmail][] = [
  ["verification", () => renderMagicLinkEmail(sample)],
  ["confirmation", () => renderRegistrationConfirmation(sample)],
  ["plus-one invitation", () => renderPlusOneInviteEmail({ ...sample, participantName: sample.name })],
  ["event update", () => renderEventUpdateEmail({ ...sample, message: "The doors open at 9am." })],
  ["event reminder", () => renderEventReminderEmail(sample)],
  ...(["VERIFY", "FINISH", "PLUS_ONE"] as const).map((step): [string, () => RenderedEmail] => [step, () => renderProgressReminderEmail({ ...sample, step })]),
  ["revoked guest pass", () => renderPlusOneRevokedEmail(sample)],
  ["ticket nudge", () => renderTicketNudgeEmail(sample)],
  ["ticket", () => renderTicketEmail({ ...sample, type: "GENERAL", ticketCode: "sample", ticketUrl: "https://example.com/ticket/sample" })],
];
beforeEach(() => {
  vi.stubEnv("ORG_URL", "https://igirerwanda.org");
  vi.stubEnv("ORG_NAME", "Igire Rwanda");
  vi.stubEnv("ORG_ADDRESS", "Kigali, Rwanda");
  vi.stubEnv("ORG_UNSUBSCRIBE_EMAIL", "unsubscribe@igirerwanda.org");
  vi.stubEnv("ORG_PRIVACY_URL", "");
  vi.stubEnv("ORG_CONTACT_URL", "");
  vi.stubEnv("ORG_BLOG_URL", "");
});
afterEach(() => vi.unstubAllEnvs());
describe("shared outgoing email footer", () => {
  it.each(templates)("includes the complete reference footer once in %s emails", (_name, render) => {
    const { html } = render();
    expect(html).not.toContain("Sincerely,");
    expect(html).not.toContain("Admissions &amp; Bootcamp Team");
    expect(html.match(/alt="Igire Rwanda Logo"/g)).toHaveLength(1);
    expect(html.match(/Official Communication from Igire Rwanda Organization/g)).toHaveLength(1);
    expect(html).toContain('align="center"');
    expect(html).toContain('href="https://igirerwanda.org/privacy"');
    expect(html).toContain('href="https://igirerwanda.org/contact"');
    expect(html).toContain('href="https://igirerwanda.org/blog"');
    expect(html).toContain(`© ${new Date().getFullYear()} Igire Rwanda. All rights reserved. We are located at Kigali, Rwanda.`);
    expect(html).toContain("You're receiving this because you're on the Igire Rwanda contact list.");
    expect(html).toContain('href="mailto:unsubscribe@igirerwanda.org?subject=Unsubscribe"');
  });
});
