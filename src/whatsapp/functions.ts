import axios from "axios"
import { downloadContentFromMessage, FullJid, jidDecode } from "baileys";
import { ExtendedWASocket, mimeMap, QuotedMessage } from "./types";
import fs from "fs";
async function getBuffer(url: string, options = {}) {
    try {
        const res = await axios({
            method: "get",
            url,
            headers: {
                DNT: 1,
                "Upgrade-Insecure-Request": 1,
            },
            ...options,
            responseType: "arraybuffer",
        });
        return res.data;
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Error: ${error.message}`);
        }
        throw error;
    }
}

const decodeJid = (jid: string) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        const decode = jidDecode(jid) as FullJid || {};
        return decode.user && decode.server
            ? `${decode.user}@${decode.server}`
            : jid;
    } else {
        return jid;
    }
};

const parsedJid = (text = "") => {
    return [...text.matchAll(/([0-9]{5,16}|0)/g)].map(
        (v) => v[1] + "@s.whatsapp.net"
    );
}

const isUrl = (url: string) => {
    return new RegExp(
        /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)/,
        "gi"
    ).test(url);
}
async function streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

// Helper function to get message type
function getMessageType(message: any): string | null {
    let type = Object.keys(message)[0];

    if (type === "templateMessage") {
        return Object.keys(message.templateMessage.hydratedFourRowTemplate)[0];
    }
    if (type === "interactiveResponseMessage") {
        return Object.keys(message.interactiveResponseMessage)[0];
    }
    if (type === "buttonsMessage") {
        return Object.keys(message.buttonsMessage)[0];
    }

    return type;
}


// ... [previous code remains the same until processQuotedMessage] ...

function createEmptyQuotedMessage(messageFrom: string): QuotedMessage {
    return {
        text: "",
        key: {
            id: "",
            fromMe: false,
            remoteJid: messageFrom
        },
        download: async (pathFile?: string) => Buffer.alloc(0),
        mtype: "",
        isSelf: false,
        type: "normal",
        stanzaId: "",
        sender: "",
        message: {}
    };
}

function processEphemeralMessage(
    quotedMessage: any,
    quoted: any,
    userId: string,
    messageFrom: string
): QuotedMessage {
    const ephemeralMsg = quotedMessage.ephemeralMessage.message;
    const messageType = Object.keys(ephemeralMsg)[0];

    // Handle view once message type specifically
    const type = messageType === "viewOnceMessageV2" ? "view_once" : "ephemeral";
    const finalMessage = messageType === "viewOnceMessageV2"
        ? ephemeralMsg.viewOnceMessageV2.message
        : ephemeralMsg;

    return {
        type,
        stanzaId: quoted.stanzaId,
        sender: quoted.participant,
        message: finalMessage,
        text: finalMessage[Object.keys(finalMessage)[0]]?.text || "",
        key: {
            id: quoted.stanzaId,
            fromMe: quoted.participant === userId,
            remoteJid: messageFrom
        },
        download: (pathFile?: string) => downloadMedia(finalMessage, pathFile),
        mtype: Object.keys(finalMessage)[0],
        isSelf: quoted.participant === userId
    };
}

function processViewOnceMessage(
    quotedMessage: any,
    quoted: any,
    userId: string,
    messageFrom: string
): QuotedMessage {
    const viewOnceMsg = quotedMessage.viewOnceMessageV2.message;

    return {
        type: "view_once",
        stanzaId: quoted.stanzaId,
        sender: quoted.participant,
        message: viewOnceMsg,
        text: viewOnceMsg?.text || "",
        key: {
            id: quoted.stanzaId,
            fromMe: quoted.participant === userId,
            remoteJid: messageFrom
        },
        download: (pathFile?: string) => downloadMedia(viewOnceMsg, pathFile),
        mtype: Object.keys(viewOnceMsg)[0],
        isSelf: quoted.participant === userId
    };
}

function processViewOnceAudioMessage(
    quotedMessage: any,
    quoted: any,
    userId: string,
    messageFrom: string
): QuotedMessage {
    const audioMsg = quotedMessage.viewOnceMessageV2Extension.message;
    const messageType = Object.keys(audioMsg)[0];

    return {
        type: "view_once_audio",
        stanzaId: quoted.stanzaId,
        sender: quoted.participant,
        message: audioMsg,
        text: audioMsg[messageType]?.text || "",
        key: {
            id: quoted.stanzaId,
            fromMe: quoted.participant === userId,
            remoteJid: messageFrom
        },
        download: (pathFile?: string) => downloadMedia(audioMsg, pathFile),
        mtype: messageType,
        isSelf: quoted.participant === userId
    };
}

function processNormalMessage(
    quotedMessage: any,
    quoted: any,
    userId: string,
    messageFrom: string
): QuotedMessage {
    const messageType = Object.keys(quotedMessage)[0];

    return {
        type: "normal",
        stanzaId: quoted.stanzaId,
        sender: quoted.participant,
        message: quotedMessage,
        text: extractMessageText(quotedMessage, messageType),
        key: {
            id: quoted.stanzaId,
            fromMe: quoted.participant === userId,
            remoteJid: messageFrom
        },
        download: (pathFile?: string) => downloadMedia(quotedMessage, pathFile),
        mtype: messageType,
        isSelf: quoted.participant === userId
    };
}

function extractMessageText(message: any, messageType: string): string {
    if (!message || !messageType) return "";

    const messageContent = message[messageType];
    if (!messageContent) return "";

    // Check various possible text fields in order of priority
    return messageContent.text ||
        messageContent.description ||
        messageContent.caption ||
        (messageType === "templateButtonReplyMessage" &&
            messageContent.hydratedTemplate?.hydratedContentText) ||
        messageContent ||
        "";
}

// ... [rest of the previous code remains the same] ...

async function downloadMedia(message: any, pathFile?: string): Promise<string | Buffer> {
    try {
        const messageType = getMessageType(message);
        if (!messageType) throw new Error("Invalid message type");

        const stream = await downloadContentFromMessage(message[messageType], mimeMap[messageType]);
        const buffer = await streamToBuffer(stream);

        if (pathFile) {
            await fs.promises.writeFile(pathFile, buffer);
            return pathFile;
        }
        return buffer;
    } catch (error) {
        console.error("Error in downloadMedia:", error);
        throw error;
    }
}

function processQuotedMessage(quoted: any, conn: ExtendedWASocket, messageFrom: string): QuotedMessage {
    if (!quoted || !quoted.quotedMessage) {
        return null;
    }

    const quotedMessage = quoted.quotedMessage;
    const userId = conn.user?.id || '';

    if (quotedMessage.ephemeralMessage) {
        return processEphemeralMessage(quotedMessage, quoted, userId, messageFrom);
    }
    if (quotedMessage.viewOnceMessageV2) {
        return processViewOnceMessage(quotedMessage, quoted, userId, messageFrom);
    }
    if (quotedMessage.viewOnceMessageV2Extension) {
        return processViewOnceAudioMessage(quotedMessage, quoted, userId, messageFrom);
    }

    return processNormalMessage(quotedMessage, quoted, userId, messageFrom);
}



export {
    decodeJid,
    getBuffer,
    parsedJid,
    isUrl,
    processQuotedMessage,
    createEmptyQuotedMessage,
    downloadMedia,
    streamToBuffer,
    getMessageType,
    extractMessageText,
    processEphemeralMessage,
    processViewOnceMessage,
    processViewOnceAudioMessage,
    processNormalMessage
};