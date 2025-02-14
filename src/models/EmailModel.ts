import mongoose from "mongoose";

const emailSchema = new mongoose.Schema({
  to: {
    type: String,
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  subject: {
    type: String,
    required: true,
  },
  body: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: ["text", "html"],
    default: "text",
  },
  sentAt: {
    type: Date,
    default: Date.now,
  },
});

export const EmailModel = mongoose.model("Email", emailSchema);
