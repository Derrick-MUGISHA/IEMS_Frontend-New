// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/client", () => ({ api: mocks.api, ApiError: class extends Error {} }));
vi.mock("@/lib/sendParticipantInvitations", () => ({ sendParticipantInvitations: mocks.send }));
vi.mock("@/components/admin/EventPicker", () => ({ EventPicker: ({ onValueChange }: { onValueChange: (id: string) => void }) => <button onClick={() => onValueChange("event-id")}>Choose graduation</button> }));
vi.mock("@/components/admin/DataTable", () => ({ DataTable: ({ data }: { data: unknown[] }) => <p>{data.length} preview rows</p> }));
import ImportParticipantsPage from "@/app/admin/(panel)/attendees/import/page";
afterEach(cleanup);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.api.mockResolvedValue({ imported: 1, skipped: 0, received: 1, participantIds: ["new-person"] });
  mocks.send.mockResolvedValue({ sent: ["new-person"], failed: [] });
});

async function importOne(source = "name,email\nAline Uwase,aline@example.com", rowCount = 1) {
  const user = userEvent.setup();
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ImportParticipantsPage /></QueryClientProvider>);
  await user.click(screen.getByRole("button", { name: "Choose graduation" }));
  await user.click(screen.getByRole("tab", { name: "Paste rows" }));
  await user.type(screen.getByLabelText("Participant rows"), source);
  await user.click(screen.getByRole("button", { name: `Import ${rowCount} participants` }));
  return user;
}

it("automatically sends invitations after import and shows the confirmed result", async () => {
  await importOne();
  await waitFor(() => expect(mocks.send).toHaveBeenCalledWith(["new-person"], expect.anything()));
  expect(await screen.findByText(/Invitation emails: 1 sent · 0 failed/)).toBeTruthy();
  expect(await screen.findByText("Import complete")).toBeTruthy();
});

it("allows retrying failed delivery without importing the participant again", async () => {
  mocks.send.mockResolvedValueOnce({ sent: [], failed: [{ id: "new-person", error: "SMTP unavailable" }] }).mockResolvedValueOnce({ sent: ["new-person"], failed: [] });
  const user = await importOne();
  await user.click(await screen.findByRole("button", { name: "Retry failed invitations" }));
  expect(await screen.findByText(/Invitation emails: 1 sent · 0 failed/)).toBeTruthy();
  expect(mocks.api).toHaveBeenCalledOnce();
  expect(mocks.send).toHaveBeenCalledTimes(2);
});

it("does not automatically resend invitations for skipped duplicate registrations", async () => {
  mocks.api.mockResolvedValue({ imported: 0, skipped: 1, received: 1, participantIds: [] });
  await importOne();
  expect(await screen.findByText("Import complete")).toBeTruthy();
  expect(mocks.send).not.toHaveBeenCalled();
});

it("sends invitations only to newly added people from a pasted spreadsheet list", async () => {
  mocks.api.mockResolvedValue({ imported: 2, skipped: 1, received: 3, participantIds: ["new-one", "new-two"] });
  mocks.send.mockResolvedValue({ sent: ["new-one", "new-two"], failed: [] });
  await importOne("name\temail\nAline Uwase\taline@example.com\nDiane Uwase\tdiane@example.com\nExisting Person\texisting@example.com", 3);
  expect(await screen.findByText("Import complete")).toBeTruthy();
  expect(mocks.send).toHaveBeenCalledWith(["new-one", "new-two"], expect.anything());
  expect(mocks.api.mock.calls[0][1].body.participants).toHaveLength(3);
});
