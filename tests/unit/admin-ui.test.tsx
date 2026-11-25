// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EventImage } from "@/components/admin/EventImage";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { DataTable } from "@/components/admin/DataTable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

afterEach(cleanup);

describe("event artwork", () => {
  it("tries the next event image after a failed URL and shows a named fallback", () => {
    render(<EventImage images={["/bad.jpg", "/good.jpg"]} name="Conference" />);
    expect(screen.getByAltText("Conference artwork").getAttribute("src")).toBe("/bad.jpg");
    fireEvent.error(screen.getByAltText("Conference artwork"));
    expect(screen.getByAltText("Conference artwork").getAttribute("src")).toBe("/good.jpg");
    fireEvent.error(screen.getByAltText("Conference artwork"));
    expect(screen.getByText("No artwork available for Conference")).toBeTruthy();
  });
});

describe("confirmation popup", () => {
  it("opens by keyboard, cancels without running the action and returns focus", async () => {
    const user = userEvent.setup(); const confirm = vi.fn();
    render(<ConfirmDialog title="Revoke ticket?" trigger={<Button>Revoke</Button>} onConfirm={confirm} />);
    const trigger = screen.getByRole("button", { name: "Revoke" });
    trigger.focus(); await user.keyboard("{Enter}");
    expect(screen.getByRole("alertdialog", { name: "Revoke ticket?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(confirm).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger);
  });
  it("opens a confirmation from a ticket action menu without turning the item into another button", async () => {
    const user = userEvent.setup(); const confirm = vi.fn();
    render(<DropdownMenu><DropdownMenuTrigger asChild><Button>Ticket actions</Button></DropdownMenuTrigger><DropdownMenuContent>
      <ConfirmDialog title="Revoke selected ticket?" trigger={<DropdownMenuItem onSelect={(event) => event.preventDefault()}>Revoke ticket</DropdownMenuItem>} onConfirm={confirm} />
    </DropdownMenuContent></DropdownMenu>);
    screen.getByRole("button", { name: "Ticket actions" }).focus();
    await user.keyboard("{Enter}");
    const item = await screen.findByRole("menuitem", { name: "Revoke ticket" });
    expect(item.dataset.slot).toBe("confirmation-trigger");
    item.focus(); await user.keyboard("{Enter}");
    expect(screen.getByRole("alertdialog", { name: "Revoke selected ticket?" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(confirm).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(item));
  });
  it("runs the selected action once and keeps the popup open when it fails", async () => {
    const user = userEvent.setup(); const confirm = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    render(<ConfirmDialog title="Reset ticket?" confirmLabel="Reset ticket" trigger={<Button>Reset</Button>} onConfirm={confirm} />);
    await user.click(screen.getByRole("button", { name: "Reset" }));
    await user.click(screen.getByRole("button", { name: "Reset ticket" }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Reset ticket" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(confirm).toHaveBeenCalledTimes(2);
  });
});

describe("table navigation", () => {
  it("pages, searches, clears search and exports selected rows only", async () => {
    const user = userEvent.setup(); const selected = vi.fn();
    render(<DataTable data={[{ id: "1", name: "Aline" }, { id: "2", name: "Marie" }]} getRowId={(row) => row.id} pageSize={1} searchable={(row) => row.name} columns={[{ id: "name", header: "Name", cell: (row) => row.name }]} selectionActions={(rows) => <button onClick={() => selected(rows)}>Export selected</button>} />);
    await user.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Marie")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "Select row 2" }));
    await user.click(screen.getByRole("button", { name: "Export selected" }));
    expect(selected).toHaveBeenCalledWith([{ id: "2", name: "Marie" }]);
    await user.type(screen.getByRole("textbox"), "Aline");
    expect(screen.getByText("Aline")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Page 1 of 2")).toBeTruthy();
  });
});
