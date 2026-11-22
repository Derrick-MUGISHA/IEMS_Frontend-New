import { api } from "./client";

export type InvitationResult = { sent: string[]; failed: { id: string; error: string }[] };

export async function sendParticipantInvitations(participantIds: string[]): Promise<InvitationResult> {
  const ids = [...new Set(participantIds)];
  const result: InvitationResult = { sent: [], failed: [] };
  for (let offset = 0; offset < ids.length; offset += 10) {
    const batch = ids.slice(offset, offset + 10);
    try {
      const response = await api<InvitationResult>("/api/admin/attendees/invitations", {
        role: "admin", body: { participantIds: batch },
      });
      result.sent.push(...response.sent);
      result.failed.push(...response.failed);
    } catch (error) {
      result.failed.push(...batch.map((id) => ({ id, error: error instanceof Error ? error.message : "Invitation could not be sent." })));
    }
  }
  return result;
}
