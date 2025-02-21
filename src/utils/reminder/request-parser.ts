import { ParsedRequest, UserData, ParsedParams } from './types';
import { Express } from 'express';

// First, let's thoughtfully define our domain interfaces...
export interface ReminderDomain {
  title: string;
  description: string;
  scheduledAt: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
}

export interface WhatsAppDomain {
  message?: string;
  caption?: string;
}

export interface EmailDomain {
  template: string;
  templateId?: string;
  emailData: {
    title: string;
    note: string;
  };
  subject?: string;
  bodyType?: 'text' | 'html';
  serviceType?: string;
  customHTML?: string;
}

export interface PosterDomain {
  title: string;
  note: string;
}

// Now, let's redefine our message structure...
export interface DomainStructuredMessage {
  reminder: ReminderDomain;
  whatsapp: WhatsAppDomain;
  email: EmailDomain;
  poster: PosterDomain;
}

export class RequestParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RequestParsingError';
  }
}

export function parseRequest(req: any): ParsedRequest {
  try {
    return {
      body: parseBody(req.body),
      user: parseUser(req.user),
      params: parseParams(req.params),
      files: validateFiles(req.files)
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new RequestParsingError(`Failed to parse request: ${error.message}`);
    }
    throw new RequestParsingError('Failed to parse request: Unknown error');
  }
}




function parseBody(rawBody: any): DomainStructuredMessage {
  try {
    const body = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    // Let's carefully construct each domain...
    const reminder: ReminderDomain = {
      title: body.title || '',
      description: body.description || '',
      scheduledAt: body.scheduledAt || '',
      frequency: validateFrequency(body.frequency)
    };

    const whatsapp: WhatsAppDomain = {
      message: body.message,
      caption: body.caption
    };

    const email: EmailDomain = {
      template: body.emailTemplate || '',
      emailData: {
        title: body.poster?.title || '',
        note: body.poster?.note || ''
      },
      subject: body.emailSubject,
      bodyType: body.emailBodyType,
      serviceType: body.emailServiceType,
      customHTML: body.customHTML
    };

    const poster: PosterDomain = parsePoster(body.poster);

    // Return our cleanly structured domains
    return {
      reminder,
      whatsapp,
      email,
      poster
    };
  } catch (error) {
    throw new Error(`Invalid body format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function validateFrequency(frequency: any): 'daily' | 'weekly' | 'monthly' | 'once' {
  if (!['daily', 'weekly', 'monthly', 'once'].includes(frequency)) {
    throw new Error('Invalid frequency value');
  }
  return frequency;
}

function parsePoster(posterRaw: any): PosterDomain {
  try {
    const posterData = typeof posterRaw === 'string' ? JSON.parse(posterRaw) : posterRaw;

    return {
      title: posterData?.title || '',
      note: posterData?.note || ''
    };
  } catch (error) {
    return { title: '', note: '' };
  }
}

function parseUser(rawUser: any): UserData {
  try {
    const user = typeof rawUser === 'string' ? JSON.parse(rawUser) : rawUser;

    if (!user?._id || !user?.email || !user?.name) {
      throw new Error('Missing required user fields');
    }

    return {
      _id: user._id,
      email: user.email,
      password: user.password,
      phoneNumber: user.phoneNumber,
      name: user.name,
      companyName: user.companyName,
      companyLogo: user.companyLogo,
      createdAt: user.createdAt,
    };
  } catch (error) {
    throw new Error(`Invalid user format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseParams(rawParams: any): ParsedParams {
  try {
    const params = typeof rawParams === 'string' ? JSON.parse(rawParams) : rawParams;

    if (!params?.id) {
      throw new Error('Missing id in params');
    }

    return { id: params.id };
  } catch (error) {
    throw new Error(`Invalid params format: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function validateFiles(files: any): ParsedRequest['files'] | undefined {
  if (!files) return undefined;

  if (Array.isArray(files)) {
    return files as Express.Multer.File[];
  }

  if (typeof files === 'object' && files.buffer) {
    return files as Express.Multer.File;
  }

  if (typeof files === 'object') {
    return files as { [fieldname: string]: Express.Multer.File[] };
  }

  return undefined;
}