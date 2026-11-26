// @vitest-environment jsdom
import React, { useState } from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, beforeAll, expect, it } from "vitest";
import { Select } from "@/components/portal/ui";

beforeAll(() => {
  HTMLElement.prototype.showPopover = function () {};
  HTMLElement.prototype.hidePopover = function () {};
  Element.prototype.getAnimations = () => [];
  Element.prototype.scrollIntoView = function () {};
  Element.prototype.checkVisibility = () => true;
  Element.prototype.getClientRects = () => [] as unknown as DOMRectList;
  document.elementFromPoint = () => null;
  document.elementsFromPoint = () => [];
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  document.head.append(
    Object.assign(document.createElement("style"), { textContent: "[popover] { display: block !important }" })
  );
});

const agent = createAgent();
afterEach(cleanup);

type Gender = "FEMALE" | "MALE" | "OTHER";
const GENDERS: [Gender, string][] = [
  ["FEMALE", "Female"],
  ["MALE", "Male"],
  ["OTHER", "Other / prefer not to say"],
];

function Form({ onPick }: { onPick: (g: Gender) => void }) {
  const [gender, setGender] = useState<Gender | "">("");
  return (
    <Select
      label="Gender"
      required
      value={gender}
      onValueChange={(g) => {
        setGender(g);
        onPick(g);
      }}
      options={GENDERS}
    />
  );
}

it("shows a placeholder, then the chosen option, picked with the pointer", async () => {
  const picks: Gender[] = [];
  render(<Form onPick={(g) => picks.push(g)} />);
  const trigger = screen.getByRole("combobox", { name: "Gender" });
  expect(trigger.textContent).toContain("Select…");
  const user = userEvent.setup();
  await user.click(trigger);
  await user.click(screen.getByRole("option", { name: "Male" }));
  expect(picks).toEqual(["MALE"]);
  expect(trigger.textContent).toContain("Male");
});

it("is named and can be set by an agent", async () => {
  const picks: Gender[] = [];
  render(<Form onPick={(g) => picks.push(g)} />);
  const controls = agent.snapshot().filter((e) => !e.offPage && e.component !== "more");
  for (const entry of controls) expect(entry.label, `${entry.component} has no name`).toBeTruthy();
  expect(controls.map((e) => e.label)).toContain("Gender");
  let result: Awaited<ReturnType<typeof agent.act>>;
  await act(async () => {
    result = await agent.act({ steps: [{ ref: "Gender", action: "setValue", args: ["Female"] }] });
  });
  expect(result!.ok, result!.error?.message).toBe(true);
  expect(picks).toEqual(["FEMALE"]);
});
