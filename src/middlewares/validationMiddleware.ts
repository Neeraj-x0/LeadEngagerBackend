import Joi from 'joi';
import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errorHandler';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    console.log(error);
    if (error) {
      const errorMessage = error.details[0].message.replace(/"/g, '');
      return next(new AppError(errorMessage, 400));
    }
    
    next();
  };
};