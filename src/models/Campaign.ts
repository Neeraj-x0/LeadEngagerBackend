import mongoose from "mongoose";
import { CommunicationChannel } from "../types/engagement";

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  channel: {
    type: String,
    enum: Object.values(CommunicationChannel),
    required: true,
  },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EngagementMessage",
    },
  ],
  startDate: {
    type: Date,
    default: Date.now,
  },
  endDate: Date,
  status: {
    type: String,
    enum: ["DRAFT", "ACTIVE", "COMPLETED", "PAUSED"],
    default: "DRAFT",
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

export const CampaignModel = mongoose.model("Campaign", campaignSchema);
