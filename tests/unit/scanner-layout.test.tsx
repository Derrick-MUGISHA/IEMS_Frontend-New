// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/client", () => ({ api: mocks.api }));
vi.mock("@/lib/liveStream", () => ({ subscribeLive: () => () => {} }));
import Scanner from "@/components/portal/Scanner";
let client: QueryClient;
afterEach(() => { cleanup(); client?.clear(); vi.resetAllMocks(); });
it("keeps manual validation usable when camera access fails and never admits a ticket by lookup", async () => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  mocks.api.mockResolvedValue({ valid: true, ticket: { ticketNumber: "IRO-42", holderName: "Aline", eventName: "Graduation" } });
  render(<QueryClientProvider client={client}><Scanner role="scanner" profile={{ name: "North gate", email: "gate@example.com" }} /></QueryClientProvider>);
  expect(screen.getByText("North gate")).toBeTruthy();
  expect(screen.getByText("Ready for check-in")).toBeTruthy();
  expect(screen.getByText("No scans yet. Activity from all gates will appear here.")).toBeTruthy();
  await screen.findByText(/Camera access is blocked/);
  fireEvent.change(screen.getByRole("textbox", { name: "Ticket number or code" }), { target: { value: "IRO-000042" } });
  fireEvent.click(screen.getByRole("button", { name: "Check ticket" }));
  expect(await screen.findByText("Valid · not checked in")).toBeTruthy();
  expect(mocks.api).toHaveBeenCalledExactlyOnceWith("/api/tickets/validate", { role: "scanner", body: { code: "IRO-000042" } });
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  expect(screen.getByRole("button", { name: "Start scanning" })).toBeTruthy();
});
