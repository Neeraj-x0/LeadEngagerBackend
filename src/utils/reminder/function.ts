import mongoose from "mongoose";
import { EmailDomain, WhatsAppDomain } from "./request-parser";
import { EmailContent, ParsedMessageRequest, UserData, WhatsAppContent } from "./types";
import { MediaOptions } from "../../types/WhatsApp";
import { AppError } from "../errorHandler";
import { fetchHtml } from "../../database/template";

async function parseBody(
    body: ParsedMessageRequest,
    user: UserData,
    params: { id: mongoose.Types.ObjectId },
    files: Express.Multer.File[]
) {
    const email: {
        emailSubject: string,
        emailTemplate: string,
        emailBodyType: string,
        emailData: any,
        customHTML: string,
        templateId: string,
        file: Express.Multer.File | null
    } = {
        emailSubject: body.email.subject || "",
        emailTemplate: body.email.template || "",
        emailBodyType: body.email.bodyType || "",
        emailData: body.email.emailData,
        customHTML: body.email.customHTML || "",
        templateId: body.email.templateId || "",
        file: null
    }

    let message: Buffer | string = body.whatsapp.message || "";
    let mediaOptions: Partial<MediaOptions> = {};

    // Find file with fieldname 'file'
    const file = files.find(f => f.fieldname === 'file');

    if (file) {
        message = file.buffer;
        mediaOptions = {
            caption: body.whatsapp.caption || "",
            fileName: file.originalname,
            mimetype: file.mimetype,
        };
        email.file = file;
    }

    const whatsappBody = {
        mediaType: message instanceof Buffer ? mediaOptions.mimetype?.split("/")[0] : "text",
        message,
        caption: body.whatsapp.caption || "",
        mediaOptions,
    };

    return {
        email,
        whatsapp: whatsappBody
    };
}



function validateContent(
    category: string,
    whatsapp: WhatsAppDomain,
    email: EmailDomain,
    file?: Express.Multer.File
) {
    if (category === "email" || category === "both") {
        if (!email.subject) {
            throw new AppError("Email subject is required", 400);
        }
        if (!email.emailData && !email.customHTML) {
            throw new AppError("Email content is required", 400);
        }
    }

    if (category === "whatsapp" || category === "both") {
        if (!whatsapp.message && !file) {
            throw new AppError("Either message or file is required for WhatsApp", 400);
        }
    }
}

function parseWhatsAppContent(
    whatsapp: WhatsAppDomain,
    file?: Express.Multer.File
): WhatsAppContent {
    let message: Buffer | string = whatsapp.message || "";
    let mediaOptions: Partial<MediaOptions> = {};

    if (file) {
        message = file.buffer;
        mediaOptions = {
            caption: whatsapp.caption || "",
            fileName: file.originalname,
            mimetype: file.mimetype,
        };
    }

    return {
        message,
        caption: whatsapp.caption || "",
        mediaOptions
    };
}

async function parseEmailContent(
    email: EmailDomain,
    file?: Express.Multer.File
): Promise<EmailContent> {
    let customHTML = email.customHTML;
    console.log({ email });

    // If templateId is provided, fetch the HTML template
    // if (email.serviceType === 'template') {
    //     customHTML = await fetchHtml(email.customHTML || "") || "";
    //     if (!customHTML) {
    //         throw new AppError(
    //             "Email template could not be fetched",
    //             400
    //         );
    //     }
    // }

    return {
        type: email.bodyType || 'text',
        emailSubject: email.subject || "",
        emailBodyType: email.bodyType || 'text',
        emailData: email.emailData,
        customHTML: customHTML || "",
        file
    };
}

function convertToTimezone(date: string): Date {
    // Assuming the date is in UTC, convert it to the desired timezone
    return new Date(date);
}

export { parseBody, parseWhatsAppContent, parseEmailContent, convertToTimezone, validateContent };