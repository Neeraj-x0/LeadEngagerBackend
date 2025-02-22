import mongoose, { Document, Schema } from "mongoose";
import { MessageModel } from "./MessageModel";
import { IEngagement } from "../interfaces/IEngagement";

// Define an interface for the Engagement document

// Define the Engagement schema
const EngagementSchema = new Schema<IEngagement>({
  name: String,
  notes: String,
  lastMessage: Date,
  category: {
    type: String,
    ref: "Category", // Reference to Category collection
    validate: {
      validator: async function (this: any, value: string): Promise<boolean> {
        const category = await mongoose
          .model("Category")
          .findOne({ name: value });
        return category !== null;
      },
      message: "Category must exist in CategoryModel",
    },
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },

  status: {
    type: String,
    ref: "Status", // Reference to Status collection
    validate: {
      validator: async function (this: any, value: string): Promise<boolean> {
        const status = await mongoose.model("Status").findOne({ name: value, user: this.user });
        return status !== null;
      },
      message: "Status must exist in StatusModel",
    },
  },

  messages: {
    type: [
      {
        type: Schema.Types.ObjectId,
        ref: "Message", // Reference to Message collection
        validate: {
          validator: async function (
            this: any,
            value: mongoose.Types.ObjectId
          ): Promise<boolean> {
            const parent = this.parent();
            const query: Record<string, any> = { engagementID: value };
            if (parent && parent.category) {
              query.category = parent.category;
            }
            if (parent && parent.status) {
              query.status = parent.status;
            }
            const message = await MessageModel.findOne(query);
            return message !== null;
          },
          message:
            "Message must exist and match the engagement category and status",
        },
      },
    ],
    default: [],
  },

  timestamp: {
    type: Date,
    default: Date.now,
  },

  totalMessages: {
    type: Number,
    default: 0,
  },

  replies: {
    type: Number,
    default: 0,
  },
});

export const EngagementModel = mongoose.model<IEngagement>(
  "Engagement",
  EngagementSchema
);
