import { Document } from 'mongoose';

export enum MessageType {
  MANUAL = 'MANUAL',
  AUTOMATED = 'AUTOMATED',
  CAMPAIGN = 'CAMPAIGN'
}

export enum CommunicationChannel {
  WHATSAPP = 'WHATSAPP',
  EMAIL = 'EMAIL',
  SMS = 'SMS'
}

export enum ReminderFrequency {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY'
}

export interface Attachment {
  type: string;
  url: string;
  name: string;
}

export interface EngagementMessage {
  _id?: string;
  leadId: string;
  content: string;
  type: MessageType;
  channel: CommunicationChannel;
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
  attachments?: Attachment[];
  sentAt: Date;
  customFields?: Record<string, string>;
}

export interface Reminder {
  _id?: string;
  leadId: string;
  title: string;
  description?: string;
  scheduledAt: Date;
  frequency?: ReminderFrequency;
  category?: string;
  notificationSent: boolean;
}

export interface Campaign {
  _id?: string;
  name: string;
  description?: string;
  channel: CommunicationChannel;
  messages: EngagementMessage[];
  startDate: Date;
  endDate?: Date;
  status: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'PAUSED';
}