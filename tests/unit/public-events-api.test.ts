import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ db: vi.fn(), find: vi.fn(), sort: vi.fn() }));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.db }));
vi.mock("@/models", () => ({ Event: { find: mocks.find } }));
vi.mock("@/lib/eventView", () => ({ toVenueEvent: (event: unknown) => event }));
import { GET } from "@/app/api/events/route";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockReturnValue({ sort: mocks.sort });
});

it("returns newly published data on the next request without retaining a process cache", async () => {
  mocks.sort.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "published-event" }]);
  expect(await (await GET()).json()).toEqual({ events: [] });
  const response = await GET();
  expect(await response.json()).toEqual({ events: [{ id: "published-event" }] });
  expect(mocks.find).toHaveBeenCalledTimes(2);
  expect(mocks.find).toHaveBeenCalledWith({ status: { $ne: "DRAFT" }, isPublished: true, archivedAt: null });
  for (const name of ["Cache-Control", "CDN-Cache-Control", "Vercel-CDN-Cache-Control"]) {
    expect(response.headers.get(name)).toContain("no-store");
  }
});
