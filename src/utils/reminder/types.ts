import { MediaOptions } from "../../types/WhatsApp";

// First, let's thoughtfully define our foundational domain interfaces...
interface ReminderDomain {
  title: string;
  description: string;
  scheduledAt: string;
  frequency: 'daily' | 'weekly' | 'monthly';
}

interface WhatsAppDomain {
  message?: string;
  caption?: string;
}

interface EmailDomain {
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

interface PosterDomain {
  title: string;
  note: string;
}

// Now, let's consider the user data structure...
export interface UserData {
  _id: string;
  email: string;
  password: string;
  phoneNumber: string;
  name: string;
  companyName: string;
  companyLogo: string;
  createdAt: string;
}

// The params interface seems straightforward, but let's examine it carefully...
export interface ParsedParams {
  id: string;
}

// The core message structure that encapsulates our domains...
export interface ParsedMessageRequest {
  reminder: ReminderDomain;
  whatsapp: WhatsAppDomain;
  email: EmailDomain;
  poster: PosterDomain;
}

// Finally, let's bring it all together in our request interface...
export interface ParsedRequest {
  body: ParsedMessageRequest;
  user: UserData;
  params: ParsedParams;
  files?: Express.Multer.File | Express.Multer.File[] | { [fieldname: string]: Express.Multer.File[] };
}

export interface WhatsAppContent {
  message: string | Buffer;
  caption: string;
  mediaOptions: Partial<MediaOptions>;
}

export interface EmailContent {
  type: string;
  emailSubject: string;
  emailBodyType: string;
  emailData: any;
  customHTML: string;
  file?: Express.Multer.File;
}