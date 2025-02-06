import Joi from "joi";

export const userValidationSchema = Joi.object({
  email: Joi.string().email().required(),

  password: Joi.string()
    .pattern(new RegExp("^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$"))
    .required()
    .messages({
      "string.pattern.base":
        "Password must be at least 8 characters, contain letters and numbers",
    }),

  phoneNumber: Joi.string()
    .pattern(new RegExp("^[0-9]{10}$"))
    .required()
    .messages({
      "string.pattern.base": "Phone number must be 10 digits",
    }),

  name: Joi.string().min(2).max(50).required(),
});


