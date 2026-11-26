// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ pathname: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: mocks.pathname }));
vi.mock("@/context/AuthContext", () => ({ useAdminAuth: () => ({ user: { name: "Admin" }, logout: { mutate: vi.fn() } }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
import { AppSidebar } from "@/components/admin/AppSidebar";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";

afterEach(cleanup);
describe("admin navigation", () => {
  it.each([
    ["/admin/attendees/123/edit", "Participants"],
    ["/admin/status", "API status"],
    ["/admin/api-docs", "API docs"],
  ])("identifies exactly one current section on %s", (pathname, name) => {
    mocks.pathname.mockReturnValue(pathname);
    render(<TooltipProvider><SidebarProvider><AppSidebar /></SidebarProvider></TooltipProvider>);
    expect(screen.getByRole("link", { name, current: "page" })).toBeTruthy();
    expect(screen.getAllByRole("link", { current: "page" })).toHaveLength(1);
    for (const label of ["Manage", "Operations", "Resources"]) expect(screen.getByText(label)).toBeTruthy();
    expect(screen.getByRole("link", { name: "New event" }).getAttribute("href")).toBe("/admin/events/new");
  });
});
