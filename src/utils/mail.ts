import FormData from "form-data";
import Mailgun from "mailgun.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import { AppError } from "./errorHandler";
import { EmailModel } from "../models/EmailModel";
import fileType from "file-type";
import path from 'path';
import { renderBody } from "./functions";


type SendMailResponse = {
  id: string;
  message: string;
};

class MailService {
  private mg;
  private domain: string;
  private defaultFrom: string;

  constructor(userData: { email: string; name: string }) {
    if (!userData?.email || !userData?.name) {
      throw new AppError("User data with valid email is required", 400);
    }

    const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY;
    if (!MAILGUN_API_KEY) {
      throw new AppError("Mailgun API key not found", 500);
    }

    const mailgun = new Mailgun(FormData);
    this.mg = mailgun.client({ username: "api", key: MAILGUN_API_KEY });
    this.domain = "mail.neerajx0.xyz";
    this.defaultFrom = `${userData.name} <${userData.email}>`;
  }



private async sendViaMailgun(
    email: string,
    subject: string,
    body: string,
    data: Record<string, any>,
    bodyType: "html" | "text",
    fileBuffer?: Buffer
): Promise<SendMailResponse> {
    try {
        const renderedBody = renderBody(body, data, bodyType);
        const mailOptions: any = {
            from: this.defaultFrom,
            to: [email],
            subject,
            [bodyType]: renderedBody,
            template: "",
        };

        // Handle file buffer if provided
        if (fileBuffer) {
            // Detect file type from buffer
            const type = await fileType.fromBuffer(fileBuffer);
            
            if (!type) {
                throw new AppError("Unable to determine file type", 400);
            }

            // Extract filename from subject or generate one
            let filename = subject.trim();
            
            // Clean the filename of invalid characters
            filename = filename
                .replace(/[^a-zA-Z0-9-_\s.]/g, '') // Remove invalid chars
                .replace(/\s+/g, '_')              // Replace spaces with underscore
                .trim();

            // If filename is empty after cleaning, generate a default one
            if (!filename) {
                const timestamp = new Date().toISOString()
                    .replace(/[:.]/g, '-')
                    .replace('T', '_')
                    .slice(0, -5);
                filename = `attachment_${timestamp}`;
            }

            // Add extension if not present
            if (!filename.endsWith(`.${type.ext}`)) {
                filename = `${filename}.${type.ext}`;
            }

            mailOptions.attachment = {
                data: fileBuffer,
                filename: filename,
                contentType: type.mime,
            };

            // Check file size (25MB limit)
            const fileSizeInMB = fileBuffer.length / (1024 * 1024);
            if (fileSizeInMB > 25) {
                throw new AppError("File size exceeds 25MB limit", 400);
            }
        }

        const response = await this.mg.messages.create(this.domain, mailOptions);
        return { id: response.id || "", message: response.message || "" };
    } catch (error) {
        throw new AppError(
            `Mailgun Error: ${
                error instanceof Error ? error.message : String(error)
            }`,
            500
        );
    }
}

  private async sendViaGmail(
    email: string,
    subject: string,
    body: string,
    data: Record<string, any>,
    bodyType: "html" | "text"
  ): Promise<SendMailResponse> {
    try {
      const renderedBody = renderBody(body, data, bodyType);
      const transporter = nodemailer.createTransport({
        service: "gmail",
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: { user: process.env.NODE_USER, pass: process.env.NODE_PASS },
      });

      const mailOptions = {
        from: `Razominer <${process.env.NODE_USER}>`,
        to: email,
        subject,
        [bodyType]: renderedBody,
      };

      const response = await transporter.sendMail(mailOptions);
      return { id: response.messageId || "", message: "Email sent via Gmail" };
    } catch (error) {
      throw new AppError(
        `Gmail Error: ${
          error instanceof Error ? error.message : String(error)
        }`,
        500
      );
    }
  }

  async sendMail(
    email: string,
    subject: string,
    body: string,
    data: Record<string, any>,
    type: "mailgun" | "gmail" = "mailgun",
    bodyType: "html" | "text" = "html"
  ): Promise<SendMailResponse> {
    return type === "gmail"
      ? this.sendViaGmail(email, subject, body, data, bodyType)
      : this.sendViaMailgun(email, subject, body, data, bodyType);
  }

  async CreateEmail(data: {
    to: string;
    from: mongoose.Types.ObjectId;
    subject: string;
    body: string;
  }) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.to))
      throw new AppError("Invalid email format", 400);
    if (!mongoose.Types.ObjectId.isValid(data.from))
      throw new AppError("Invalid sender ID", 400);
    if (data.subject.length > 255) throw new AppError("Subject too long", 400);

    const newEmail = new EmailModel({ ...data, sentAt: new Date() });
    await newEmail.save();
    return {
      success: true,
      message: "Email created successfully",
      data: newEmail,
    };
  }

  async DeleteEmail(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id))
      throw new AppError("Invalid email ID", 400);
    const email = await EmailModel.findById(id);
    if (!email) throw new AppError("Email not found", 404);

    await EmailModel.findByIdAndDelete(id);
    return { success: true, message: "Email deleted successfully" };
  }
}

export default MailService;


