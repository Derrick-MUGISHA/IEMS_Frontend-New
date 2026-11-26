import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const bridge = vi.hoisted(() => ({ token: vi.fn(), refresh: vi.fn(), unauthorized: vi.fn() }));
vi.mock("@/lib/authBridge", () => ({ bridgeGetToken: bridge.token, bridgeRefresh: bridge.refresh, bridgeOnUnauthorized: bridge.unauthorized }));
import { apiBlob } from "@/lib/client";
const fetchMock = vi.fn();
beforeEach(() => { vi.resetAllMocks(); vi.stubGlobal("fetch", fetchMock); });
afterEach(() => vi.unstubAllGlobals());
describe("PDF ticket loading", () => {
  it("refreshes a participant's expired access token before loading the PDF", async () => {
    bridge.token.mockReturnValue("old-token");
    bridge.refresh.mockResolvedValue("fresh-token");
    fetchMock.mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("%PDF-ticket", { headers: { "Content-Type": "application/pdf" } }));
    expect(await (await apiBlob("/api/tickets/id/download", { role: "participant" })).text()).toBe("%PDF-ticket");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe("Bearer fresh-token");
    expect(bridge.unauthorized).not.toHaveBeenCalled();
  });
  it("loads a guest's secret link without a staff token", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-ticket"));
    await apiBlob("/api/tickets/by-code/secret/pdf");
    expect(bridge.token).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});
