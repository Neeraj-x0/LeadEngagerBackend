import Joi from "joi";

export const emailValidationSchema = Joi.object({

  subject: Joi.string().max(255).required().messages({
    "string.max": "Subject must not exceed 255 characters",
    "any.required": "Subject is required",
  }),

  data: Joi.object().required().messages({
    "any.required": "Data is required",
  }),

  bodyType: Joi.string().valid("html", "text").default("html").messages({
    "any.only": "Body type must be either 'html' or 'text'",
  }),

  customHTML: Joi.string().optional(),

  templateId: Joi.string().min(0).optional().messages({
    "string.empty": "Template ID cannot be empty",
  }),
  type: Joi.string().valid("mailgun", "gmail").default("mailgun").messages({
    "any.only": "Email type must be either 'mailgun' or 'gmail'",
  }),
});
