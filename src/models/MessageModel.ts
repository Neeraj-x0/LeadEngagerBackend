import mongoose from "mongoose";
import { CategoryModel, StatusModel } from "./Settings";

const messageSchema = new mongoose.Schema({
  content: {
    type: Object,
    required: true,
  },
  sender: {
    type: String,
    required: true,
  },
  receiver: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    ref: CategoryModel,
    validate: {
      validator: async function (value: string) {
        const category = await mongoose
          .model("Category")
          .findOne({ name: value });
        return category !== null;
      },
      message: "Category must exist in CategoryModel",
    },
  },

  status: {
    type: String,
    ref: StatusModel,
    validate: {
      validator: async function (value: string) {
        const status = await mongoose.model("Status").findOne({ name: value });
        return status !== null;
      },
      message: "Status must exist in StatusModel",
    },
  },
  engagementID: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Engagement",
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const MessageModel = mongoose.model("Message", messageSchema);

export  {MessageModel};