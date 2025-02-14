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
    mediaType: "image" | "video" | "audio" | "sticker" | "document";
    caption?: string;
    viewOnce?: boolean;
    type?: string;
    fileName?: string;
    mimetype?: string;
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

// Extend existing types to support buffer
export interface MediaContent {
  url?: string;
  buffer?: Buffer;
}

export interface MediaOptions {
  fileName?: string;
  caption?: string;
  viewOnce?: boolean;
  packname?: string;
  mimetype?: string;
  author?: string;
  
}

export interface MediaRequest extends WhatsAppBaseRequest {
  body: {
    caption?: string;
    viewOnce?: boolean;
    mediaType: "image" | "video" | "audio" | "sticker" | "document";
    type?: string;
    fileName?: string;
    mimetype?: string;
  };
  file?: Express.Multer.File;
}

export interface WhatsAppMessageContent {
  text?: string;
  image?: MediaContent;
  video?: MediaContent;
  audio?: MediaContent;
  sticker?: MediaContent;
  document?: MediaContent;
  caption?: string;
  viewOnce?: boolean;
  fileName?: string;
  mimetype?: string;
}

// Additional WhatsApp message types
export interface WhatsAppMessageTypes {
  WhatsAppMessageContent: WhatsAppMessageContent;
}
