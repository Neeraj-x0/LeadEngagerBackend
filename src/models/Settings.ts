import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  description: String,
});


const statusSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
});


export const StatusModel = mongoose.model("Status", statusSchema);
export const CategoryModel = mongoose.model("Category", categorySchema);
