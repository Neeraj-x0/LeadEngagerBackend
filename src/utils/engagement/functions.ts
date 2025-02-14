import { createBulkMessages } from '../../database/messages';
import { messageHandler } from '../../services/WhatsApp';
import { AppError } from '../errorHandler';
import MailService from '../mail';
import { UserRequest, MediaOptions, SendMessageRequest, EmailAttachment, ChannelResult, WhatsAppResult, EmailResult, ProcessResults } from './types';
import { isValidObjectId } from 'mongoose';

// Utility functions for better organization
const parseChannels = (channelsStr: string): string[] => {
    const normalized = channelsStr.toLowerCase();
    if (normalized === 'whatsapp,email' || normalized === 'email,whatsapp') {
        return ['whatsapp', 'email'];
    }
    return [normalized];
};

const validateRequest = (
    req: UserRequest,
    engagementId: string
): void | never => {
    if (!isValidObjectId(engagementId)) {
        throw new AppError('Invalid engagement ID Provided', 400);
    }

    const { channels, emailSubject, customHTML, templateId } = req.body;

    if (!channels) {
        throw new AppError('Channels must be specified', 400);
    }

    if (channels.includes('email')) {
        if (!emailSubject) {
            throw new AppError('Email subject is required for email channel', 400);
        }
        if (!customHTML && !templateId) {
            throw new AppError('Email template is required for email channel', 400);
        }
    }
};

// Channel processors
const processWhatsAppChannel = async (
    leads: any[],
    message: string | Buffer,
    mediaOptions: MediaOptions,
    mediaType: "text" | "image" | "video" | "audio" | "sticker",
    userId: string,
    engagementId: string
): Promise<WhatsAppResult[]> => {
    const phoneLeads = leads
        .filter(lead => lead.phone)
        .map(lead => lead.phone);

    console.log(phoneLeads);
    if (phoneLeads.length === 0) {
        return [{
            phone: '',
            status: 'error',
            error: 'No valid phone numbers found'
        }];
    }


    try {
        const result = await messageHandler.sendBulkMessages(
            phoneLeads,
            message,
            mediaOptions,
            mediaType
        );

        await createBulkMessages(result, {
            type: mediaType,
            id: userId,
            engagementID: engagementId,
            user: userId,
        });

        return [{
            phone: phoneLeads.join(', '),
            status: 'success'
        }];
    } catch (error: any) {
        return [{
            phone: phoneLeads.join(', '),
            status: 'error',
            error: error?.message || 'Unknown error occurred'
        }];
    }
};

const processEmailChannel = async (
    leads: any[],
    emailSubject: string,
    customHTML: string,
    emailData: any,
    type: "mailgun" | "gmail" | undefined,
    emailBodyType: "html" | "text",
    mailService: MailService,
    file?: Express.Multer.File
): Promise<EmailResult[]> => {
    const emailLeads = leads
        .filter(lead => lead.email)
        .map(lead => lead.email);

    if (emailLeads.length === 0) {
        return [{
            email: '',
            status: 'error',
            error: 'No valid email addresses found'
        }];
    }

    try {
        const result = await sendEmail(
            emailLeads,
            emailSubject!,
            customHTML,
            emailData,
            type,
            emailBodyType,
            mailService,
            file
        );

        return [{
            email: emailLeads.join(', '),
            status: 'success',
            result
        }];
    } catch (error: any) {
        return [{
            email: emailLeads.join(', '),
            status: 'error',
            error: error?.message || 'Unknown error occurred'
        }];
    }
};

// Helper function to send Email
async function sendEmail(
    to: string[],
    subject: string,
    body: string,
    data: { title: string; note: string },
    type: "mailgun" | "gmail" = "mailgun",
    bodyType: "html" | "text" = "text",
    mailService: MailService,
    file?: EmailAttachment
) {
    return mailService.sendMail(
        to,
        subject,
        body,
        data,
        type,
        bodyType,
        file
    );
}


export {
    sendEmail,
    parseChannels,
    validateRequest,
    processWhatsAppChannel,
    processEmailChannel
};