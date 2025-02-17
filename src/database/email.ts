import mongoose from "mongoose";
import { EmailModel } from "../models/EmailModel";

interface IEmailCreate {
  to: string;
  from: mongoose.Types.ObjectId;
  subject: string;
  body: string;
}

interface IEmailResponse {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

/**
 * Creates a new email record in the database
 */


export const CreateEmail = async (
  data: IEmailCreate
): Promise<IEmailResponse> => {
  try {
    const { to, from, subject, body } = data;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return {
        success: false,
        message: "Invalid email format",
        error: "Email validation failed",
      };
    }

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(from)) {
      return {
        success: false,
        message: "Invalid sender ID format",
        error: "Invalid ObjectId",
      };
    }

    // Check subject length
    if (subject.length > 255) {
      return {
        success: false,
        message: "Subject exceeds maximum length of 255 characters",
        error: "Validation error",
      };
    }

    // Check if sender exists
    const senderExists = await mongoose.model("User").findById(from);
    if (!senderExists) {
      return {
        success: false,
        message: "Sender not found",
        error: "Invalid sender ID",
      };
    }

    // Create and save email
    const newEmail = new EmailModel({
      to,
      from,
      subject,
      body,
      timestamp: new Date(),
    });
    await newEmail.save();

    return {
      success: true,
      message: "Email created successfully",
      data: { id: newEmail._id, to, subject, sentAt: newEmail.timestamp },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to create email",
      error: error.message,
    };
  }
};

/**
 * Deletes an email record from the database
 */
export const DeleteEmail = async (
  id: string,
  userId: string
): Promise<IEmailResponse> => {
  try {
    // Validate the email ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return {
        success: false,
        message: "Invalid email ID format",
        error: "Invalid ObjectId",
      };
    }

    // Find the email
    const email = await EmailModel.findById(id);
    if (!email) {
      return {
        success: false,
        message: "Email not found",
        error: "Resource not found",
      };
    }

    if (!email.user) {
      return {
        success: false,
        message: "Email sender not found",
        error: "Resource not found",
      };
    }

    // Check if the user is authorized to delete
    if (email.user.toString() !== userId) {
      return {
        success: false,
        message: "Unauthorized to delete this email",
        error: "Permission denied",
      };
    }

    // Perform the deletion
    await EmailModel.findByIdAndDelete(id);

    return {
      success: true,
      message: "Email deleted successfully",
      data: { id, deletedAt: new Date() },
    };
  } catch (error: any) {
    return {
      success: false,
      message: "Failed to delete email",
      error: error.message,
    };
  }
};
