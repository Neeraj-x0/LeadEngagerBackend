import mongoose from 'mongoose';
import { ReminderFrequency } from '../types/engagement';

const reminderSchema = new mongoose.Schema({
  leadId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Lead', 
    required: true 
  },
  title: { 
    type: String, 
    required: true 
  },
  description: String,
  scheduledAt: { 
    type: Date, 
    required: true 
  },
  frequency: { 
    type: String, 
    enum: Object.values(ReminderFrequency) 
  },
  category: String,
  notificationSent: { 
    type: Boolean, 
    default: false 
  }
});

export const ReminderModel = mongoose.model('Reminder', reminderSchema);
