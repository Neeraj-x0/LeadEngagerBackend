import Joi from "joi";

export const bulkMessageValidator = Joi.object({
  body: Joi.object({
    category: Joi.string()
      .valid("email", "whatsapp", "both")
      .required()
      .messages({
        "any.required": "Communication channel must be specified",
        "any.only": "Category must be either email, whatsapp, or both",
      }),

    body: Joi.string().required().min(1).messages({
      "string.empty": "Message body cannot be empty",
      "any.required": "Message body is required",
    }),

    subject: Joi.string().optional().allow(""),
  }).required(),
});
