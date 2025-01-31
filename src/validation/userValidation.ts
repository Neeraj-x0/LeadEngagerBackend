import Joi from 'joi';

export const userCreateSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(3)
    .max(30)
    .required(),
  
  email: Joi.string()
    .email()
    .required(),
  
  password: Joi.string()
    .pattern(new RegExp('^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d]{8,}$'))
    .required()
    .messages({
      'string.pattern.base': 'Password must be at least 8 characters, contain letters and numbers'
    })
});


