import mongoose from "mongoose";

const categorySchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
  },
  description: String,
});

export const CategoryModel = mongoose.model("Category", categorySchema);