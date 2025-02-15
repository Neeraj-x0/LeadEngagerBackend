import mongoose from "mongoose";
import { CategoryModel, StatusModel } from "./Settings";
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
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  status: {
    type: String,
    ref: StatusModel,
    validate: {
      validator: async function (this: any, value: string) {
        const status = await mongoose.model("Status").findOne({
          name: value,
          user: this.user,
        });
        return status !== null;
      },
    },
  },
  category: {
    type: String,
    ref: "Category", // Reference to Category collection
    validate: {
      validator: async function (this: any, value: string): Promise<boolean> {
        const category = await mongoose
          .model("Category")
          .findOne({ name: value, user: this.user });
        return category !== null;
      },
      message: "Category must exist in CategoryModel",
    },
  },
  lastMessage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Message",
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const LeadModel = mongoose.model("Leads", leadModelSchema);
