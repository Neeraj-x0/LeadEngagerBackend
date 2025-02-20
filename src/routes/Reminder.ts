import express, { Response } from "express";
import { ReminderModel } from "../models/Reminder";
import { catchAsync, AppError } from "../utils/errorHandler";
import ReminderScheduler from "../scheduler/reminder";
import { Request } from "../types";
import { convertToTimezone } from "../utils/functions";
import { isValidObjectId } from "mongoose";
import { fetchHtml } from "../database/template";
import { SendMessageRequest, UserRequest } from "../utils/engagement/types";
import { log } from "../utils/logger";
import { parseChannels, validateRequest } from "../utils/engagement/functions";
import { EngagementModel } from "../models";
import { getLeadsByCategory } from "../database/leads";
import Media from "../models/Media";
import { emailQueue, posterQueue, whatsappQueue } from "../workers/message";
import { parseRequest } from "../utils/reminder/request-parser";
import { parseEmailContent, parseWhatsAppContent, validateContent } from "../utils/reminder/function";

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

router.post("/:id", catchAsync(async (req: Request, res: Response) => {
  // Parse the request using the provided parsing logic
  const parsedRequest = parseRequest(req);
  const { reminder, whatsapp, email, poster } = parsedRequest.body;

  // Get the file from the parsed request
  let file: Express.Multer.File | undefined;
  let backgroundBuffer: Buffer | undefined;
  let iconBuffer: Buffer | undefined;
  if (req.files) {
    if (Array.isArray(req.files)) {
      file = req.files.find(f => f.fieldname === "file");
      backgroundBuffer = req.files.find(f => f.fieldname === "background")?.buffer;
      iconBuffer = req.files.find(f => f.fieldname === "icon")?.buffer;
    } else {
      const fileArray = Object.values(req.files).flat();
      file = fileArray.find(f => f.fieldname === "file");
      backgroundBuffer = fileArray.find(f => f.fieldname === "background")?.buffer;
      iconBuffer = fileArray.find(f => f.fieldname === "icon")?.buffer;
    }
  }
  // Determine the category based on provided content
  const category = req.body.category
  // Parse WhatsApp content if applicable
  const messageContentParsed = (category === "whatsapp" || category === "both")
    ? parseWhatsAppContent(whatsapp, file)
    : null;

  // Parse email content if applicable
  const emailContentParsed = (category === "email" || category === "both")
    ? await parseEmailContent(email, file)
    : null;

  let iconID, backgroundID;

  if (iconBuffer) {
    iconID = (await Media.create({ file: iconBuffer }))._id;
  }

  if (backgroundBuffer) {
    backgroundID = (await Media.create({ file: backgroundBuffer }))._id;
  }
console.log(iconID, backgroundID)
  // Create reminder document
  const reminderDoc = await ReminderModel.create({
    leadId: parsedRequest.params.id.length < 8 ? parsedRequest.params.id : null,
    engagementId: parsedRequest.params.id.length >= 8 ? parsedRequest.params.id : null,
    title: reminder.title,
    description: reminder.description,
    scheduledAt: convertToTimezone(new Date(reminder.scheduledAt)),
    frequency: reminder.frequency,
    category,
    messageContent: messageContentParsed,
    emailContent: emailContentParsed,
    poster,
    posterIcon: iconID,
    posterBackground: backgroundID,
    user: parsedRequest.user._id,
  });

  // Schedule the reminder
  await scheduler.scheduleReminder(reminderDoc);

  res.status(201).json({
    status: "success",
    data: reminderDoc
  });
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