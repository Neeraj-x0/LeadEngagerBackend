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
  poster: { title: string, note: string };
  posterBackground?: mongoose.Types.ObjectId;
  posterIcon: mongoose.Types.ObjectId;
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
    console.log(`Processing reminder ${reminder._id} [${reminder.title}]`)
    try {
      const recipients = await this.getRecipients(reminder);
      await this.sendNotifications(reminder, recipients);
      await this.updateReminderStatus(reminder);

      // NEW: Handle recurring reminders after successful processing
      if (reminder.frequency && reminder.frequency !== 'once') {
        await this.scheduleNextOccurrence(reminder);
      }
    } catch (error) {
      console.error(`Failed to process reminder ${reminder._id}:`, error);
      throw error;
    }
  }

  // NEW: Calculate and schedule the next occurrence of a recurring reminder
  private async scheduleNextOccurrence(reminder: any): Promise<void> {
    try {
      // Calculate the next scheduled time based on frequency
      const nextScheduledAt = this.calculateNextScheduleTime(reminder);

      // Create a new reminder document for the next occurrence
      const nextReminder = new ReminderModel({
        ...reminder.toObject ? reminder.toObject() : reminder, // Handle both document and plain object
        _id: new mongoose.Types.ObjectId(), // Generate new ID
        scheduledAt: nextScheduledAt,
        notificationSent: false,
        isScheduled: false,
        // Don't copy over metadata properties
        createdAt: new Date(),
        updatedAt: new Date()
      });

      // Save the new reminder
      await nextReminder.save();

      // Schedule the new reminder
      await this.scheduleReminder(nextReminder);

      console.log(`Scheduled next ${reminder.frequency} occurrence for reminder ${reminder._id} at ${nextScheduledAt}`);
    } catch (error) {
      console.error(`Failed to schedule next occurrence for reminder ${reminder._id}:`, error);
      // Log error but don't throw - we don't want to fail the job if recurring scheduling fails
    }
  }

  // NEW: Calculate the next scheduled time based on frequency
  private calculateNextScheduleTime(reminder: any): Date {
    const currentSchedule = moment.utc(reminder.scheduledAt);

    switch (reminder.frequency) {
      case 'daily':
        return currentSchedule.add(1, 'day').toDate();

      case 'weekly':
        return currentSchedule.add(1, 'week').toDate();

      case 'monthly':
        return currentSchedule.add(1, 'month').toDate();

      default: // 'once' or any unexpected value (should not happen)
        return currentSchedule.toDate();
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
      const content = reminder.messageContent.message?.data ?
        Buffer.from(reminder.messageContent.message.data) :
        reminder.messageContent.message
      console.log(reminder);
      await messageHandler.sendBulkMessages(
        phoneNumbers,
        content,
        { caption: reminder.messageContent.caption },
        { engagementID: reminder.engagementId, user: reminder.user, poster: { ...reminder.poster, icon: reminder.posterIcon, background: reminder.posterBackground } }
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
    // Modified: Check if this is a one-time reminder that was already sent
    if (reminder.notificationSent && (!reminder.frequency || reminder.frequency === 'once')) {
      console.log(`Reminder ${reminder._id} already executed.`);
      return;
    }

    // Create proper Date object with offset
    const currentDate = new Date();
    const utcNow = new Date(currentDate.getTime() + (5.5 * 60 * 60 * 1000));
    const scheduledAt = moment.utc(reminder.scheduledAt);

    // Compare using the correctly constructed UTC time
    const delay = scheduledAt.isSameOrBefore(utcNow) ? 0 : scheduledAt.diff(utcNow);

    await this.reminderQueue.add("execute", { reminder }, { delay });
    await ReminderModel.findByIdAndUpdate(reminder._id, { isScheduled: true });
  };

  public loadAndScheduleReminders = async (): Promise<void> => {

    const reminders = await ReminderModel.find({
      notificationSent: false,
    });

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