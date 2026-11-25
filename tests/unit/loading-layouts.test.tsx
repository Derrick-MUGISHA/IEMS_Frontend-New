// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { DataTable } from "@/components/admin/DataTable";
import { TicketSkeleton } from "@/components/portal/TicketPdf";
import { AdminDetailSkeleton, AdminFormSkeleton, EmailTemplatesSkeleton } from "@/components/admin/PageSkeletons";
afterEach(cleanup);
it("keeps table columns, search, filters and pagination in the same containers while loading", () => {
  const props = {
    columns: [{ id: "name", header: "Participant", cell: (p: { id: string; name: string }) => p.name }, { id: "email", header: "Email", cell: () => "aline@example.com" }],
    getRowId: (p: { id: string; name: string }) => p.id,
    searchable: (p: { id: string; name: string }) => p.name,
    toolbar: <button>Filter event</button>,
  };
  const view = render(<DataTable {...props} data={[]} loading />);
  const tableClass = screen.getByRole("table").parentElement!.className;
  expect(screen.getAllByRole("columnheader").map((el) => el.textContent)).toEqual(["Participant", "Email"]);
  expect(screen.getByRole("button", { name: "Filter event" })).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Search…" })).toBeTruthy();
  expect(screen.queryByText("No matching records")).toBeNull();
  view.rerender(<DataTable {...props} data={[{ id: "1", name: "Aline" }]} />);
  expect(screen.getByRole("table").parentElement!.className).toBe(tableClass);
  expect(screen.getAllByRole("columnheader").map((el) => el.textContent)).toEqual(["Participant", "Email"]);
  expect(screen.getByText("Aline")).toBeTruthy();
});
it("uses the ticket artwork's own aspect ratio and grid in the ticket skeleton", () => {
  const { container } = render(<TicketSkeleton />);
  expect(screen.getByRole("status", { name: "Loading your ticket" })).toBeTruthy();
  for (const name of ["ticket-artwork", "ticket-artwork-top", "ticket-artwork-meta", "ticket-artwork-bottom"]) expect(container.querySelector(`.${name}`)).toBeTruthy();
  expect(container.querySelectorAll(".ticket-artwork")).toHaveLength(1);
});
it.each(["participant", "guest", "event", "ticket"] as const)("uses a page layout instead of a table for a %s detail skeleton", (kind) => {
  const { container } = render(<AdminDetailSkeleton kind={kind} />);
  expect(container.querySelector("table")).toBeNull();
  expect(container.querySelector('[data-slot="card"]')).toBeTruthy();
});
it("uses the event form's steps, responsive preview column, and form controls", () => {
  const { container } = render(<AdminFormSkeleton kind="event" fields={4} />);
  expect(screen.getByRole("status", { name: "Loading event form" })).toBeTruthy();
  expect(container.querySelector('[class*="300px"]')).toBeTruthy();
  expect(container.querySelector("table")).toBeNull();
});
it("reserves the same 900px preview area as the email templates page", () => {
  const { container } = render(<EmailTemplatesSkeleton />);
  expect(container.querySelector('[class*="h-[900px]"]')).toBeTruthy();
  expect(container.querySelector('[class*="300px"]')).toBeTruthy();
});
