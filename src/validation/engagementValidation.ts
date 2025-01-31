import Joi from "joi";
import {
  MessageType,
  CommunicationChannel,
  ReminderFrequency,
} from "../types/engagement";

export const createEngagementMessageSchema = Joi.object({
  leadId: Joi.string().required(),
  content: Joi.string().required(),
  type: Joi.string()
    .valid(...Object.values(MessageType))
    .required(),
  channel: Joi.string()
    .valid(...Object.values(CommunicationChannel))
    .required(),
  attachments: Joi.array().items(
    Joi.object({
      type: Joi.string(),
      url: Joi.string().uri(),
      name: Joi.string(),
    })
  ),
  customFields: Joi.object(),
});

export const createReminderSchema = Joi.object({
  leadId: Joi.string().required(),
  title: Joi.string().required(),
  description: Joi.string(),
  scheduledAt: Joi.date().iso().required(),
  frequency: Joi.string().valid(...Object.values(ReminderFrequency)),
  category: Joi.string(),
});



export const createCampaignSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string(),
  channel: Joi.string()
    .valid(...Object.values(CommunicationChannel))
    .required(),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  status: Joi.string().valid("DRAFT", "ACTIVE", "COMPLETED", "PAUSED"),
});
