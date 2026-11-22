import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), smtp: vi.fn(), cloud: vi.fn(), aggregate: vi.fn(), insert: vi.fn() }));
vi.mock("mongoose", () => ({ default: { connection: { host: "test-db", db: { admin: () => ({ ping: async () => {} }) } } } }));
vi.mock("@/lib/db", () => ({ dbConnect: async () => {} }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.auth }));
vi.mock("@/lib/cloudinary", () => ({ pingCloudinary: mocks.cloud }));
vi.mock("@/lib/mailer", () => ({ verifyMailer: mocks.smtp }));
vi.mock("@/models", () => ({ HealthSample: { aggregate: mocks.aggregate, insertMany: mocks.insert }, Ticket: { countDocuments: async () => 0 }, Participant: { countDocuments: async () => 0 }, ScanLog: { countDocuments: async () => 0 } }));
beforeEach(() => {
  vi.resetModules(); vi.resetAllMocks(); vi.useFakeTimers({ toFake: ["Date"] });
  mocks.auth.mockResolvedValue({ id: "admin" }); mocks.smtp.mockResolvedValue(true); mocks.cloud.mockResolvedValue({ status: "ok" });
  mocks.aggregate.mockResolvedValue([]); mocks.insert.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());
it("coalesces expensive checks while authenticating every request", async () => {
  const { GET } = await import("@/app/api/admin/health/route");
  const request = () => new Request("http://localhost/api/admin/health");
  const responses = await Promise.all([GET(request()), GET(request()), GET(request())]);
  expect(mocks.smtp).toHaveBeenCalledOnce(); expect(mocks.cloud).toHaveBeenCalledOnce(); expect(mocks.auth).toHaveBeenCalledTimes(3);
  expect(responses[0].headers.get("Cache-Control")).toBe("private, no-store");
  const first = await responses[0].json();
  expect(await responses[1].json()).toEqual(first);
  vi.setSystemTime(Date.now() + 30_001); await GET(request()); expect(mocks.smtp).toHaveBeenCalledTimes(2);
  mocks.auth.mockResolvedValue(null); expect((await GET(request())).status).toBe(401);
});
