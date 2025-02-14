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

export const validateJWT = async (
  req: CustomRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized: No token provided", 401));
  }

  const clientId = req.headers["client-id"];

  const token = authHeader.split(" ")[1];

  try {
  

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string);
    req.user = decoded; // Attach user payload to request
    if (clientId) {
      const clientIdStr = Array.isArray(clientId) ? clientId[0] : clientId;
      req.lead = await getLeadById(clientIdStr, (req.user as JwtPayload).id);
    }
    next();
  } catch (error) {
    return next(new AppError("Unauthorized: Invalid token", 401));
  }
};
