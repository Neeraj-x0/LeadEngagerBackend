import { sendEmail } from '../utils/engagement/functions';
import { messageHandler } from '../services/WhatsApp';

import { Queue, Worker, Job } from "bullmq";
import IORedis from "ioredis";
import MailService from '../utils/mail';

// Thoughtful consideration of connection handling...
const connection = new IORedis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    maxRetriesPerRequest: null,
});

// Interface for our job status tracking
interface JobStatus {
    total: number;
    completed: number;
    failed: number;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'completed_with_errors';
    error?: string;
}

// Carefully structured queue definitions   
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

// Thoughtful approach to status management
class JobStatusManager {
    private redis: IORedis;

    constructor(redis: IORedis) {
        this.redis = redis;
    }

    async updateStatus(jobId: string | number, update: Partial<JobStatus>): Promise<JobStatus> {
        const key = `job-status:${jobId}`;
        const currentStatus = await this.redis.get(key);
        const status: JobStatus = currentStatus ? JSON.parse(currentStatus) : {
            total: 0,
            completed: 0,
            failed: 0,
            status: 'pending'
        };

        const newStatus = { ...status, ...update };
        await this.redis.set(key, JSON.stringify(newStatus));
        await this.redis.expire(key, 86400); // 24 hour retention

        return newStatus;
    }

    async getStatus(jobId: string): Promise<JobStatus | null> {
        const status = await this.redis.get(`job-status:${jobId}`);
        return status ? JSON.parse(status) : null;
    }
}

const statusManager = new JobStatusManager(connection);

// Carefully designed worker implementations
// Enhanced whatsapp worker
const whatsappWorker = new Worker('whatsapp-messages', async (job: Job) => {
    const { leads, message, mediaOptions, mediaType, userId, engagementId } = job.data;
    let processed = 0;
    let failed = 0;
    const batchSize = 10;

    await statusManager.updateStatus(job.id!, {
        total: leads.length,
        status: 'processing'
    });

    // Validate input data
    if (!leads || !Array.isArray(leads) || leads.length === 0) {
        throw new Error('Invalid or empty leads array');
    }

    if (!message) {
        throw new Error('Message content is required');
    }

    for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
        try {
            // Add logging for debugging
            console.log(`Processing batch ${i / batchSize + 1}, size: ${batch.length}`);
            console.log('Message type:', typeof message);
            console.log('Media options:', mediaOptions);
            ;

            await messageHandler.sendBulkMessages(
                batch.map(lead => lead.phone),
                Buffer.from(message.data),
                mediaOptions,
                mediaType
            );
            processed += batch.length;

            await statusManager.updateStatus(job.id!, {
                completed: processed,
                status: 'processing'  // Maintain processing status until completely done
            });
            await job.updateProgress(Math.floor((processed / leads.length) * 100));

            // More granular rate limiting
            const delay = Math.min(1000 * (batch.length / 10), 5000);  // Dynamic delay based on batch size
            await new Promise(resolve => setTimeout(resolve, delay));
        } catch (error: any) {
            console.error('Batch processing error:', error);
            failed += batch.length;

            // More detailed error tracking
            await statusManager.updateStatus(job.id!, {
                failed,
                error: `Batch ${i / batchSize + 1} failed: ${error?.message || 'Unknown error occurred'}`
            });

            // Only throw if ALL attempts have failed
            if (failed === leads.length) {
                throw new Error(`All ${leads.length} attempts failed. Last error: ${error?.message}`);
            }
        }
    }

    // Final status update
    const finalStatus = failed === leads.length ? 'failed' :
        failed > 0 ? 'completed_with_errors' :
            'completed';

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

whatsappWorker.on('failed', async (job: Job | undefined, error: Error) => {
    console.error('Worker failed:', error);
    if (job) {
        await statusManager.updateStatus(job.id!, {
            status: 'failed',
            error: `Worker error: ${error.message}`
        });
    }
});

const emailWorker = new Worker('email-messages', async (job: Job) => {
    const { leads, emailSubject, customHTML, emailData, type, emailBodyType, mailServiceData, file } = job.data;
    let processed = 0;
    let failed = 0;
    const batchSize = 50;

    await statusManager.updateStatus(job.id!, {
        total: leads.length,
        status: 'processing'
    });
    const mailService = new MailService(mailServiceData);

    for (let i = 0; i < leads.length; i += batchSize) {
        const batch = leads.slice(i, i + batchSize);
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

            await statusManager.updateStatus(job.id!, { completed: processed });
            await job.updateProgress(Math.floor((processed / leads.length) * 100));
        } catch (error: any) {
            failed += batch.length;
            await statusManager.updateStatus(job.id!, {
                failed,
                error: error?.message || 'Unknown error occurred'
            });

            if (failed === leads.length) {
                throw new Error('All attempts failed');
            }
        }
    }

    return { processed, failed };
}, {
    connection,
    concurrency: 2,  // Emails can handle more concurrent processing
    limiter: {
        max: 200,
        duration: 1000,
    },
});

// Event handling for deeper insights
whatsappWorker.on('completed', async (job: Job) => {
    await statusManager.updateStatus(job.id!, { status: 'completed' });
});

whatsappWorker.on('failed', async (job: Job | undefined, error: Error, prev: string) => {
    if (job) {
        await statusManager.updateStatus(job.id!, {
            status: 'failed',
            error: error.message
        });
    }
});

emailWorker.on('completed', async (job: Job) => {
    await statusManager.updateStatus(job.id!, { status: 'completed' });
});



emailWorker.on('failed', async (job: Job | undefined, error: Error, prev: string) => {
    if (job) {
        await statusManager.updateStatus(job.id!, {
            status: 'failed',
            error: error.message
        });
    }
});

// Export the queue instances for external use
export { whatsappQueue, emailQueue, statusManager };
