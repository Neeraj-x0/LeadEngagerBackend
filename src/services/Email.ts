import FormData from "form-data";
import Mailgun, { MailgunMessageData } from "mailgun.js";
import nodemailer from "nodemailer";
import mongoose from "mongoose";
import { AppError } from "../utils/errorHandler";
import { EmailModel } from "../models/EmailModel";
import fileType from "file-type";
import { renderBody } from "../utils/functions";
import { LeadModel } from "../models/LeadModel";
import { logError } from "../utils/logger";
import { EngagementModel } from "../models";

// Define clear interfaces for better type safety
interface UserData {
  email: string;
  name: string;
}



interface SendMailResponse {
  id: string;
  message: string;
}

interface EmailData {
  engagementID: string;
  to: string[];
  from: mongoose.Types.ObjectId;
  subject: string;
  body: string;
}

class MailService {
  private readonly mg;
  private readonly domain: string;
  private readonly defaultFrom: string;
  private readonly transporter;
  private static readonly MAX_FILE_SIZE_MB = 25;
  private static readonly EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  constructor(userData: UserData) {
    this.validateUserData(userData);
    this.validateEnvironment();
    const mailgun = new Mailgun(FormData);
    this.mg = mailgun.client({
      username: "api",
      key: process.env.MAILGUN_API_KEY!
    });
    this.domain = "mail.neerajx0.xyz";
    const domainParts = this.domain.split(".");
    const baseDomain = domainParts.length > 1 ? domainParts.slice(-2).join(".") : this.domain;
    this.defaultFrom = `${userData.name} <marketing@${baseDomain}>`;
    this.transporter = this.createNodemailerTransport();
  }

  private validateUserData(userData: UserData): void {
    if (!userData?.email || !userData?.name) {
      throw new AppError("User data with valid email is required", 400);
    }
  }

  private validateEnvironment(): void {
    if (!process.env.MAILGUN_API_KEY) {
      throw new AppError("Mailgun API key not found", 500);
    }
    if (!process.env.NODE_USER || !process.env.NODE_PASS) {
      throw new AppError("Gmail credentials not found", 500);
    }
  }
  private createNodemailerTransport() {
    return nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.NODE_USER,
        pass: process.env.NODE_PASS
      }
    });
  }

  private validateFileSize(size: number): void {
    const fileSizeInMB = size / (1024 * 1024);
    if (fileSizeInMB > MailService.MAX_FILE_SIZE_MB) {
      throw new AppError(`File size exceeds ${MailService.MAX_FILE_SIZE_MB}MB limit`, 400);
    }
  }

  private async sendViaMailgun(
    email: string[],
    subject: string,
    body: string,
    data: Record<string, any>,
    bodyType: "html" | "text",
    file?: Express.Multer.File
  ): Promise<SendMailResponse> {
    try {
      console.log("Sending via Mailgun");

      const mailOptions: Record<string, any> = {
        from: this.defaultFrom,
        to: email,
        subject,
        [bodyType]: renderBody(body, data, bodyType)
      };

      // Handle case with file attachment
      if (file) {
        let attachmentData: Buffer;

        // Validate and process file buffer
        if (Buffer.isBuffer(file.buffer)) {
          attachmentData = file.buffer;
        } else if (file.buffer) {
          attachmentData = Buffer.from(file.buffer);
        } else {
          throw new AppError("Invalid file buffer provided", 400);
        }

        this.validateFileSize(file.size);

        const messageData = {
          ...mailOptions,
          attachment: {
            data: attachmentData,
            filename: file.originalname
          },
          template: ""
        };

        const response = await this.mg.messages.create(this.domain, messageData);
        return {
          id: response.id || "",
          message: response.message || ""
        };
      }

      // Handle case without file attachment
      const response = await this.mg.messages.create(
        this.domain,
        mailOptions as MailgunMessageData
      );

      console.log("Mailgun response:", response);
      return {
        id: response.id || "",
        message: response.message || ""
      };

    } catch (error) {
      logError('Mailgun', 'Failed to send email', error);
      throw new AppError(
        `Mailgun Error: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }
  private async sendViaGmail(
    email: string[],
    subject: string,
    body: string,
    data: Record<string, any>,
    bodyType: "html" | "text",
    fileBuffer?: Buffer
  ): Promise<SendMailResponse> {
    try {

      console.log("Sending via Gmail");
      const mailOptions: Record<string, any> = {
        from: `Razominer <${process.env.NODE_USER}>`,
        to: email.join(","),
        subject,
        [bodyType]: renderBody(body, data, bodyType)
      };

      if (fileBuffer) {
        const attachment = await this.processFileAttachment(fileBuffer, subject);
        if (attachment) {
          mailOptions.attachments = [attachment];
        }
      }

      const response = await this.transporter.sendMail(mailOptions);
      await this.CreateEmail({
        to: email,
        from: data.from,
        subject,
        body,
        engagementID: data.engagementID
      });
      return { id: response.messageId || "", message: "Email sent via Gmail" };
    } catch (error) {
      throw new AppError(
        `Gmail Error: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  private async processFileAttachment(fileBuffer: Buffer, subject: string) {
    const type = await fileType.fromBuffer(fileBuffer);
    if (!type) {
      throw new AppError("Unable to determine file type", 400);
    }

    this.validateFileSize(fileBuffer.length);

    const filename = this.generateFilename(subject, type.ext);
    return {
      filename,
      data: Buffer.from(fileBuffer)
    };
  }

  private generateFilename(subject: string, extension: string): string {
    let filename = subject
      .trim()
      .replace(/[^a-zA-Z0-9-_\s.]/g, "")
      .replace(/\s+/g, "_")
      .trim();

    if (!filename) {
      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .replace("T", "_")
        .slice(0, -5);
      filename = `attachment_${timestamp}`;
    }

    return filename.endsWith(`.${extension}`) ? filename : `${filename}.${extension}`;
  }

  async sendMail(
    email: string[],
    subject: string,
    body: string,
    data: Record<string, any>,
    type: "mailgun" | "gmail" = "mailgun",
    bodyType: "html" | "text" = "html",
    file?: Express.Multer.File
  ): Promise<SendMailResponse> {
    if (file) {

      console.log("Sending Mail with attachment");
      console.log(file);
    } else {
      console.log("Sending Mail");
      console.log({ email, subject, body, data, type, bodyType });
    }
    return type === "gmail"
      ? this.sendViaGmail(email, subject, body, data, bodyType, file?.buffer)
      : this.sendViaMailgun(email, subject, body, data, bodyType, file);
  }

  async CreateEmail(data: EmailData) {
    try {
      this.validateEmailData(data);

      // Fetch all leads in one query
      const leads = await LeadModel.find({
        email: { $in: data.to }
      }).select('email _id');

      // Create a map for quick lookup
      const leadMap = new Map(
        leads.map(lead => [lead.email, lead._id])
      );

      const emailsToSave = data.to.map(toEmail => ({
        ...data,
        to: toEmail,
        receiver: leadMap.get(toEmail) || null,
        user: data.from,
        engagementID: data.engagementID,
        timestamp: new Date()
      }));

      if (data.engagementID) {
        await EngagementModel.findOneAndUpdate({ _id: data.engagementID }, { lastMessage: new Date() })
      }
      const newEmails = await EmailModel.insertMany(emailsToSave, { ordered: false });
      return {
        success: true,
        message: "Emails created successfully",
        data: newEmails
      };
    } catch (error) {
      console.error("Error creating emails:", error);
      throw new AppError(
        `Failed to create emails: ${error instanceof Error ? error.message : String(error)}`,
        500
      );
    }
  }

  private validateEmailData(data: EmailData): void {
    if (!data.to.every((email) => MailService.EMAIL_REGEX.test(email))) {
      throw new AppError("Invalid email format", 400);
    }
    console.log(data);
    if (!mongoose.Types.ObjectId.isValid(data.from)) {
      throw new AppError("Invalid sender ID", 400);
    }
    if (data.subject.length > 255) {
      throw new AppError("Subject too long", 400);
    }
  }

  async DeleteEmail(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid email ID", 400);
    }

    const email = await EmailModel.findByIdAndDelete(id);
    if (!email) {
      throw new AppError("Email not found", 404);
    }

    return { success: true, message: "Email deleted successfully" };
  }
}

export default MailService;