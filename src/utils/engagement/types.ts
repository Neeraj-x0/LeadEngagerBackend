import { Request } from "express";

// Types for better type safety
interface UserRequest extends Request {
    user: {
        id: string;
        email: string;
        name: string;
        phoneNumber: string;
        companyName: string;
        companyLogo: string;
    };
}


interface SendMessageRequest {
    type?: "mailgun" | "gmail";
    emailSubject?: string;
    emailData: { title: string; note: string, from: string, engagementID: string },
    emailBodyType?: 'html' | 'text';
    mediaType?: "text" | "image" | "video" | "audio" | "sticker";
    customHTML?: string;
    message?: string | Buffer;
    channels: string;
    templateId?: string;
    poster: { title: string, note: string },
    caption?: string;
}

interface ChannelResult {
    status: 'success' | 'error';
    result?: any;
    error?: string;
}

interface WhatsAppResult extends ChannelResult {
    phone: string;
}

interface EmailResult extends ChannelResult {
    email: string;
}

interface ProcessResults {
    whatsapp: WhatsAppResult[];
    email: EmailResult[];
}

interface EmailAttachment {
    buffer: Buffer;
    size: number;
    originalname: string;
}


export interface ProcessedJob {
  channel: string;
  jobId: string;
  statusEndpoint: string;
}

export interface MediaOptions {
  caption?: string;
  fileName?: string;
  mimetype?: string;
  [key: string]: any;
}

export interface PosterData {
  title: string;
  note: string;
  iconId: string;
  backgroundId?: string;
}

export interface WhatsAppData {
  leads: any[];
  message: string | Buffer;
  mediaOptions: MediaOptions;
  mediaType: string;
  userId: string;
  engagementId: string;
}

export { UserRequest,  SendMessageRequest, ChannelResult, WhatsAppResult, EmailResult, ProcessResults, EmailAttachment };