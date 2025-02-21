import { WASocket, proto } from "baileys";
import mongoose from "mongoose";

interface MessageType {
    key: {
        id: string;
        fromMe: boolean;
        remoteJid: string;
        participant?: string;
    };
    message: proto.IMessage;
}


interface SerializedMessage extends MessageType {
    id: string;
    isSelf: boolean;
    from: string;
    isGroup: boolean;
    sender: string;
    sudo: boolean;
    type: string;
    mentions: string[] | false;
    body: string | false;
    quoted?: QuotedMessage | null;
    download: (pathFile?: string) => Promise<Buffer | string>;
}

interface FileData {
    res?: Response;
    filename?: string;
    mime: string;
    ext: string;
    data: Buffer;
}

interface ExtendedWASocket extends WASocket {
    getFile?: (PATH: string | Buffer, returnAsFilename?: boolean) => Promise<FileData>;
}
interface ExtendedIMessageInfo extends proto.IWebMessageInfo {
    userID: mongoose.Types.ObjectId;
    leadID: mongoose.Types.ObjectId
    download: (pathFile: string) => Promise<string | Buffer<ArrayBufferLike>>;
    text?: string
    image?: proto.IMessage
    video?: proto.IMessage
    sticker?: proto.IMessage
    document?: proto.IMessage
    audio?: proto.IMessage
    message: proto.IMessage & {
        key: proto.IMessageKey
    }
    quoted: QuotedMessage
    type: string | undefined;
    isSelf: boolean | null | undefined;
    from: string | null | undefined;
    isGroup: boolean
    id: string | null | undefined;

}



// Define message types as a const enum for better performance and type safety
const enum MessageTypes {
    Image = "image",
    Video = "video",
    Sticker = "sticker",
    Document = "document",
    Audio = "audio"
}

// Consolidate mime type mapping
const mimeMap: Record<string, MessageTypes> = {
    imageMessage: MessageTypes.Image,
    videoMessage: MessageTypes.Video,
    stickerMessage: MessageTypes.Sticker,
    documentMessage: MessageTypes.Document,
    audioMessage: MessageTypes.Audio,
};

// Create interfaces for better type safety
type QuotedMessage = {
    type: "normal" | "view_once" | "ephemeral" | "view_once_audio";
    stanzaId: string;
    sender: string;
    message: any;
    text: string;
    key: MessageKey;
    download: (pathFile?: string) => Promise<string | Buffer>;
    mtype: string;
    isSelf: boolean;
} | null;

interface MessageKey {
    id: string;
    fromMe: boolean;
    remoteJid: string;
}

export {
    ExtendedWASocket, FileData, SerializedMessage, QuotedMessage, MessageType,
    ExtendedIMessageInfo, MessageTypes, mimeMap, MessageKey
}