// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { createAgent } from "@ui-sdk/react/agent";
import { EventPicker } from "@/components/admin/EventPicker";
import { SearchSelect } from "@/components/admin/SearchSelect";
import { ActionMenu } from "@/components/admin/ActionMenu";
import { TicketArtwork } from "@/components/admin/TicketArtwork";
vi.mock("@/hooks/admin/events", () => ({ useEvents: () => ({ data: [{ id: "conference", name: "Conference", location: "Kigali", status: "OPEN", gallery: [] }], isPending: false }) }));
HTMLElement.prototype.showPopover = function () {};
HTMLElement.prototype.hidePopover = function () {};
Element.prototype.getAnimations = () => [];
Element.prototype.scrollIntoView = function () {};
Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = function () {};
Element.prototype.releasePointerCapture = function () {};
Element.prototype.checkVisibility = () => true;
Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
document.elementFromPoint = () => null;
document.elementsFromPoint = () => [];
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
document.head.append(Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" }));
afterEach(cleanup);
const agent = createAgent();
it("lets an agent find and select an event using library controls", async () => {
  const change = vi.fn();
  render(<SearchSelect label="Event" value="" onChange={change} options={[{ value: "conference", label: "Conference", description: "Kigali" }, { value: "workshop", label: "Workshop" }]} />);
  const entries = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  expect(entries.map((entry) => entry.label)).toContain("Event");
  for (const entry of entries) expect(entry.label).toBeTruthy();
  let result: Awaited<ReturnType<typeof agent.act>>;
  await act(async () => { result = await agent.act({ steps: [{ ref: "Event", action: "setValue", args: ["Conference"] }] }); });
  expect(result!.ok, result!.error?.message).toBe(true);
  expect(change).toHaveBeenCalledWith("conference");
});
it("opens the library action menu and confirms a destructive action", async () => {
  const run = vi.fn().mockResolvedValue(undefined); const user = userEvent.setup();
  render(<ActionMenu actions={[{ label: "Delete participant", icon: <span />, run, confirm: { title: "Delete participant?", description: "Removes this record", destructive: true } }]} />);
  await user.click(screen.getByRole("button", { name: "Actions" }));
  await user.click(await screen.findByRole("menuitem", { name: "Delete participant" }));
  expect(run).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Delete participant" }));
  await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Actions" })));
});
it("renders the ticket directly with its real QR and no PDF frame", () => {
  const { container } = render(<TicketArtwork ticket={{ name: "Aline", eventName: "Conference", number: "IRO-42", qr: "data:image/png;base64,c2lnbmVk", images: ["/event.jpg"], status: "VALID" }} />);
  expect(screen.getByText("IRO-42")).toBeTruthy();
  expect(screen.getByAltText("Signed ticket entry QR").getAttribute("src")).toBe("data:image/png;base64,c2lnbmVk");
  expect(container.querySelector("iframe")).toBeNull();
  expect(container.querySelector(".ticket-artwork-bg")).toBeTruthy();
});
it("clearly marks an event design sample as unusable for entry", () => {
  render(<TicketArtwork ticket={{ name: "Attendee name", eventName: "Conference" }} />);
  expect(screen.queryByAltText("Signed ticket entry QR")).toBeNull();
  expect(screen.getByText("Sample layout only. This preview cannot be used for entry.")).toBeTruthy();
});

it("makes the event field selection-only and opens from the whole trigger", async () => {
  const change = vi.fn(); const user = userEvent.setup();
  render(<EventPicker value="all" onValueChange={change} includeAll />);
  expect(screen.queryByRole("textbox")).toBeNull();
  await user.click(screen.getByRole("combobox", { name: "Event" }));
  await user.click(await screen.findByRole("option", { name: /Conference/ }));
  expect(change).toHaveBeenCalledWith("conference");
});
