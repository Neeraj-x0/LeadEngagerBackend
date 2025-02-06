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
    default: "Company Name",
  },
  companyLogo: {
    type: String,
    default:
      "https://res.cloudinary.com/dyfhbqtjm/image/upload/f_auto,q_auto/sg1ufdsz8ww9mccikyc5",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export const UserModel = mongoose.model("User", userSchema);
