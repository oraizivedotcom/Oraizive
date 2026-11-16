import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendEmail } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class {
    emails = { send: sendEmail };
  },
}));

import { POST } from "./route";

function createFeedbackForm(imageCount = 0) {
  const formData = new FormData();
  formData.set("reason", "Bug or technical issue");
  formData.set("details", "The page does not load.");
  for (let index = 0; index < imageCount; index += 1) {
    formData.append(
      "images",
      new File(["image data"], `screenshot-${index}.png`, {
        type: "image/png",
      }),
      `screenshot-${index}.png`,
    );
  }
  return formData;
}

describe("POST /api/feedback", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_RESEND_KEY", "test-resend-key");
    sendEmail.mockResolvedValue({ data: { id: "email-id" }, error: null });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("rejects invalid reasons without sending an email", async () => {
    const formData = createFeedbackForm();
    formData.set("reason", "Not a supported reason");

    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects details longer than 600 characters", async () => {
    const formData = createFeedbackForm();
    formData.set("details", "a".repeat(601));

    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("accepts details at the 600-character limit", async () => {
    const formData = createFeedbackForm();
    formData.set("details", "a".repeat(600));

    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        body: formData,
      }),
    );

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("rejects more than four images", async () => {
    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        body: createFeedbackForm(5),
      }),
    );

    expect(response.status).toBe(400);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends the reason, details, and image attachments through Resend", async () => {
    const response = await POST(
      new Request("http://localhost/api/feedback", {
        method: "POST",
        body: createFeedbackForm(1),
      }),
    );

    expect(response.status).toBe(200);
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: ["support@oraizive.com"],
        subject: "Oraizive feedback: Bug or technical issue",
        text: "Reason: Bug or technical issue\n\nDetails:\nThe page does not load.",
        attachments: [
          expect.objectContaining({
            content: "aW1hZ2UgZGF0YQ==",
            contentType: "image/png",
          }),
        ],
      }),
    );
  });
});
