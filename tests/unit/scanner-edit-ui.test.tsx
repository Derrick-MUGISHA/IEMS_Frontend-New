// @vitest-environment jsdom
import React, { Suspense } from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ save: vi.fn(), push: vi.fn() }));
const scanner = { id: "scanner-1", name: "Gate scanner", email: "gate@example.com", active: true };
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/hooks/admin/scanners", () => ({
  useScanner: () => ({ data: scanner, isPending: false }),
  useUpdateScanner: () => ({ mutateAsync: mocks.save, isPending: false }),
}));
import EditScannerPage from "@/app/admin/(panel)/scanners/[id]/edit/page";
beforeEach(() => {
  mocks.save.mockResolvedValue({});
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn(); });
});
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });
async function showForm() {
  const params = Promise.resolve({ id: "scanner-1" });
  await act(async () => { render(<Suspense fallback="Loading"><EditScannerPage params={params} /></Suspense>); });
  await screen.findByRole("textbox", { name: "Name" });
}
it("shows the scanner identity and saves an access change without resetting a blank password", async () => {
  const user = userEvent.setup(); await showForm();
  expect(screen.getByText("gate@example.com")).toBeTruthy();
  const toggle = screen.getByRole("switch", { name: "Active" });
  toggle.focus(); await user.keyboard(" ");
  expect(toggle.getAttribute("aria-checked")).toBe("false");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledExactlyOnceWith({ id: "scanner-1", body: { name: "Gate scanner", active: false, password: undefined } }));
  expect(mocks.push).toHaveBeenCalledWith("/admin/scanners");
});
it("preserves the form when saving fails", async () => {
  mocks.save.mockRejectedValue(new Error("offline"));
  const user = userEvent.setup(); await showForm();
  const name = screen.getByRole("textbox", { name: "Name" });
  await user.clear(name); await user.type(name, "North gate");
  await user.click(screen.getByRole("button", { name: "Save changes" }));
  await waitFor(() => expect(mocks.save).toHaveBeenCalledOnce());
  expect(mocks.push).not.toHaveBeenCalled();
  expect((name as HTMLInputElement).value).toBe("North gate");
});
