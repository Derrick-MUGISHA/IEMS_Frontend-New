// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ blob: vi.fn() }));
vi.mock("@/lib/client", () => ({ apiBlob: mocks.blob }));
import { TicketPdf } from "@/components/portal/TicketPdf";
const preview = { name: "Aline", eventName: "Graduation", number: "IRO-42", qr: "data:image/png;base64,qr", status: "VALID" };
const clients: QueryClient[] = [];
const create = () => { const client = new QueryClient({ defaultOptions: { queries: { retry: false } } }); clients.push(client); return client; };
beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:ticket"); URL.revokeObjectURL = vi.fn();
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });
it("shows the signed ticket immediately without waiting for PDF generation", async () => {
  let finish!: (blob: Blob) => void;
  mocks.blob.mockImplementation(() => new Promise<Blob>((resolve) => { finish = resolve; }));
  render(<QueryClientProvider client={create()}><TicketPdf src="/ticket/pdf" preview={preview} /></QueryClientProvider>);
  expect(screen.getByText("Graduation")).toBeTruthy(); expect(screen.getByAltText("Signed ticket entry QR")).toBeTruthy();
  expect(screen.queryByTitle("Event ticket")).toBeNull();
  await act(async () => { finish(new Blob(["pdf"], { type: "application/pdf" })); });
  expect(await screen.findByRole("link", { name: "Download ticket" })).toBeTruthy();
});
it("keeps the ticket visible and offers retry when PDF preparation fails", async () => {
  mocks.blob.mockRejectedValue(new Error("PDF unavailable"));
  render(<QueryClientProvider client={create()}><TicketPdf src="/ticket/pdf" preview={preview} /></QueryClientProvider>);
  expect(await screen.findByRole("button", { name: "Retry PDF" })).toBeTruthy();
  expect(screen.getByAltText("Signed ticket entry QR")).toBeTruthy();
});
it("reuses a prepared PDF on a return visit and refreshes it when its revision changes", async () => {
  mocks.blob.mockResolvedValue(new Blob(["pdf"])); const client = create();
  const view = render(<QueryClientProvider client={client}><TicketPdf src="/ticket/pdf" preview={preview} revision="one" /></QueryClientProvider>);
  await screen.findByRole("link", { name: "Download ticket" }); view.unmount();
  const second = render(<QueryClientProvider client={client}><TicketPdf src="/ticket/pdf" preview={preview} revision="one" /></QueryClientProvider>);
  await screen.findByRole("link", { name: "Download ticket" }); expect(mocks.blob).toHaveBeenCalledOnce();
  second.rerender(<QueryClientProvider client={client}><TicketPdf src="/ticket/pdf" preview={preview} revision="two" /></QueryClientProvider>);
  await waitFor(() => expect(mocks.blob).toHaveBeenCalledTimes(2));
});
