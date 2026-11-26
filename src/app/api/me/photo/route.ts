import { after } from "next/server";
import { dbConnect } from "@/lib/db";
import { Event, Participant, Ticket, GENDERS, STACKS, type Gender, type Stack } from "@/models";
import { requireAttendee } from "@/lib/auth";
import { prepareCloudinaryImage, uploadImage, InvalidImageError } from "@/lib/cloudinary";
import { issueTicket, emailTicket, CapacityError } from "@/lib/tickets";
import { ok, fail, unauthorized, notFound } from "@/lib/http";

const MAX_BYTES = 8 * 1024 * 1024;

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value.trim() : "";
};

/* Finishes registration in one request: the missing profile details ride along
   with the photo. The photo is checked here, the ticket is issued at once and
   the response returns; the Cloudinary upload and the ticket email (whose PDF
   carries the photo) follow in the background so nobody waits on them. */
export async function POST(req: Request) {
  const participantId = await requireAttendee(req);
  if (!participantId) return unauthorized();

  const form = await req.formData().catch(() => null);
  const file = form?.get("photo");
  if (!form || !(file instanceof File)) return fail("Attach an image as the 'photo' field");
  if (!file.type.startsWith("image/")) return fail("Only image files are accepted");
  if (file.size > MAX_BYTES) return fail("Image must be under 8MB");

  const name = text(form, "name");
  const phone = text(form, "phone");
  const gender = text(form, "gender");
  const stack = text(form, "stack");
  if (name && name.length < 2) return fail("Enter your full name");
  if (phone && phone.length < 6) return fail("Enter a valid phone number");
  if (gender && !(GENDERS as readonly string[]).includes(gender)) return fail("Choose a gender");
  if (stack && !(STACKS as readonly string[]).includes(stack)) return fail("Choose a track");

  let photo: Buffer;
  try {
    photo = await prepareCloudinaryImage(Buffer.from(await file.arrayBuffer()));
  } catch (err) {
    if (err instanceof InvalidImageError) return fail(err.message);
    throw err;
  }

  await dbConnect();
  const participant = await Participant.findById(participantId);
  if (!participant) return notFound("Registration");
  if (participant.status === "PENDING") return fail("Verify your email first", 403);

  /* only fill what's missing; details already on file stay */
  if (name && (!participant.name || participant.name.startsWith("Guest of "))) participant.name = name;
  if (phone && !participant.phone) participant.phone = phone;
  if (gender && !participant.gender) participant.gender = gender as Gender;
  if (stack && !participant.stack) participant.stack = stack as Stack;
  participant.status = "COMPLETE";
  await participant.save();

  let ticket;
  try {
    ticket = await issueTicket({ kind: "Participant", doc: participant }, { email: false });
  } catch (err) {
    if (err instanceof CapacityError) return fail(err.message, 409);
    throw err;
  }

  const ticketId = ticket._id;
  after(async () => {
    try {
      const url = await uploadImage(photo, "participants");
      await Participant.updateOne({ _id: participantId }, { profilePicture: url });
    } catch (err) {
      /* the dashboard asks for the photo again while profilePicture is empty */
      console.error("profile photo upload failed", err);
    }
    try {
      const [fresh, event, issued] = await Promise.all([
        Participant.findById(participantId),
        Event.findById(participant.event),
        Ticket.findById(ticketId),
      ]);
      if (!fresh || !event || !issued || issued.status === "REVOKED") return;
      await emailTicket({ kind: "Participant", doc: fresh }, event, issued.code, issued);
      issued.sentAt = new Date();
      await issued.save();
    } catch (err) {
      console.error("ticket email failed", err);
    }
  });

  return ok({ ticketCode: ticket.code });
}
