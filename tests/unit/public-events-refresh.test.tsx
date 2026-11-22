// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider, focusManager } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("axios", () => ({ default: { create: () => ({ get: mocks.get }) } }));
vi.mock("@/lib/liveStream", () => ({ subscribeEventsFeed: () => () => {} }));
import { useEvents } from "@/lib/useEvents";

const clients: QueryClient[] = [];
function Browser({ name }: { name: string }) {
  const { data } = useEvents();
  return <div data-testid={name}>{data?.length ? data[0].title : "No events"}</div>;
}
function browser(name: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  clients.push(client);
  return <QueryClientProvider client={client}><Browser name={name} /></QueryClientProvider>;
}

beforeEach(() => { vi.useFakeTimers(); focusManager.setFocused(true); mocks.get.mockReset(); });
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); focusManager.setFocused(undefined); vi.useRealTimers(); });

it("refreshes two independent browser caches after publication even without a live signal", async () => {
  let events: { id: string; title: string }[] = [];
  mocks.get.mockImplementation(async () => ({ data: { events } }));
  render(<>{browser("first-browser")}{browser("second-browser")}</>);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(screen.getByTestId("first-browser").textContent).toBe("No events");
  expect(screen.getByTestId("second-browser").textContent).toBe("No events");
  events = [{ id: "graduation", title: "Published graduation" }];
  await act(async () => { await vi.advanceTimersByTimeAsync(15_001); });
  expect(screen.getByTestId("first-browser").textContent).toBe("Published graduation");
  expect(screen.getByTestId("second-browser").textContent).toBe("Published graduation");
});

it("revalidates a fresh persisted cache on mount", async () => {
  mocks.get.mockResolvedValue({ data: { events: [{ id: "new", title: "Updated event" }] } });
  const view = browser("restored-browser");
  clients[0].setQueryData(["events"], [{ id: "old", title: "Old event" }]);
  render(view);
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(mocks.get).toHaveBeenCalledOnce();
  expect(screen.getByTestId("restored-browser").textContent).toBe("Updated event");
});
