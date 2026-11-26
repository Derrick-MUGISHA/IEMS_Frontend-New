import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  later: [] as (() => Promise<void>)[],
  participant: null as null | Record<string, unknown>,
  issueTicket: vi.fn(),
  uploadImage: vi.fn(),
  emailTicket: vi.fn(),
  updateOne: vi.fn(),
}));
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => Promise<void>) => { m.later.push(fn); },
}));
vi.mock("@/lib/db", () => ({ dbConnect: async () => {} }));
vi.mock("@/lib/auth", () => ({ requireAttendee: async () => "p1" }));
vi.mock("@/lib/cloudinary", () => ({
  prepareCloudinaryImage: async (b: Buffer) => b,
  uploadImage: m.uploadImage,
  InvalidImageError: class extends Error {},
}));
vi.mock("@/lib/tickets", () => ({
  issueTicket: m.issueTicket,
  emailTicket: m.emailTicket,
  CapacityError: class extends Error {},
}));
vi.mock("@/models", () => ({
  GENDERS: ["FEMALE", "MALE", "OTHER"],
  STACKS: ["FRONTEND", "BACKEND", "FULLSTACK", "MOBILE", "DATA", "OTHER"],
  Participant: { findById: async () => m.participant, updateOne: m.updateOne },
  Event: { findById: async () => ({ name: "Demo Day" }) },
  Ticket: { findById: async () => ({ code: "c1", status: "VALID", save: async () => {} }) },
}));

import { POST } from "@/app/api/me/photo/route";

function request(fields: Record<string, string> = {}) {
  const form = new FormData();
  form.append("photo", new File([new Uint8Array([1, 2, 3])], "me.jpg", { type: "image/jpeg" }));
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request("http://x/api/me/photo", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  m.later = [];
  m.participant = { _id: "p1", event: "e1", status: "VERIFIED", name: "Aline", phone: "0788", gender: null, stack: null, save: vi.fn() };
  m.issueTicket.mockResolvedValue({ _id: "t1", code: "c1" });
});

describe("POST /api/me/photo", () => {
  it("issues the pass and answers before the photo upload and email run", async () => {
    const res = await POST(request({ gender: "FEMALE", stack: "DATA" }));
    expect(res.status).toBe(200);
    expect(m.issueTicket).toHaveBeenCalledWith(expect.anything(), { email: false });
    expect(m.uploadImage).not.toHaveBeenCalled();
    expect(m.emailTicket).not.toHaveBeenCalled();
    expect(m.participant).toMatchObject({ status: "COMPLETE", gender: "FEMALE", stack: "DATA" });

    m.uploadImage.mockResolvedValue("https://img/p1.webp");
    await m.later[0]();
    expect(m.updateOne).toHaveBeenCalledWith({ _id: "p1" }, { profilePicture: "https://img/p1.webp" });
    expect(m.emailTicket).toHaveBeenCalledOnce();
  });

  it("never overwrites details already on file", async () => {
    await POST(request({ phone: "0799999999", name: "Someone Else" }));
    expect(m.participant).toMatchObject({ phone: "0788", name: "Aline" });
  });

  it("still emails the ticket when the photo upload fails", async () => {
    await POST(request());
    m.uploadImage.mockRejectedValue(new Error("cloudinary down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await m.later[0]();
    expect(m.updateOne).not.toHaveBeenCalled();
    expect(m.emailTicket).toHaveBeenCalledOnce();
  });
});
