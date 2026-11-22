// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EventForm } from "@/components/admin/EventForm";

vi.mock("@/components/admin/ImageUploader", () => ({ ImageUploader: () => <div>Artwork uploader</div> }));
vi.mock("@/components/admin/RichTextEditor", () => ({ RichTextEditor: () => <div>Event description editor</div> }));

beforeAll(() => {
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
});
afterEach(cleanup);
afterAll(() => vi.unstubAllGlobals());
const defaults = {
  name: "Graduation", slug: "graduation", category: "Mentorship" as const,
  type: "WORKSHOP" as const, startTime: "2027-11-21T13:00", endTime: "2027-11-21T16:00",
  location: "Kigali", gallery: [], rules: [], status: "OPEN" as const,
};

describe.each(["create", "edit"] as const)("%s event form", (mode) => {
  const saveLabel = mode === "create" ? "Create event" : "Save changes";

  it("reaches review without saving and saves only after the final action", async () => {
    const user = userEvent.setup(); const save = vi.fn();
    render(<EventForm mode={mode} defaultValues={defaults} onSubmit={save} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("button", { name: saveLabel });
    expect(screen.getByText("Step 3 of 3")).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Add rule" }));
    const rule = screen.getByPlaceholderText("e.g. Bring a valid ID");
    await user.type(rule, "Bring an ID{Enter}");
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: saveLabel }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    expect(save.mock.calls[0][0]).toMatchObject({ name: "Graduation", rules: ["Bring an ID"] });
  });

  it("ignores implicit form submission and duplicate saves while a request is running", async () => {
    const user = userEvent.setup();
    let finish!: () => void;
    const save = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { container } = render(<EventForm mode={mode} defaultValues={defaults} onSubmit={save} />);
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await act(async () => { fireEvent.submit(container.querySelector("form")!); });
    expect(save).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: saveLabel }));
    await waitFor(() => expect(save).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: /Saving|Create event|Save changes/ }));
    expect(save).toHaveBeenCalledOnce();
    await act(async () => { finish(); });
  });
});
