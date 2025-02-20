import express, { Response } from "express";
import { ReminderModel } from "../models/Reminder";
import { catchAsync, AppError } from "../utils/errorHandler";
import ReminderScheduler from "../scheduler/reminder";
import { Request } from "../types";
import { convertToTimezone } from "../utils/functions";
import { isValidObjectId } from "mongoose";
import { fetchHtml } from "../database/template";

const router = express.Router();
const scheduler = ReminderScheduler;

// Types for better clarity
interface EmailContent {
  emailSubject: string;
  emailTemplate: string;
  emailBodyType: string;
  emailData: any;
  customHTML: string;
  templateId: string;
}

interface MediaOptions {
  caption: string;
  fileName: string;
  mimetype: string;
}

// Initialize reminders at startup
(async function initializeReminders() {
  try {
    console.log("Loading and scheduling reminders...");
    await scheduler.loadAndScheduleReminders();
    console.log("Reminders loaded successfully");
  } catch (error) {
    console.error("Failed to load reminders:", error);
  }
})();



const validateCategory = (category: string, message: any, emailSubject: string, file: Express.Multer.File | undefined) => {
  if (category === "email") {
    if (!emailSubject) {
      throw new AppError("Email subject is required for category 'email'.", 400);
    }
  } else if (category === "whatsapp") {
    if (!file && !message) {
      throw new AppError("Either a file or WhatsApp message content is required for category 'whatsapp'.", 400);
    }
  } else if (category === "both") {
    if (!file && !message) {
      throw new AppError("Either a file or WhatsApp message content is required for category 'both'.", 400);
    }
    if (!emailSubject) {
      throw new AppError("Email subject is required for category 'both'.", 400);
    }
  } else {
    throw new AppError("Invalid category provided. Expected 'whatsapp', 'email', or 'both'.", 400);
  }
};

const parseMessageContent = (
  file: Express.Multer.File | undefined,
  messageContent: any,
  mediaType: string,
  caption: string
) => {
  let message = messageContent.message;
  let mediaOptions: Partial<MediaOptions> = {};

  if (file) {
    message = file.buffer;
    mediaOptions = {
      caption: caption || "",
      fileName: file.originalname,
      mimetype: file.mimetype,
    };
  }

  return {
    mediaType,
    message,
    caption: caption || "",
    mediaOptions,
  };
};

const parseEmailContent = async (
  emailContent: EmailContent,
  file: Express.Multer.File | undefined,
  type: string
) => {
  let customHTML = emailContent.customHTML;

  if (emailContent.templateId) {
    customHTML = (await fetchHtml(emailContent.templateId)) ?? "";
    if (!customHTML) {
      throw new AppError(
        "Email template is required either as customHTML or via a valid templateId.",
        400
      );
    }
  }

  return {
    type,
    emailSubject: emailContent.emailSubject,
    emailTemplate: emailContent.emailTemplate || "",
    emailBodyType: emailContent.emailBodyType,
    emailData: emailContent.emailData,
    customHTML,
    templateId: emailContent.templateId || "",
    file
  };
};

// Route handlers
router.post("/", catchAsync(async (req: Request, res: Response) => {
  const {
    leadId,
    engagementId,
    title,
    description,
    scheduledAt,
    frequency,
    category,
    mediaType,
    messageContent,
    caption,
    type,
    emailContent: rawEmailContent,
  } = req.body;

  console.log("req.body", req.body);

  const emailContent = typeof rawEmailContent !== 'object' ? JSON.parse(rawEmailContent) : rawEmailContent;
  
  let file
  if (req.files) {
    if (Array.isArray(req.files) && req.files.length > 0) {
      file = req.files[0];
    } else {
      const filesList: Express.Multer.File[] = Object.values(req.files).flat();
      if (filesList.length > 0) {
        file = filesList[0];
      }
    }
  }


  console.log("file", file);

  // Validate category requirements
  validateCategory(category, messageContent.message, emailContent.emailSubject, file);

  // Parse content based on category
  const messageContentParsed = (category === "whatsapp" || category === "both")
    ? parseMessageContent(file, messageContent, mediaType, caption)
    : null;

  const emailContentParsed = (category === "email" || category === "both")
    ? await parseEmailContent(emailContent, file, type)
    : null;

  // Create and schedule reminder
  const reminder = await ReminderModel.create({
    leadId,
    engagementId,
    title,
    description,
    scheduledAt: convertToTimezone(scheduledAt),
    frequency,
    category,
    messageContent: messageContentParsed,
    emailContent: emailContentParsed,
    user: req.user?.id,
  });

  await scheduler.scheduleReminder(reminder);

  res.status(201).json({ status: "success", data: reminder });
}));

router.get("/", catchAsync(async (req: Request, res: Response) => {
  const reminders = await ReminderModel.find({ user: req.user?.id });
  const scheduledIds = await scheduler.getScheduledJobs();

  const result = reminders.map(reminder => ({
    ...reminder.toObject(),
    scheduled: scheduledIds.includes(reminder._id.toString()),
  }));

  res.status(200).json({ status: "success", data: result });
}));

router.get("/:id", catchAsync(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new AppError("Invalid reminder ID provided", 400);
  }

  const reminder = await ReminderModel.findById(req.params.id)
    .populate("messageRecordId")
    .populate("emailRecordId");

  if (!reminder) {
    throw new AppError("Reminder not found", 404);
  }

  res.status(200).json({ status: "success", data: reminder });
}));

router.delete("/:id", catchAsync(async (req: Request, res: Response) => {
  if (!isValidObjectId(req.params.id)) {
    throw new AppError("Invalid reminder ID provided", 400);
  }

  const reminder = await ReminderModel.findByIdAndDelete(req.params.id);
  if (!reminder) {
    throw new AppError("Reminder not found", 404);
  }

  res.status(204).json({ status: "success", data: null });
}));

export default router;