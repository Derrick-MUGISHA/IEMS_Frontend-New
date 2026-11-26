// @vitest-environment jsdom
import React from "react";
import Link from "next/link";
import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAgent } from "@ui-sdk/react/agent";
import { afterEach, expect, it, vi } from "vitest";
import { Button } from "@/components/portal/ui";

const agent = createAgent();
afterEach(cleanup);

it("exposes named SDK actions, preserves links, and submits only the explicit submit button", async () => {
  const press = vi.fn(); const submit = vi.fn((event) => event.preventDefault());
  render(<form onSubmit={submit}>
    <Button onClick={press}>Show details</Button>
    <Button type="submit">Complete registration</Button>
    <Button render={<Link href="/verify" />}>Request a new link</Button>
  </form>);
  const controls = agent.snapshot().filter((entry) => !entry.offPage && entry.component !== "more");
  expect(controls.map((entry) => entry.label)).toEqual(expect.arrayContaining(["Show details", "Complete registration", "Request a new link"]));
  for (const entry of controls) expect(entry.label).toBeTruthy();
  let result: Awaited<ReturnType<typeof agent.act>>;
  await act(async () => { result = await agent.act({ steps: [{ ref: "Show details", action: "press" }] }); });
  expect(result!.ok, result!.error?.message).toBe(true);
  expect(press).toHaveBeenCalledOnce(); expect(submit).not.toHaveBeenCalled();
  const user = userEvent.setup();
  screen.getByRole("button", { name: "Complete registration" }).focus();
  await user.keyboard("{Enter}");
  expect(submit).toHaveBeenCalledOnce();
  expect(screen.getByRole("link", { name: "Request a new link" }).getAttribute("href")).toBe("/verify");
  expect(screen.getByRole("link", { name: "Request a new link" }).querySelector("button")).toBeNull();
});

it("blocks duplicate presses while an asynchronous action is pending", async () => {
  let finish!: () => void;
  const action = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<Button onClick={action}>Send invitation</Button>);
  const user = userEvent.setup();
  const button = screen.getByRole("button", { name: "Send invitation" });
  await user.click(button);
  expect(button.getAttribute("aria-busy")).toBe("true");
  await user.click(button);
  await user.keyboard("{Enter}");
  expect(action).toHaveBeenCalledOnce();
  await act(async () => { finish(); });
  expect(button.getAttribute("aria-busy")).not.toBe("true");
});

it("does not run a disabled or externally busy action", async () => {
  const action = vi.fn(); const user = userEvent.setup();
  render(<Button busy onClick={action}>Upload photo</Button>);
  const button = screen.getByRole("button", { name: "Upload photo" });
  await user.click(button);
  expect(action).not.toHaveBeenCalled();
});
