import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ admin: vi.fn(), db: vi.fn(), event: vi.fn(), participant: vi.fn(), token: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAdmin: mocks.admin }));
vi.mock("@/lib/db", () => ({ dbConnect: mocks.db }));
vi.mock("@/lib/mailer", () => ({ sendMagicLinkEmail: mocks.send }));
vi.mock("@/models", () => ({
  Event: { findById: mocks.event }, Participant: { create: mocks.participant },
  VerificationToken: { create: mocks.token }, Guest: {}, Ticket: {},
  GENDERS: ["FEMALE", "MALE"], PARTICIPANT_STATUSES: ["PENDING", "VERIFIED", "COMPLETE"],
  REGISTRATION_STATUSES: ["PENDING", "APPROVED", "REJECTED"], STACKS: ["OTHER"],
}));
import { POST } from "@/app/api/admin/attendees/route";

const request = () => new Request("http://localhost/api/admin/attendees", {
  method: "POST", body: JSON.stringify({ eventId: "507f1f77bcf86cd799439011", name: "Aline", email: "Aline@example.com" }),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://events.example.com");
  mocks.admin.mockResolvedValue({ id: "admin" });
  mocks.event.mockResolvedValue({ _id: "event-id", name: "Graduation" });
  mocks.participant.mockResolvedValue({ _id: "participant-id", name: "Aline", email: "aline@example.com" });
});
afterEach(() => vi.unstubAllEnvs());

describe("admin participant invitations", () => {
  it("sends a redeemable verification link for the new participant", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ invitationSent: true });
    const [email, name, url, event] = mocks.send.mock.calls[0];
    expect([email, name, event]).toEqual(["aline@example.com", "Aline", "Graduation"]);
    expect(url).toMatch(/^https:\/\/events.example.com\/verify\/[a-f0-9]{64}$/);
    const token = url.split("/").pop();
    expect(mocks.token).toHaveBeenCalledWith(expect.objectContaining({
      tokenHash: createHash("sha256").update(token).digest("hex"),
      purpose: "LOGIN", participant: "participant-id", email,
    }));
    const expires = mocks.token.mock.calls[0][0].expiresAt.getTime();
    expect(expires - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    expect(expires - Date.now()).toBeLessThanOrEqual(30 * 60 * 1000);
  });

  it.each(["send", "token"] as const)("reports %s failure while preserving the saved participant", async (operation) => {
    mocks[operation].mockRejectedValue(new Error("Unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await POST(request());
      expect(response.status).toBe(201);
      expect(await response.json()).toMatchObject({ participant: { id: "participant-id" }, invitationSent: false });
      expect(mocks.participant).toHaveBeenCalledTimes(1);
    } finally { error.mockRestore(); }
  });

  it("does not send another invitation on a duplicate registration", async () => {
    mocks.participant.mockRejectedValue({ code: 11000 });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.token).not.toHaveBeenCalled();
  });

  it("does not create or email participants for unauthenticated requests", async () => {
    mocks.admin.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    expect(mocks.participant).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it("reports an invalid website URL instead of sending a broken invitation link", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const response = await (await POST(request())).json();
      expect(response.invitationSent).toBe(false);
      expect(response.invitationError).toContain("NEXT_PUBLIC_APP_URL");
      expect(mocks.token).not.toHaveBeenCalled();
      expect(mocks.send).not.toHaveBeenCalled();
    } finally { log.mockRestore(); }
  });
});
