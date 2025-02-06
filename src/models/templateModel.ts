import mongoose from "mongoose";

const templateModel = new mongoose.Schema({
  content: {
    type: String,
    required: true,
  },
});

export const TemplateModel = mongoose.model("Template", templateModel);