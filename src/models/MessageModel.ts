import mongoose from "mongoose";

const messageSchema = new mongoose.Schema({
  content: {
    type: Object,
    required: true,
  },
  key: {
    type: Object,
    required: true,
  },
  type: {
    type: String,
    required: true,
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead",
    required: true,
  },
  leadId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead",
  },
  engagementID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engagement",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  reminder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Reminder",
  },
  messageSent: {
    type: Boolean,
    default: true,
  },
  timestamp: {
    type: Date,
    default: Date.now(),
  },
});

const MessageModel = mongoose.model("Message", messageSchema);

export { MessageModel };
