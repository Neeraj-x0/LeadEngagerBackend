import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  phoneNumber: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  companyName: {
    type: String,
    default: "Axintract",
  },
  companyLogo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Media",
    required: true,
    default: "67b4a1b9458c0cfdd0053273",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const UserModel = mongoose.model("User", userSchema);
