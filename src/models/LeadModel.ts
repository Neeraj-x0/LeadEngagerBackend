import mongoose from "mongoose";

const leadModelSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["ACTIVE", "DEAD", "NEW"],
    default: "NEW",
  },
  category: {
    type: String,
    default: "GENERAL",
  },
  customFields: {
    type: Map,
    of: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const LeadModel = mongoose.model("Leads", leadModelSchema);
