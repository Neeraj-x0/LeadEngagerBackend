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

interface MediaOptions {
    caption?: string;
    fileName?: string;
    mimetype?: string;
}

interface SendMessageRequest {
    type?: "mailgun" | "gmail";
    emailSubject?: string;
    emailData?: any;
    emailBodyType?: 'html' | 'text';
    mediaType?: "text" | "image" | "video" | "audio" | "sticker";
    customHTML?: string;
    message?: string | Buffer;
    channels: string;
    templateId?: string;
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




export { UserRequest, MediaOptions, SendMessageRequest, ChannelResult, WhatsAppResult, EmailResult, ProcessResults,EmailAttachment };