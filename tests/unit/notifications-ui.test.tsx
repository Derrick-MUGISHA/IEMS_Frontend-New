// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ feed: vi.fn(), markRead: vi.fn() }));
vi.mock("@/hooks/admin/dashboard", () => ({
  useNotifications: () => mocks.feed(),
  useMarkNotificationsRead: () => ({ mutate: mocks.markRead, isPending: false }),
}));
import NotificationBell from "@/components/admin/NotificationBell";
import NotificationsPage from "@/app/admin/(panel)/notifications/page";
const items = Array.from({ length: 6 }, (_, index) => ({ id: `notice-${index}`, kind: "SCAN_ALERT", severity: "warning", title: `Expired ticket ${index + 1}`, body: `The ticket for guest ${index + 1} expired when their event ended. Contact the event organiser for details.`, read: index >= 3, at: "2026-11-16T10:53:54Z" }));
beforeEach(() => {
  mocks.feed.mockReturnValue({ data: { notifications: items, unread: 3 }, isPending: false });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });
describe("header notification dropdown", () => {
  it("opens from the bell by keyboard, shows the count and recent items, and links to all notifications", async () => {
    const user = userEvent.setup();
    render(<NotificationBell />);
    const trigger = screen.getByRole("button", { name: "Notifications, 3 unread" });
    expect(within(trigger).getByText("3")).toBeTruthy();
    trigger.focus(); await user.keyboard("{Enter}");
    const popup = screen.getByRole("dialog", { name: "Recent notifications" });
    expect(within(popup).getByText("Expired ticket 1")).toBeTruthy();
    expect(within(popup).queryByText("Expired ticket 6")).toBeNull();
    expect(within(popup).getByRole("link", { name: "View more" }).getAttribute("href")).toBe("/admin/notifications");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it("marks notifications read only when requested", async () => {
    const user = userEvent.setup(); render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Notifications, 3 unread" }));
    expect(mocks.markRead).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Mark all read" }));
    expect(mocks.markRead).toHaveBeenCalledExactlyOnceWith(undefined);
  });
});
it("opens notification details below the row without a modal and marks only that item read", async () => {
  const user = userEvent.setup(); render(<NotificationsPage />);
  const trigger = screen.getByRole("button", { name: /Expired ticket 1/ });
  expect(trigger.getAttribute("data-slot")).toBe("notification-row-trigger");
  trigger.focus(); await user.keyboard("{Enter}");
  const popup = screen.getByRole("dialog", { name: "Expired ticket 1" });
  expect(within(popup).getByText(items[0].body)).toBeTruthy();
  expect(popup.getAttribute("data-side")).toBe("bottom");
  expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeNull();
  expect(mocks.markRead).toHaveBeenCalledExactlyOnceWith(["notice-0"]);
  await user.click(within(popup).getByRole("button", { name: "Close notification details" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(document.activeElement).toBe(trigger);
});
