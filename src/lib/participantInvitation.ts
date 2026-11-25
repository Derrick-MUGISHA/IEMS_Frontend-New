import { createHash, randomBytes } from "crypto";
import type { Types } from "mongoose";
import { VerificationToken } from "@/models";
import { appUrl } from "./appUrl";
import { sendMagicLinkEmail } from "./mailer";

export async function sendParticipantInvitation(
  participant: { _id: Types.ObjectId | string; email: string; name: string },
  eventName: string,
) {
  const token = randomBytes(32).toString("hex");
  let url: URL;
  try {
    url = new URL(appUrl(`/verify/${token}`));
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
  } catch {
    throw new Error("Set NEXT_PUBLIC_APP_URL to the full event website URL before sending invitations.");
  }
  await VerificationToken.create({
    tokenHash: createHash("sha256").update(token).digest("hex"),
    purpose: "LOGIN", email: participant.email, participant: participant._id,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
  await sendMagicLinkEmail(participant.email, participant.name, url.toString(), eventName);
}
