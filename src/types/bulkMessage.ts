import { Request } from "express";

export interface Recipient {
  phone?: string;
  email?: string;
  name?: string;
}

export interface BulkMessageRequest extends Request {
  body: {
    channel: "email" | "whatsapp" | "both";
    body: string;
    subject?: string;
    recipients: Recipient[];
    category: string;
    status: string;
  };
  user: {
    email: string;
    name: string;
  };
  file?: Express.Multer.File;
}
