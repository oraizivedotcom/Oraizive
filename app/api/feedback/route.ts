import { Resend } from "resend";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const REASONS = new Set([
  "Bug or technical issue",
  "Feature request",
  "Account or billing",
  "Other",
]);
const ACCEPTED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_IMAGES = 4;
const MAX_IMAGE_SIZE = 1024 * 1024;
const MAX_TOTAL_IMAGE_SIZE = MAX_IMAGES * MAX_IMAGE_SIZE;
const MAX_DETAILS_LENGTH = 600;

export async function POST(request: Request) {
  const apiKey = process.env.AUTH_RESEND_KEY;
  if (!apiKey) {
    console.error("AUTH_RESEND_KEY is not configured for the feedback route.");
    return NextResponse.json(
      { error: "Feedback email is not configured. Please contact support." },
      { status: 500 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("Could not read feedback form data:", error);
    return NextResponse.json(
      { error: "Could not read the feedback form." },
      { status: 400 },
    );
  }

  const reason = formData.get("reason");
  const details = formData.get("details");
  if (
    typeof reason !== "string" ||
    !REASONS.has(reason) ||
    typeof details !== "string" ||
    details.trim().length < 5 ||
    details.length > MAX_DETAILS_LENGTH
  ) {
    return NextResponse.json(
      { error: "Choose a reason and provide at least 5 characters of detail." },
      { status: 400 },
    );
  }

  const imageEntries = formData.getAll("images");
  if (imageEntries.length > MAX_IMAGES) {
    return NextResponse.json(
      { error: `You can attach up to ${MAX_IMAGES} images.` },
      { status: 400 },
    );
  }

  const images: File[] = [];
  let totalImageSize = 0;
  for (const entry of imageEntries) {
    if (typeof entry === "string" || entry.size === 0) {
      return NextResponse.json(
        { error: "One of the uploaded images is invalid." },
        { status: 400 },
      );
    }
    if (!ACCEPTED_IMAGE_TYPES.has(entry.type)) {
      return NextResponse.json(
        { error: "Images must be JPG, PNG, GIF, or WebP files." },
        { status: 400 },
      );
    }
    if (entry.size > MAX_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "Each image must be 1 MB or smaller." },
        { status: 400 },
      );
    }

    totalImageSize += entry.size;
    if (totalImageSize > MAX_TOTAL_IMAGE_SIZE) {
      return NextResponse.json(
        { error: "The images are too large to send together." },
        { status: 400 },
      );
    }
    images.push(entry);
  }

  try {
    const attachments = await Promise.all(
      images.map(async (image, index) => ({
        filename:
          image.name.replace(/[^a-zA-Z0-9._-]/g, "_") ||
          `feedback-image-${index + 1}`,
        content: Buffer.from(await image.arrayBuffer()).toString("base64"),
        contentType: image.type,
      })),
    );
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.AUTH_EMAIL ?? "Oraizive <team@oraizive.com>",
      to: ["support@oraizive.com"],
      subject: `Oraizive feedback: ${reason}`,
      text: `Reason: ${reason}\n\nDetails:\n${details.trim()}`,
      attachments,
    });

    if (error) {
      console.error("Resend could not deliver feedback:", error);
      return NextResponse.json(
        { error: "Could not send feedback. Please try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to send feedback email:", error);
    return NextResponse.json(
      { error: "Could not send feedback. Please try again." },
      { status: 500 },
    );
  }
}
