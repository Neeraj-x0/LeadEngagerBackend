import { Types, Document } from 'mongoose';

// First, let's define a more precise ObjectId type
type MongoId = Types.ObjectId | string;

// Base interfaces with correct typing
export interface ILead extends Document {
  id: string;
  name: string;
  email: string;
  phone: string;
  user: MongoId;
  status: string;
  category: string;
  lastMessage?: MongoId;
  notes?: string;
  createdAt: Date;
}

export interface IMessage extends Document {
  content: Record<string, any>;
  key: Record<string, any>;
  type: string;
  receiver: MongoId;
  leadId: MongoId;
  engagementID?: MongoId;
  user: MongoId;
  reminder?: MongoId;
  messageSent: boolean;
  timestamp: Date;
}

export interface IReply extends Document {
  messageID: MongoId;
  reply: boolean;
  replyDate: Date;
  lead: MongoId;
  engagementID?: MongoId;
  user: MongoId;
}

// Define lean document types for transformed data
export type LeanMessage = Omit<IMessage, keyof Document>;
export type LeanReply = Omit<IReply, keyof Document>;
export type LeanLead = Omit<ILead, keyof Document>;

// Rest of the types remain the same...
export interface DailyEngagement {
  day: string;
  "New Leads": number;
  Engaged: number;
  Converted: number;
  rate: number;
}

export interface LeadAggregationResult {
  _id: string;
  newLeads: number;
  leadIds: Types.ObjectId[];
}

export type GetEngagementData = (
  userId: MongoId,
  startDate: Date,
  endDate: Date
) => Promise<DailyEngagement[]>;

export type GetWeeklyEngagementData = (
  userId: MongoId
) => Promise<DailyEngagement[]>;


export { MongoId };