// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ invalidate: vi.fn(), subscribe: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: mocks.invalidate }) }));
vi.mock("@/store/hooks", () => ({ useAppSelector: () => "admin-token" }));
vi.mock("@/lib/liveStream", () => ({ subscribeLive: mocks.subscribe, subscribeEventsFeed: () => () => {} }));
import { useAdminLiveSync } from "@/hooks/admin/useAdminLiveSync";
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
it("batches a scan and notification burst without canceling slow in-flight requests", () => {
  vi.useFakeTimers(); mocks.subscribe.mockReturnValue(() => {});
  const view = renderHook(() => useAdminLiveSync());
  const handlers = mocks.subscribe.mock.calls[0][1];
  act(() => { for (let i = 0; i < 20; i++) { handlers.onScan(); handlers.onNotification(); } });
  expect(mocks.invalidate).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1000));
  expect(mocks.invalidate).toHaveBeenCalledTimes(8);
  expect(mocks.invalidate.mock.calls.every((call) => call[1].cancelRefetch === false)).toBe(true);
  act(() => handlers.onScan()); view.unmount();
  act(() => vi.advanceTimersByTime(1000)); expect(mocks.invalidate).toHaveBeenCalledTimes(8);
});
