import mongoose from "mongoose";

const replySchema = new mongoose.Schema({
  messageID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
    required: true
  },
  reply: {
    type: Boolean,
    default: true
  },
  replyDate: {
    type: Date,
    required: true,
    default: Date.now()
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lead",
    required: true
  },
  engagementID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engagement",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
});

const ReplyModel = mongoose.model("Reply", replySchema);

export { ReplyModel };