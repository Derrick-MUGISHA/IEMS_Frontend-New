export function canSendParticipantInvitation(participant: {
  status: string;
  registrationStatus?: string | null;
  ticket?: { status: string } | null;
}) {
  return participant.status === "PENDING"
    && !!participant.registrationStatus
    && participant.registrationStatus !== "REJECTED"
    && participant.ticket?.status !== "USED";
}
