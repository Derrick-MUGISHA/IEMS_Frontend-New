// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ send: vi.fn().mockResolvedValue({ sent: 1 }), report: vi.fn() }));
vi.mock("@/hooks/admin/emails", () => ({
  useEmailReport: () => mocks.report(),
  useEmailDetail: () => ({}),
  useEmailTemplates: () => ({ isPending: true }),
  useRunReminders: () => ({ mutateAsync: mocks.send, isPending: false }),
  useSendPassEmails: () => ({ isPending: false }),
}));
vi.mock("@/hooks/admin/participants", () => ({ useParticipants: () => ({ data: [] }) }));
vi.mock("@/hooks/admin/events", () => ({ useEvents: () => ({ data: [{ id: "event-1", name: "Women in Tech", startTime: "2099-01-01", status: "OPEN", gallery: [] }] }) }));
import EmailsPage from "@/app/admin/(panel)/emails/page";
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: vi.fn() });
});
afterEach(() => { cleanup(); mocks.send.mockClear(); });
beforeEach(() => { mocks.report.mockReturnValue({ isPending: true }); });
it("requires a programme and explicit send action before requesting reminders", async () => {
  const user = userEvent.setup();
  render(<EmailsPage />);
  await user.click(screen.getByRole("button", { name: "Send progress reminders" }));
  const send = screen.getByRole("button", { name: "Send reminders" }) as HTMLButtonElement;
  expect(send.disabled).toBe(true);
  expect(mocks.send).not.toHaveBeenCalled();
  screen.getByRole("combobox", { name: "Event" }).focus();
  await user.keyboard("{ArrowDown}");
  await user.click(screen.getByRole("option", { name: /Women in Tech/ }));
  expect(send.disabled).toBe(false);
  expect(mocks.send).not.toHaveBeenCalled();
  await user.click(send);
  expect(mocks.send).toHaveBeenCalledExactlyOnceWith("event-1");
});

it("shows event thumbnails, venue, participant navigation and delivery outcomes in the overview", () => {
  mocks.report.mockReturnValue({ data: { logs: [], report: {
    totals: { sent: 3, failed: 1, sentLast7d: 3, byKind: { TICKET: { sent: 3, failed: 1 } } },
    upcoming: { ticketQueued: 1, confirmationQueued: 2, awaitingTicketEmail: 1, reminderPool: 4, total: 4 },
    funnel: {
      overall: { started: 4, neverVerified: 2, verifiedNotCompleted: 1, completed: 1, abandoned: 3, completionRate: 25 },
      perEvent: [{ eventId: "event-1", eventName: "Women in Tech", startTime: "2099-01-01", location: "Kigali", gallery: ["/event-poster.jpg"], started: 4, neverVerified: 2, verifiedNotCompleted: 1, completed: 1 }],
    },
  } } });
  render(<EmailsPage />);
  expect(screen.getByAltText("Women in Tech artwork").getAttribute("src")).toBe("/event-poster.jpg");
  expect(screen.getByRole("link", { name: "View participants for Women in Tech" }).getAttribute("href")).toBe("/admin/attendees?event=event-1");
  expect(screen.getByText(/Venue|Kigali/)).toBeTruthy();
  expect(screen.getByText("Successful send attempts")).toBeTruthy();
  expect(screen.getAllByText("75%")).toHaveLength(2);
});
