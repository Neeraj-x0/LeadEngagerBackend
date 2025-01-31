import mongoose from 'mongoose';
import { MessageType ,CommunicationChannel} from '../types/engagement';

const engagementMessageSchema = new mongoose.Schema({
  leadId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Lead', 
    required: true 
  },
  content: { 
    type: String, 
    required: true 
  },
  type: { 
    type: String, 
    enum: Object.values(MessageType), 
    required: true 
  },
  channel: { 
    type: String, 
    enum: Object.values(CommunicationChannel), 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['SENT', 'DELIVERED', 'READ', 'FAILED'], 
    default: 'SENT' 
  },
  attachments: [{
    type: { type: String },
    url: { type: String },
    name: { type: String }
  }],
  sentAt: { 
    type: Date, 
    default: Date.now 
  },
  customFields: {
    type: Map, 
    of: String 
  }
});

export const EngagementMessageModel = mongoose.model('EngagementMessage', engagementMessageSchema);