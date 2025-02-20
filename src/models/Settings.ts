import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true, 
  },
});

const statusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  description: String,
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

export const StatusModel = mongoose.model("Status", statusSchema);
export const CategoryModel = mongoose.model("Category", categorySchema);
