import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("@/lib/client", () => ({ api: mocks.api }));
import { sendParticipantInvitations } from "@/lib/sendParticipantInvitations";
beforeEach(() => vi.resetAllMocks());

it("delivers a large import in bounded batches without duplicate recipients", async () => {
  const ids = Array.from({ length: 25 }, (_, i) => `participant-${i}`);
  mocks.api.mockImplementation(async (_path, { body }) => ({ sent: body.participantIds, failed: [] }));
  expect(await sendParticipantInvitations([...ids, ids[0]])).toEqual({ sent: ids, failed: [] });
  expect(mocks.api.mock.calls.map((call) => call[1].body.participantIds.length)).toEqual([10, 10, 5]);
});

it("keeps failed recipients available for retry without resending successes", async () => {
  mocks.api.mockResolvedValueOnce({ sent: ["a"], failed: [{ id: "b", error: "SMTP unavailable" }] });
  const initial = await sendParticipantInvitations(["a", "b"]);
  mocks.api.mockResolvedValueOnce({ sent: ["b"], failed: [] });
  expect(await sendParticipantInvitations(initial.failed.map((p) => p.id))).toEqual({ sent: ["b"], failed: [] });
  expect(mocks.api.mock.calls[1][1].body.participantIds).toEqual(["b"]);
});

it("reports request failures while still attempting later batches", async () => {
  const ids = Array.from({ length: 11 }, (_, i) => String(i));
  mocks.api.mockRejectedValueOnce(new Error("Connection lost")).mockResolvedValueOnce({ sent: ["10"], failed: [] });
  const result = await sendParticipantInvitations(ids);
  expect(result.sent).toEqual(["10"]); expect(result.failed.map((p) => p.id)).toEqual(ids.slice(0, 10));
});
