// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ push: vi.fn(), open: vi.fn(), pending: false }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "graduation" }), useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/components/Nav", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));
vi.mock("@/components/HeroCanvas", () => ({ default: () => null }));
vi.mock("gsap", () => ({ default: { context: () => ({ revert() {} }) } }));
vi.mock("@/lib/useEvents", () => ({ useEvents: () => ({ data: [event], isPending: mocks.pending, isError: false }) }));
import { EventFlowProvider, useEventFlow } from "@/components/EventFlow";
import Hero from "@/components/Hero";
import EventPage from "@/app/events/[id]/page";
const event = { id: "graduation", title: "Graduation", posterUrl: "https://res.cloudinary.com/test/poster.webp", category: "SheCanCODE", date: "2030-11-27", startsAt: "2030-11-27T11:00:00Z", endsAt: null, time: "1:00 PM", endTime: "", organiser: "Igire Rwanda", space: "Kigali", description: "Join the graduation.", rules: ["Bring your ticket."], status: "OPEN", price: "Free", gallery: [] } as const;
function OpenTerms() {
  const { openEvent } = useEventFlow();
  return <button onClick={() => openEvent(event as never)}>View graduation</button>;
}
beforeEach(() => { mocks.pending = false; vi.stubGlobal("matchMedia", () => ({ matches: true })); });
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
it("keeps the complete homepage poster centered with decorative reflection layers", () => {
  render(<EventFlowProvider><Hero /></EventFlowProvider>);
  const poster = screen.getByAltText("Graduation poster");
  expect(poster.className).toContain("featured-event-image");
  expect(poster.className).not.toContain("object-cover");
  const card = poster.closest("button")!;
  expect(card.className).toContain("max-w-md");
  expect(card.querySelector('.event-poster-reflection[aria-hidden="true"]')).toBeTruthy();
  expect(screen.getByRole("button", { name: /Graduation poster/ })).toBeTruthy();
});
it("keeps terms acceptance working with a centered poster and no orange top strip", () => {
  const { container } = render(<EventFlowProvider><OpenTerms /></EventFlowProvider>);
  fireEvent.click(screen.getByRole("button", { name: "View graduation" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.querySelector(':scope > [class*="h-1.5"][class*="w-full"][class*="bg-orange"]')).toBeNull();
  expect(screen.getByAltText("Graduation poster").className).toBe("featured-event-image");
  fireEvent.click(screen.getByRole("button", { name: "Agree & continue" }));
  expect(mocks.push).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(screen.getByRole("button", { name: "Agree & continue" }));
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/events/graduation");
  expect(container.textContent).not.toContain("eslint-disable-next-line");
});
it("places the event artwork in a wider sticky column without a scrolling ancestor", () => {
  const { container } = render(<EventPage />);
  expect(screen.getByRole("heading", { name: "Graduation", level: 1 })).toBeTruthy();
  const poster = screen.getByAltText("Graduation poster");
  expect(poster.className).toBe("event-poster-image");
  expect(poster.closest(".event-poster-column")).toBeTruthy();
  expect(poster.closest("main")!.className).not.toContain("overflow-hidden");
  expect(container.querySelector('.event-atmosphere[aria-hidden="true"] img')).toBeTruthy();
  expect(screen.getByRole("link", { name: "Continue to get your ticket" }).getAttribute("href")).toBe("/verify?event=graduation");
});
