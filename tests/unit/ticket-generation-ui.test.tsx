// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/hooks/admin/participants", () => ({ useParticipants: () => ({ data: [], isPending: false }) }));
vi.mock("@/hooks/admin/guests", () => ({ useGuests: () => ({ data: [], isPending: false }) }));
vi.mock("@/hooks/admin/tickets", () => ({ useGenerateTicket: () => ({ mutateAsync: vi.fn(), isPending: false }) }));
import GenerateTicketPage from "@/app/admin/(panel)/tickets/new/page";
afterEach(cleanup);
it("switches the recipient tabs and keeps generation disabled until a recipient is selected", async () => {
  const user = userEvent.setup();
  render(<GenerateTicketPage />);
  const participant = screen.getByRole("tab", { name: "Participant" });
  const guest = screen.getByRole("tab", { name: "Guest" });
  expect(participant.getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("combobox", { name: "Participant" })).toBeTruthy();
  await user.click(guest);
  expect(guest.getAttribute("aria-selected")).toBe("true");
  expect(participant.getAttribute("aria-selected")).toBe("false");
  expect(screen.getByRole("combobox", { name: "Guest" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Participant" })).toBeNull();
  expect((screen.getByRole("button", { name: "Generate and email ticket" }) as HTMLButtonElement).disabled).toBe(true);
  participant.focus();
  await user.keyboard("{Enter}");
  expect(participant.getAttribute("aria-selected")).toBe("true");
});
