import { z } from "zod";
import MailService from "../services/Email";
import { messageHandler } from "../services/WhatsApp";
import { validatePhone } from "../utils/functions";

// Types
interface User {
  email: string;
  name: string;
}

interface MessageFile {
  buffer: Buffer;
  mimetype: string;
}
interface MessageResponse {
  success: boolean;
  message: string;
  result?: any;
  errors?: any[];
}

// Validation Schema
const MessageSchema = z.object({
  category: z.enum(["email", "whatsapp", "both"], {
    required_error: "Communication channel must be specified",
  }),
  body: z.string().min(1, "Message body cannot be empty"),
  subject: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
});

type MessageInput = z.infer<typeof MessageSchema>;

async function sendMessage(
  messageData: MessageInput,
  user: User,
  file?: MessageFile
): Promise<MessageResponse> {
  // Validate input
  const validationResult = MessageSchema.safeParse(messageData);

  if (!validationResult.success) {
    throw new Error(
      JSON.stringify({
        errors: validationResult.error.flatten().fieldErrors,
      })
    );
  }

  const { category, body, subject, phone, email } = validationResult.data;
  const mailService = new MailService({
    email: user.email,
    name: user.name,
  });

  const communicationStrategies = {
    async email() {
      if (!email) throw new Error("Email required for email communication");
      return await mailService.sendMail(
        [email],
        subject || "No Subject",
        body,
        { name: user.name },
        "mailgun",
        "text"
      );
    },

    async whatsapp() {
      if (!phone) throw new Error("Phone number required for WhatsApp");
      const jid = `${validatePhone(phone)}@s.whatsapp.net`;

      if (file) {
        const mime = file.mimetype.split("/")[0];
        return await messageHandler.sendMessage(
          jid,
          file.buffer,
          { caption: body },
          mime as "image" | "video" | "audio"
        );
      }
      return await messageHandler.sendMessage(jid, body, {}, "text");
    },

    async both() {
      if (!phone) throw new Error("Phone number required");

      const [emailResponse, whatsappResponse] = await Promise.all([
        this.email(),
        this.whatsapp(),
      ]);

      return { emailResponse, whatsappResponse };
    },
  };

  try {
    const result = await communicationStrategies[category]();

    return {
      success: true,
      message: `${category.toUpperCase()} message sent successfully`,
      result,
    };
  } catch (error) {
    console.error("Communication Error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Unexpected error"
    );
  }
}

// Validation Schemas
const BulkMessageSchema = z.object({
  channel: z.enum(["email", "whatsapp", "both"], {
    required_error: "Communication channel must be specified",
  }),
  body: z.string().min(1, "Message body cannot be empty"),
  subject: z.string().optional(),
  recipients: z
    .array(
      z.object({
        phone: z.string().optional(),
        email: z.string().email().optional(),
        name: z.string().optional(),
      })
    )
    .min(1, "At least one recipient is required"),
});

type BulkMessageInput = z.infer<typeof BulkMessageSchema>;

interface BulkMessageProgress {
  total: number;
  successful: number;
  failed: number;
  errors: Array<{
    recipient: string;
    error: string;
  }>;
}

async function sendBulkMessages(
  messageData: BulkMessageInput,
  user: User,
  file?: MessageFile
): Promise<MessageResponse> {
  // Validate input
  const validationResult = BulkMessageSchema.safeParse(messageData);

  if (!validationResult.success) {
    throw new Error(
      JSON.stringify({
        errors: validationResult.error.flatten().fieldErrors,
      })
    );
  }

  const { channel, body, subject, recipients } = validationResult.data;
  const mailService = new MailService({
    email: user.email,
    name: user.name,
  });

  const progress: BulkMessageProgress = {
    total: recipients.length,
    successful: 0,
    failed: 0,
    errors: [],
  };

  try {
    switch (channel) {
      case "whatsapp": {
        const phones = recipients
          .filter((r) => r.phone)
          .map((r) => r.phone as string);

        if (phones.length === 0) {
          throw new Error("No valid phone numbers found for WhatsApp messages");
        }

        if (file) {
          const mime = file.mimetype.split("/")[0];
          await messageHandler.sendBulkMessages(
            phones,
            file.buffer,
            { caption: body },
          );
        } else {
          await messageHandler.sendBulkMessages(phones, body);
        }

        progress.successful = phones.length;
        break;
      }

      case "email": {
        // Process email recipients in chunks
        const chunkSize = 5;
        for (let i = 0; i < recipients.length; i += chunkSize) {
          const chunk = recipients.slice(i, i + chunkSize);

          await Promise.all(
            chunk.map(async (recipient) => {
              try {
                if (!recipient.email) {
                  throw new Error("Email address required");
                }
                await mailService.sendMail(
                  [recipient.email],
                  subject || "No Subject",
                  body,
                  { name: recipient.name || user.name },
                  "mailgun",
                  "text"
                );
                progress.successful++;
              } catch (error) {
                progress.failed++;
                progress.errors.push({
                  recipient: recipient.email || "Unknown",
                  error:
                    error instanceof Error ? error.message : "Unknown error",
                });
              }
            })
          );

          // Add delay between email chunks
          if (i + chunkSize < recipients.length) {
            await new Promise((resolve) => setTimeout(resolve, 3000));
          }
        }
        break;
      }

      case "both": {
        // Separate recipients into email and WhatsApp arrays
        const emailRecipients = recipients.filter((r) => r.email);
        const whatsappRecipients = recipients.filter((r) => r.phone);

        // Send WhatsApp messages
        if (whatsappRecipients.length > 0) {
          const phones = whatsappRecipients.map((r) => r.phone as string);
          if (file) {
            const mime = file.mimetype.split("/")[0];
            await messageHandler.sendBulkMessages(
              phones,
              file.buffer,
              { caption: body },
            );
          } else {
            await messageHandler.sendBulkMessages(phones, body);
          }
        }

        // Send emails
        if (emailRecipients.length > 0) {
          const chunkSize = 5;
          for (let i = 0; i < emailRecipients.length; i += chunkSize) {
            const chunk = emailRecipients.slice(i, i + chunkSize);

            await Promise.all(
              chunk.map(async (recipient) => {
                try {
                  if (!recipient.email) {
                    throw new Error("Email address required");
                  }
                  await mailService.sendMail(
                    [recipient.email],
                    subject || "No Subject",
                    body,
                    { name: recipient.name || user.name },
                    "mailgun",
                    "text"
                  );
                  progress.successful++;
                } catch (error) {
                  progress.failed++;
                  progress.errors.push({
                    recipient: recipient.email || "Unknown",
                    error:
                      error instanceof Error ? error.message : "Unknown error",
                  });
                }
              })
            );

            if (i + chunkSize < emailRecipients.length) {
              await new Promise((resolve) => setTimeout(resolve, 3000));
            }
          }
        }
        break;
      }
    }

    // Prepare response
    const response: MessageResponse = {
      success: progress.successful > 0,
      message: `Bulk ${channel.toUpperCase()} messages processed. Success: ${progress.successful
        }/${progress.total}`,
      result: {
        successful: progress.successful,
        failed: progress.failed,
        total: progress.total,
      },
    };

    if (progress.errors.length > 0) {
      response.errors = progress.errors;
    }

    return response;
  } catch (error) {
    console.error("Bulk sending error:", error);
    throw new Error(
      error instanceof Error ? error.message : "Failed to send bulk messages"
    );
  }
}

export { sendBulkMessages, type BulkMessageInput };
export default sendMessage;
