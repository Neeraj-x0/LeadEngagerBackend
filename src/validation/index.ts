import {
  createEngagementMessageSchema,
  createCampaignSchema,
  createReminderSchema,
} from "./engagementValidation";
import {WhatsAppvalidators} from "./whatsApp";
import { userValidationSchema } from "./userValidation";
import Joi from "joi";

export const statusValidationSchema = Joi.object({
  name: Joi.string().required(),
});

export const statusUpdateValidationSchema = Joi.object({
  name: Joi.string().required(),
  newName: Joi.string().required(),
});

export {
  createEngagementMessageSchema,
  createCampaignSchema,
  createReminderSchema,
  userValidationSchema,
    WhatsAppvalidators,
};
