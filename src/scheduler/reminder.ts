import { Queue, Worker, Job } from "bullmq";
import { ReminderModel } from "../models/Reminder";
import { LeadModel } from "../models/LeadModel";
import { EngagementModel } from "../models/engagementModel";
import { getLeadsByCategory } from "../database/leads";
import { messageHandler } from "../services/WhatsApp";
import { validatePhone } from "../utils/functions";
import MailService from "../services/Email";
import { UserModel } from "../models/UserModel";
import { AppError } from "../utils/errorHandler";
import Redis from "ioredis";
import moment from "moment-timezone";
import mongoose from "mongoose";

// Set default timezone
moment.tz.setDefault("Asia/Kolkata");

// Types for better type safety and clarity
interface Recipients {
  phoneNumbers: string[];
  emailAddresses: string[];
}

interface ReminderContent {
  messageContent?: any;
  emailContent?: {
    emailSubject: string;
    emailBodyType: string;
    customHTML: string;
    type: string;
    file?: any;
  };
  engagementId: mongoose.Types.ObjectId;
  leadId: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  _id: mongoose.Types.ObjectId;
}

class ReminderScheduler {
  private reminderQueue!: Queue;
  private redisConnection: Redis = new Redis;
  private static instance: ReminderScheduler;

  private constructor() {
    this.initializeRedisConnection();
    this.initializeQueue();
    this.initializeWorker();
  }

  private initializeRedisConnection(): void {
    this.redisConnection = new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: null,
    });
  }

  private initializeQueue(): void {
    this.reminderQueue = new Queue("reminders", {
      connection: this.redisConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
      },
    });
  }

  private initializeWorker(): void {
    const worker = new Worker(
      "reminders",
      this.processReminder.bind(this),
      { connection: this.redisConnection }
    );
    worker.on("failed", this.handleJobFailure.bind(this));
  }

  private async processReminder(job: Job): Promise<void> {
    const reminder = job.data.reminder;
    console.log(`Processing reminder ${reminder._id} [${reminder.title}]`);

    try {
      const recipients = await this.getRecipients(reminder);
      await this.sendNotifications(reminder, recipients);
      await this.updateReminderStatus(reminder);
    } catch (error) {
      console.error(`Failed to process reminder ${reminder._id}:`, error);
      throw error;
    }
  }

  private async sendNotifications(reminder: any, recipients: Recipients): Promise<void> {
    const notificationPromises: Promise<any>[] = [];

    if (this.shouldSendWhatsApp(reminder, recipients.phoneNumbers)) {
      notificationPromises.push(this.sendWhatsAppMessages(reminder, recipients.phoneNumbers));
    }

    if (this.shouldSendEmail(reminder, recipients.emailAddresses)) {
      notificationPromises.push(this.sendEmails(reminder, recipients.emailAddresses));
    }

    await Promise.all(notificationPromises);
  }

  private shouldSendWhatsApp(reminder: any, phoneNumbers: string[]): boolean {
    return phoneNumbers.length > 0 && ["whatsapp", "both"].includes(reminder.category);
  }

  private shouldSendEmail(reminder: any, emailAddresses: string[]): boolean {
    return emailAddresses.length > 0 && ["email", "both"].includes(reminder.category);
  }

  private async getRecipients(reminder: any): Promise<Recipients> {
    if (reminder.engagementId) {
      return this.getEngagementRecipients(reminder);
    }
    if (reminder.leadId) {
      return this.getLeadRecipients(reminder.leadId);
    }
    return { phoneNumbers: [], emailAddresses: [] };
  }

  private async getEngagementRecipients(reminder: any): Promise<Recipients> {
    const engagement = await EngagementModel.findOne({
      _id: reminder.engagementId,
      user: reminder.user,
    });

    if (!engagement) {
      return { phoneNumbers: [], emailAddresses: [] };
    }

    const leads = await getLeadsByCategory(
      engagement.category || "Uncategorized",
      reminder.user
    );

    return {
      phoneNumbers: leads
        .filter((lead: any) => lead.phone)
        .map((lead: any) => validatePhone(lead.phone)),
      emailAddresses: leads
        .filter((lead: any) => lead.email)
        .map((lead: any) => lead.email),
    };
  }

  private async getLeadRecipients(leadId: string): Promise<Recipients> {
    const lead = await LeadModel.findById(leadId);
    if (!lead) {
      return { phoneNumbers: [], emailAddresses: [] };
    }

    return {
      phoneNumbers: lead.phone ? [validatePhone(lead.phone)] : [],
      emailAddresses: lead.email ? [lead.email] : [],
    };
  }

  private async sendWhatsAppMessages(reminder: ReminderContent, phoneNumbers: string[]): Promise<void> {
    try {
      console.log(reminder.messageContent);
      const content = reminder.messageContent.message?.data ?
        Buffer.from(reminder.messageContent.message.data) :
        reminder.messageContent.message;
      console.log(content);
      await messageHandler.sendBulkMessages(
        phoneNumbers,
        content,
        { caption: reminder.messageContent.caption },
        { engagementID: reminder.engagementId, user: reminder.user }

      );
    } catch (error) {
      console.error(`WhatsApp message error for reminder ${reminder._id}:`, error);
    }
  }

  private async sendEmails(reminder: any, emailAddresses: string[]): Promise<void> {
    try {
      const userData = await this.getUserData(reminder.user);
      const mailService = new MailService(userData);

      const { emailSubject, emailBodyType, customHTML, type, file } = reminder.emailContent;
console.log({ emailAddresses, emailSubject, customHTML, type, emailBodyType, file });
      await mailService.sendMail(
        emailAddresses,
        emailSubject,
        customHTML,
        {
          title: reminder.title,
          note: reminder.description || "",
        },
        type,
        emailBodyType,
        file
      );

      await mailService.CreateEmail({
        body: customHTML,
        from: userData.id,
        to: emailAddresses,
        subject: emailSubject,
        engagementID: reminder.engagementId,
      });
    } catch (error) {
      console.error(`Email error for reminder ${reminder._id}:`, error);
    }
  }

  private async getUserData(userId: string): Promise<{ name: string; email: string, id: mongoose.Types.ObjectId; }> {
    const userData = await UserModel.findById(userId);
    if (!userData?.email || !userData?.name) {
      throw new AppError("User not found", 404);
    }
    return { name: userData.name, email: userData.email, id: userData._id };
  }

  private async updateReminderStatus(reminder: any): Promise<void> {
    await ReminderModel.findByIdAndUpdate(reminder._id, {
      notificationSent: true,
      isScheduled: false,
    });
  }

  public scheduleReminder = async (reminder: any): Promise<void> => {
    if (reminder.notificationSent) {
      console.log(`Reminder ${reminder._id} already executed.`);
      return;
    }

    const now = moment().toDate();
    const delay = reminder.scheduledAt < now ? 0 :
      reminder.scheduledAt.getTime() - now.getTime();

    await this.reminderQueue.add("execute", { reminder }, { delay });
    await ReminderModel.findByIdAndUpdate(reminder._id, { isScheduled: true });
  };

  public loadAndScheduleReminders = async (): Promise<void> => {
    const reminders = await ReminderModel.find({ notificationSent: false });
    await Promise.all(reminders.map(reminder => this.scheduleReminder(reminder)));
  };

  public async getScheduledJobs(): Promise<string[]> {
    const jobs = await this.reminderQueue.getJobs(["waiting", "delayed"]);
    return jobs.map(job => job.id || "");
  }

  private handleJobFailure(job: Job | undefined, error: Error): void {
    console.error("Job failed:", job?.id, error);
  }

  // Singleton pattern
  public static getInstance(): ReminderScheduler {
    if (!ReminderScheduler.instance) {
      ReminderScheduler.instance = new ReminderScheduler();
    }
    return ReminderScheduler.instance;
  }
}

export default ReminderScheduler.getInstance();