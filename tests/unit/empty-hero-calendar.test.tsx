// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.mock("@/components/HeroCanvas", () => ({ default: () => null }));
vi.mock("gsap", () => ({ default: { context: () => ({ revert() {} }) } }));
vi.mock("@/lib/useEvents", () => ({ useEvents: () => ({ data: [], isPending: false, isError: false }) }));
vi.mock("@/components/EventFlow", () => ({ useEventFlow: () => ({ openEvent: vi.fn() }) }));
import Hero, { EmptyHeroCalendar } from "@/components/Hero";

beforeEach(() => vi.stubGlobal("matchMedia", () => ({ matches: true })));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("shows a large month calendar instead of the empty-event pill", () => {
  render(<Hero />);
  expect(screen.getByRole("grid")).toBeTruthy();
  expect(screen.getAllByRole("columnheader")).toHaveLength(7);
  expect(screen.getByText("No upcoming events yet. New dates will appear here.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "View full calendar" }).getAttribute("href")).toBe("#calendar");
  expect(screen.queryByText("Nothing coming up yet — see the full calendar")).toBeNull();
});
it("lets visitors inspect another month and return without selecting an event", () => {
  render(<EmptyHeroCalendar />);
  const month = screen.getByRole("grid").getAttribute("aria-label");
  fireEvent.click(screen.getByRole("button", { name: /next month/i }));
  expect(screen.getByRole("grid").getAttribute("aria-label")).not.toBe(month);
  fireEvent.click(screen.getByRole("button", { name: /previous month/i }));
  expect(screen.getByRole("grid").getAttribute("aria-label")).toBe(month);
  expect(screen.getByRole("grid").getAttribute("aria-readonly")).toBe("true");
});
