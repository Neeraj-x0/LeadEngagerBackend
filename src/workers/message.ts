import { sendEmail } from '../utils/engagement/functions';
import { messageHandler } from '../services/WhatsApp';
import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import MailService from '../services/Email';
import { logDebug, logError, logInfo } from '../utils/logger';
import { PosterGenerator } from "../utils/poster";
import mongoose from 'mongoose';
import { LeadModel } from '../models/LeadModel';
import Media from '../models/Media';
import { UserModel } from '../models/UserModel';



// Redis connection setup with logging
const connection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: null,
});

connection.on('connect', () => {
    logInfo('Redis', 'Successfully connected to Redis');
});

connection.on('error', (error) => {
    logError('Redis', 'Connection error', error);
});


interface JobStatus {
    total: number;
    completed: number;
    failed: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
    error?: string;
}

// Queue definitions with logging
const whatsappQueue = new Queue('whatsapp-messages', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});

const emailQueue = new Queue('email-messages', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});


const posterQueue = new Queue('poster-messages', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    },
});


// Enhanced JobStatusManager with logging
class JobStatusManager {
    private redis: IORedis;

    constructor(redis: IORedis) {
        this.redis = redis;
    }

    async updateStatus(jobId: string | number, update: Partial<JobStatus>): Promise<JobStatus> {
        const key = `job-status:${jobId}`;
        try {
            const currentStatus = await this.redis.get(key);
            const status: JobStatus = currentStatus ? JSON.parse(currentStatus) : {
                total: 0,
                completed: 0,
                failed: 0,
                status: 'pending'
            };

            const newStatus = { ...status, ...update };
            await this.redis.set(key, JSON.stringify(newStatus));
            await this.redis.expire(key, 86400);

            logDebug('JobStatusManager', `Updated status for job ${jobId}`, newStatus);
            return newStatus;
        } catch (error) {
            logError('JobStatusManager', `Failed to update status for job ${jobId}`, error);
            throw error;
        }
    }

    async getStatus(jobId: string): Promise<JobStatus | null> {
        try {
            const status = await this.redis.get(`job-status:${jobId}`);
            logDebug('JobStatusManager', `Retrieved status for job ${jobId}`, status);
            return status ? JSON.parse(status) : null;
        } catch (error) {
            logError('JobStatusManager', `Failed to get status for job ${jobId}`, error);
            return null;
        }
    }
}

const statusManager = new JobStatusManager(connection);

// Enhanced WhatsApp worker with detailed logging
const whatsappWorker = new Worker('whatsapp-messages', async (job: Job) => {
    const { leads, message, mediaOptions, mediaType, userId, engagementId } = job.data;
    let processed = 0;
    let failed = 0;
    const batchSize = 10;

    logInfo('WhatsappWorker', `Starting job ${job.id}`, {
        totalLeads: leads.length,
        userId,
        engagementId
    });

    await statusManager.updateStatus(job.id!, {
        total: leads.length,
        status: 'processing'
    });

    // Input validation with logging
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        const error = 'Invalid or empty leads array';
        logError('WhatsappWorker', error, { jobId: job.id });
        throw new Error(error);
    }

    if (!message) {
        const error = 'Message content is required';
        logError('WhatsappWorker', error, { jobId: job.id });
        throw new Error(error);
    }

    for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        logDebug('WhatsappWorker', `Processing batch ${batchNumber}`, {
            jobId: job.id,
            batchSize: batch.length,
            totalProcessed: processed
        });

        try {
            let processedMessage: string | Buffer;
            if (typeof message === 'string') {
                processedMessage = message;
            } else if (Buffer.isBuffer(message)) {
                processedMessage = message;
            } else if (message && typeof message === 'object' && 'data' in message) {
                processedMessage = Buffer.from(message.data);
            } else {
                throw new Error('Invalid message format');
            }

            await messageHandler.sendBulkMessages(
                batch.map(lead => lead.phone),
                processedMessage,
                mediaOptions,
                { user: userId, engagementID: engagementId }
            );

            processed += batch.length;

            logInfo('WhatsappWorker', `Batch ${batchNumber} completed successfully`, {
                jobId: job.id,
                processed,
                total: leads.length
            });

            await statusManager.updateStatus(job.id!, {
                completed: processed,
                status: 'processing'
            });
            await job.updateProgress(Math.floor((processed / leads.length) * 100));

            const delay = Math.min(1000 * (batch.length / 10), 5000);
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error: any) {
            logError('WhatsappWorker', `Batch ${batchNumber} failed`, {
                error,
                jobId: job.id,
                batchSize: batch.length
            });

            failed += batch.length;

            await statusManager.updateStatus(job.id!, {
                failed,
                error: `Batch ${batchNumber} failed: ${error?.message || 'Unknown error occurred'}`
            });

            if (failed === leads.length) {
                const finalError = `All ${leads.length} attempts failed. Last error: ${error?.message}`;
                logError('WhatsappWorker', 'Job failed completely', {
                    jobId: job.id,
                    error: finalError
                });
                throw new Error(finalError);
            }
        }
    }

    const finalStatus = failed === leads.length ? 'failed' :
        failed > 0 ? 'completed_with_errors' :
            'completed';

    logInfo('WhatsappWorker', `Job ${job.id} completed`, {
        status: finalStatus,
        processed,
        failed
    });

    await statusManager.updateStatus(job.id!, {
        status: finalStatus,
        completed: processed,
        failed: failed
    });

    return { processed, failed, status: finalStatus };
}, {
    connection,
    concurrency: 1,
    limiter: {
        max: 100,
        duration: 1000,
    },
});


interface EmailJob extends Job {
    data: {
        leads: any[];
        emailSubject: string;
        customHTML: string;
        emailData: any;
        type: "mailgun" | "gmail" | undefined;
        emailBodyType: "html" | "text";
        mailServiceData: any;
        file?: Express.Multer.File;
    }
}

// Enhanced email worker with detailed logging
const emailWorker = new Worker('email-messages', async (job: EmailJob) => {
    const { leads, emailSubject, customHTML, emailData, type, emailBodyType, mailServiceData, file } = job.data;
    let processed = 0;
    let failed = 0;
    const batchSize = 50;

    logInfo('EmailWorker', `Starting job ${job.id}`, {
        totalLeads: leads.length,
        emailSubject,
        type
    });

    await statusManager.updateStatus(job.id!, {
        total: leads.length,
        status: 'processing'
    });

    const mailService = new MailService(mailServiceData);

    for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        const batchNumber = Math.floor(i / batchSize) + 1;

        logDebug('EmailWorker', `Processing batch ${batchNumber}`, {
            jobId: job.id,
            batchSize: batch.length,
            totalProcessed: processed
        });

        try {
            await sendEmail(
                batch.filter((lead: { email: any; }) => lead.email).map((lead: { email: any; }) => lead.email),
                emailSubject,
                customHTML,
                emailData,
                type,
                emailBodyType,
                mailService,
                file
            );

            processed += batch.length;

            logInfo('EmailWorker', `Batch ${batchNumber} completed successfully`, {
                jobId: job.id,
                processed,
                total: leads.length
            });

            await statusManager.updateStatus(job.id!, { completed: processed });
            await job.updateProgress(Math.floor((processed / leads.length) * 100));
        } catch (error: any) {
            logError('EmailWorker', `Batch ${batchNumber} failed`, {
                error,
                jobId: job.id,
                batchSize: batch.length
            });

            failed += batch.length;
            await statusManager.updateStatus(job.id!, {
                failed,
                error: error?.message || 'Unknown error occurred'
            });

            if (failed === leads.length) {
                const finalError = 'All attempts failed';
                logError('EmailWorker', 'Job failed completely', {
                    jobId: job.id,
                    error: finalError
                });
                throw new Error(finalError);
            }
        }
    }

    logInfo('EmailWorker', `Job ${job.id} completed`, {
        processed,
        failed
    });

    return { processed, failed };
}, {
    connection,
    concurrency: 2,
    limiter: {
        max: 200,
        duration: 1000,
    },
});

interface TextStyle {
    fontFamily?: string;    // e.g., "Arial"
    color?: string;         // e.g., "#000"
}
interface PosterJob {
    data: {
        posterData: {
            logoBuffer: Buffer;
            companyName: string;
            name: string;
            title: string;
            note: string;
            iconBuffer: Buffer;
            backgroundBuffer?: Buffer;
            companyNameStyle?: TextStyle;
            greetingStyle?: TextStyle;
            titleStyle?: TextStyle;
            noteStyle?: TextStyle;
            backgroundId: mongoose.Types.ObjectId
            iconId: mongoose.Types.ObjectId
        }

        whatsappData: {
            leads: {
                id: string;
                name: string;
                email: string;
                phone: string;
                user: mongoose.Types.ObjectId;
                createdAt: NativeDate;
                notes?: string | null | undefined;
                status?: string
                category?: string | undefined;
                lastMessage?: mongoose.Types.ObjectId
            }[];
            message: string | Buffer;
            mediaOptions: any;
            mediaType: string;
            userId: mongoose.Types.ObjectId;
            engagementId: mongoose.Types.ObjectId;
        };
    }
}

const posterWorker = new Worker('poster-messages',
    async (job: PosterJob) => {
        const { posterData, whatsappData } = job.data;
        const company = await UserModel.findById(whatsappData.userId);
        if (!company) throw new Error('Company not found');
        posterData.companyName = company.companyName;
        let companyMedia = await Media.findById(company.companyLogo);
        if (!companyMedia || !companyMedia.file) {
            throw new Error('Company logo media file not found');
        }
        posterData.logoBuffer = Buffer.from(companyMedia.file);
        const posterGenerator = new PosterGenerator();
        const iconMedia = await Media.findById(posterData.iconId);
        let backgroundMedia = await Media.findById(posterData.backgroundId);
        if (!iconMedia?.file) throw new Error('Icon media file not found');
        posterData.iconBuffer = Buffer.from(iconMedia.file);
        if (backgroundMedia?.file) {
            posterData.backgroundBuffer = Buffer.from(backgroundMedia.file);
        }

        for (const lead of whatsappData.leads) {
            posterData.name = lead.name;
            console.log(posterData);
            const posterBuffer = await posterGenerator.generate(posterData);
            await messageHandler.sendBulkMessages(
                [lead.phone],
                posterBuffer,
                whatsappData.mediaOptions,
                { user: whatsappData.userId, engagementID: whatsappData.engagementId}
            );
        }
    }, {
    connection,
    concurrency: 2,
    limiter: {
        max: 200,
        duration: 1000,
    },
})



posterWorker.on('completed', async (job: Job) => {
    logInfo('PosterWorker', `Job ${job.id} completed successfully`);
    await Media.findByIdAndDelete(job.data.posterData.iconId);
    await Media.findByIdAndDelete(job.data.posterData.backgroundId);
    await statusManager.updateStatus(job.id!, { status: 'completed' });
}
)

posterWorker.on('failed', async (job: Job | undefined, error: Error, prev: string) => {
    if (job) {
        logError('PosterWorker', `Job ${job.id} failed`, error);
        await statusManager.updateStatus(job.id!, {
            status: 'failed',
            error: error.message
        });
    }
});



// Enhanced event handlers with logging
whatsappWorker.on('completed', async (job: Job) => {
    logInfo('WhatsappWorker', `Job ${job.id} completed successfully`);
    await statusManager.updateStatus(job.id!, { status: 'completed' });
});

whatsappWorker.on('failed', async (job: Job | undefined, error: Error, prev: string) => {
    if (job) {
        logError('WhatsappWorker', `Job ${job.id} failed`, error);
        await statusManager.updateStatus(job.id!, {
            status: 'failed',
            error: error.message
        });
    }
});

emailWorker.on('completed', async (job: Job) => {
    logInfo('EmailWorker', `Job ${job.id} completed successfully`);
    await statusManager.updateStatus(job.id!, { status: 'completed' });
});

emailWorker.on('failed', async (job: Job | undefined, error: Error, prev: string) => {
    if (job) {
        logError('EmailWorker', `Job ${job.id} failed`, error);
        await statusManager.updateStatus(job.id!, {
            status: 'failed',
            error: error.message
        });
    }
});




export { whatsappQueue, emailQueue, statusManager, posterQueue };