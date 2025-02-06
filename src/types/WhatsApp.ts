import { Request, Response } from "express";

// Base interfaces
export interface WhatsAppBaseRequest extends Request {
  body: {};
  lead: {
    id: string;
    name: string;
    email: string;
    phone: string;
    status: string;
    category: string;
    notes?: string;
    createdAt: Date;
  };
}

export interface WhatsAppResponse {
  success: boolean;
  message: string;
}

// Message-specific request interfaces
export interface TextMessageRequest extends WhatsAppBaseRequest {
  body: {
    message: string;
  };
}

export interface LocationRequest extends WhatsAppBaseRequest {
  body: {
    latitude: number;
    longitude: number;
  };
}

export interface FFmpegError {
  message: string;
  code: number;
}

export interface ContactRequest extends WhatsAppBaseRequest {
  body: {
    contactName: string;
    contactNumber: string;
    organization?: string;
  };
}

export interface MediaRequest extends WhatsAppBaseRequest {
  body: {
    caption?: string;
    viewOnce?: boolean;
  };
}

export interface ImageRequest extends MediaRequest {
  body: MediaRequest["body"] & {
    imageUrl: string;
  };
}

export interface VideoRequest extends MediaRequest {
  body: MediaRequest["body"] & {
    videoUrl: string;
    gifPlayback?: boolean;
  };
}

export interface AudioRequest extends WhatsAppBaseRequest {
  body: {
    audioUrl: string;
  };
}

// WhatsApp connection types
export interface ConnectionUpdate {
  connection: "close" | "open" | string;
  lastDisconnect?: {
    error: Error;
    date: Date;
  };
}

// Middleware types
export type WhatsAppMiddleware = (
  req: WhatsAppBaseRequest,
  res: Response,
  next: (error?: any) => void
) => void | Promise<void>;

// Socket type
export interface WhatsAppSocket {
  sendMessage: (jid: string, content: any) => Promise<any>;
  ev: {
    on: (event: string, callback: (data: any) => void) => void;
  };
  relayMessage?: (jid: string, message: any, options: any) => Promise<any>;
}

// Extend existing types to support buffer
export interface MediaContent {
  url?: string;
  buffer?: Buffer;
}

export interface MediaOptions {
  caption?: string;
  viewOnce?: boolean;
  packname?: string;
  author?: string;
}

export interface MediaRequest extends WhatsAppBaseRequest {
  body: {
    caption?: string;
    viewOnce?: boolean;
  };
  file?: Express.Multer.File;
}

export interface WhatsAppMessageContent {
  text?: string;
  image?: MediaContent;
  video?: MediaContent;
  audio?: MediaContent;
  sticker?: MediaContent;
  caption?: string;
  viewOnce?: boolean;
  mimetype?: string;
}

// Additional WhatsApp message types
export interface WhatsAppMessageTypes {
  WhatsAppMessageContent: WhatsAppMessageContent;
}
