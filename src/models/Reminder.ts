import mongoose from "mongoose";
import { ReminderFrequency } from "../types/engagement";

const reminderSchema = new mongoose.Schema({
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead",
  },
  engagementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engagement",
  },
  title: {
    type: String,
    required: true,
  },
  description: String,
  scheduledAt: {
    type: Date,
    required: true,
  },
  // Category can be: "whatsapp", "email", or "both"
  category: {
    type: String,
    enum: ["whatsapp", "email", "both"],
    required: true,
  },
  // Content for a generic message channel (e.g., WhatsApp)
  messageContent: {
    type: mongoose.Schema.Types.Mixed,
  },
  // Content for email. When category is "email" or "both", emailContent is required.
  emailContent: {
    type: mongoose.Schema.Types.Mixed,
  },
  // References to saved message records after sending notifications
  messageRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
  },
  emailRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Email",
  },
  notificationSent: {
    type: Boolean,
    default: false,
  },
  // Flag to indicate that the reminder has been scheduled in memory.
  isScheduled: {
    type: Boolean,
    default: false,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

export const ReminderModel = mongoose.model("Reminder", reminderSchema);
