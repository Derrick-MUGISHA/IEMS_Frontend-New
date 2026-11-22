// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/client", () => ({ api: mocks.api, ApiError: Error }));
import { ImageUploader } from "@/components/admin/ImageUploader";
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it("uploads two files at a time, preserves order and keeps successes when one fails", async () => {
  const pending: { resolve: (value: { url: string }) => void; reject: (error: Error) => void }[] = [];
  mocks.api.mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
  const change = vi.fn(); const { container } = render(<ImageUploader value={["existing"]} onChange={change} />);
  const files = ["first", "second", "third"].map((name) => new File(["image"], `${name}.png`, { type: "image/png" }));
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files } });
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(2));
  expect(screen.getByRole("button", { name: "Upload images" }).getAttribute("disabled")).not.toBeNull();
  await act(async () => pending[1].resolve({ url: "second-url" }));
  await waitFor(() => expect(mocks.api).toHaveBeenCalledTimes(3));
  await act(async () => { pending[2].resolve({ url: "third-url" }); pending[0].reject(new Error("Connection lost")); });
  await waitFor(() => expect(change).toHaveBeenCalledExactlyOnceWith(["existing", "second-url", "third-url"]));
  expect(screen.getByRole("alert").textContent).toContain("first.png"); expect(screen.getByRole("alert").textContent).toContain("Connection lost");
});
it("opens file selection from the keyboard using the SDK button", async () => {
  const user = userEvent.setup(); const { container } = render(<ImageUploader value={[]} onChange={vi.fn()} />);
  const click = vi.spyOn(container.querySelector<HTMLInputElement>('input[type="file"]')!, "click");
  screen.getByRole("button", { name: "Upload images" }).focus(); await user.keyboard("{Enter}");
  expect(click).toHaveBeenCalledOnce(); expect(mocks.api).not.toHaveBeenCalled();
});
