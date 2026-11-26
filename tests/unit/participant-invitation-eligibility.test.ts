import { expect, it } from "vitest";
import { canSendParticipantInvitation } from "@/lib/participantInvitationEligibility";
it.each([
  [{ status: "PENDING", registrationStatus: "APPROVED" }, true],
  [{ status: "PENDING", registrationStatus: "PENDING" }, true],
  [{ status: "VERIFIED", registrationStatus: "APPROVED" }, false],
  [{ status: "COMPLETE", registrationStatus: "APPROVED" }, false],
  [{ status: "PENDING", registrationStatus: "REJECTED" }, false],
  [{ status: "PENDING", registrationStatus: "APPROVED", ticket: { status: "USED" } }, false],
  [{ status: "COMPLETE", registrationStatus: null, ticket: { status: "USED" } }, false],
] as const)("uses the same resend eligibility for individual and selected participants: %j", (participant, eligible) => {
  expect(canSendParticipantInvitation(participant)).toBe(eligible);
});
