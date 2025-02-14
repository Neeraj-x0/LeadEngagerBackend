import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';

// Helper function for UTC date formatting
export const formatUTCDate = () => {
  const date = new Date();
  return date.toISOString().slice(0, 19).replace('T', ' ');
};

// Validation schemas using Joi
export const createEngagementSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Name is required',
    'any.required': 'Name is required'
  }),
  category: Joi.string().messages({
    'string.base': 'Category must be a string'
  }),
  status: Joi.string().messages({
    'string.base': 'Status must be a string'
  }),
  notes: Joi.string().allow('').optional().messages({
    'string.base': 'Notes must be a string'
  }),
  totalMessages : Joi.number().min(0).messages({
    'number.base': 'Total messages must be a number',
    'number.min': 'Total messages must be a positive number'
  }),
  replies: Joi.number().min(0).messages({
    'number.base': 'Replies must be a number',
    'number.min': 'Replies must be a positive number'
  })

}).custom((value, helpers) => {
  if (!value.category && !value.status) {
    return helpers.error('custom.either', { message: 'Either category or status is required' });
  }
  return value;
});

export const updateEngagementSchema = Joi.object({
  name: Joi.string().optional(),
  category: Joi.string().optional(),
  status: Joi.string().optional(),
  notes: Joi.string().allow('').optional(),
  totalMessages: Joi.number().min(0).optional(),
  replies: Joi.number().min(0).optional()
});

// Validation middleware
export const validateEngagement = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errorMessage = error.details
        .map((detail) => detail.message)
        .join(', ');
      
      return res.status(400).json({
        status: "error",
        message: errorMessage
      });
    }
    
    next();
  };
};