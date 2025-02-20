import { Request, Response, NextFunction } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { AppError } from "../utils/errorHandler";
import dotenv from "dotenv";
import { getLeadById } from "../database/leads";
import { UserModel } from "../models/UserModel";
import { Document } from "mongoose";

dotenv.config();

interface CustomRequest extends Request {
  user?: string | JwtPayload;
  lead?: Object;
}

export const validateJWT = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  // Only validate JWT if the request path starts with "/api".
  if (!req.path.includes("/api")) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.log("Unauthorized: No token provided");
    return next(new AppError("Unauthorized: No token provided", 401));
  }

  const clientId = req.headers["client-id"];
  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as Document & typeof UserModel;
    const user = await UserModel.findById(decoded.id);
    if (!user) {
      return next(new AppError("Unauthorized: Invalid token", 401));
    }
    req.user = user;

    if (clientId) {
      const clientIdStr = Array.isArray(clientId) ? clientId[0] : clientId;
      req.lead = await getLeadById(clientIdStr, (req.user as JwtPayload).id);
    }
    next();
  } catch (error) {
    return next(new AppError("Unauthorized: Invalid token", 401));
  }
};
