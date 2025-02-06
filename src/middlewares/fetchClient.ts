import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AppError } from "../utils/errorHandler";
import dotenv from "dotenv";
import { getLeadById } from "../database/leads";

dotenv.config();
interface CustomRequest extends Request {
  user?: string | JwtPayload;
  lead?: Object;
}

export const validateJWT = (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const { clientId } = req.body;

  try {
    if (!clientId) {
      return next();
    }
    const lead = getLeadById(clientId);
    if (!lead) {
      return next(new AppError("Unauthorized: Invalid token", 401));
    }
    req.lead = lead; // Attach user payload to request
    next();
  } catch (error) {
    return next(new AppError("Unauthorized: Invalid token", 401));
  }
};
