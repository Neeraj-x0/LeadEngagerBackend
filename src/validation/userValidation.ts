import Joi from "joi";

export const userValidationSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string().required().messages({
    "string.base": "Password must be a string",
  }),

  phoneNumber: Joi.string()
    .pattern(new RegExp("^[0-9]{10,12}$"))
    .required()
    .messages({
      "string.pattern.base": "Phone number must be 10-12 digits",
    }),

  name: Joi.string().min(2).max(50).required(),
});
