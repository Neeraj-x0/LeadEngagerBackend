import mongoose,{Document} from "mongoose";

export interface IEngagement extends Document {
  category?: string;
  status?: string;
  messages: mongoose.Types.ObjectId[];
  timestamp: Date;
  totalMessages: number;
  replies: number;
  name: string;
  notes?: string;
  lastMessage?: Date;
  user: mongoose.Types.ObjectId;
}
