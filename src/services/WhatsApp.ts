import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  Browsers,
  WASocket,
  makeCacheableSignalKeyStore,
} from "baileys";
import { fromBuffer } from "file-type"
import { Boom } from "@hapi/boom";
import pino from "pino";
import { AppError } from "../utils/errorHandler";

import {
  MediaOptions,
  createMessageQuery,
} from "../types/WhatsApp";
import { validatePhone } from "../utils/functions";
import { MessageModel } from "../models/MessageModel";
import { processMessage } from "../utils/IncomingMessage";
import { LeadModel } from "../models/LeadModel";
import { createMessage } from "../database/messages";
import mongoose from "mongoose";
import { PosterGenerator } from "../utils/poster";
import { UserModel } from "../models";
import Media from "../models/Media";
const messageResponseType = proto.WebMessageInfo;
class MessageHandler {
  private static instance: MessageHandler;
  private sock: WASocket | null = null;
  private logger: pino.Logger;
  private sessionDir: string = "./session";

  private constructor() {
    this.logger = pino({ level: "silent" });
  }

  static getInstance(): MessageHandler {
    if (!MessageHandler.instance) {
      MessageHandler.instance = new MessageHandler();
    }
    return MessageHandler.instance;
  }

  async initialize(): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, this.logger),
      },
      printQRInTerminal: true,
      logger: this.logger,
      browser: Browsers.ubuntu("Razominer"),
      syncFullHistory: false,
      version,
    }) as WASocket;

    this.sock = sock;

    // Connection handling
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "connecting") {
        console.log("WhatsApp connection is connecting");
      } else if (connection === "close") {
        const shouldReconnect =
          (lastDisconnect?.error as Boom)?.output?.statusCode !==
          DisconnectReason.loggedOut;

        if (shouldReconnect) {
          await this.initialize();
        }
      } else if (connection === "open") {
        console.log("WhatsApp connection established successfully!");
      }
    });

    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("messages.upsert", async (data) => {
      await processMessage(data, sock);
    });
  }

  async sendMessage(
    jid: string,
    content: any,
    options: MediaOptions = {},
    platformOptions: any = {}
  ): Promise<any> {
    if (!this.sock) {
      throw new AppError("WhatsApp connection not established", 503);
    }

    console.log({ jid, content, options, platformOptions });
    try {
      const result = await this.sock.sendMessage(jid, {
        ...content,
        caption: options.caption || "",
        fileName: options.fileName || "file",
        mimetype: options.mimetype || "",
      });

      if (!result) {
        throw new AppError("Failed to send message: No result returned", 500);
      }
      const receiver = await LeadModel.findOne({ phone: jid.split("@")[0] });
      if (!receiver) {
        throw new AppError("Failed to send message: Lead not found", 500);
      }
      const contentType = Object.keys(content)[0];
      let type: "text" | "image" | "video" | "audio" | "document";
      if (contentType === "text" || contentType === "image" || contentType === "video" || contentType === "audio" || contentType === "document") {
        type = contentType;
      } else {
        throw new AppError("Invalid message type", 400);
      }
      const query: createMessageQuery = {
        content: result.message, key: result.key, type,
        receiver: receiver._id
      }


      if (platformOptions.user) {
        query.user = platformOptions.user;
      }
      if (platformOptions.engagementID) {
        query.engagementID = platformOptions.engagementID;
      }

      await createMessage(query);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Failed to send ${content.mediaType} message: ${errorMessage}`,
        500
      );
    }
  }

  async sendBulkMessages(
    phone: string[],
    content: string | Buffer,
    options: MediaOptions = {},
    platformOptions?: {
      engagementID: mongoose.Types.ObjectId, user: mongoose.Types.ObjectId, poster?: {
        name?: string;
        logoBuffer?: Buffer;
        companyName?: string; title: string, note: string, background?: mongoose.Types.ObjectId, icon: mongoose.Types.ObjectId
      };
    }
  ): Promise<Array<typeof messageResponseType>> {
    const messages = [];
    if (!this.sock) {
      throw new AppError("WhatsApp connection not established", 503);
    }
    console.log({ phone, content, options, platformOptions });

    const posterGenerator = new PosterGenerator();

    const jids = phone.map((p) => `${validatePhone(p)}@s.whatsapp.net`);
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let messagesSinceLongDelay = 0;
    // Set initial chunk limit (random integer between 3 and 5)
    let type: "text" | "image" | "video" | "audio" | "document" = "text";
    if (Buffer.isBuffer(content)) {
      const fileTypeResult = await fromBuffer(content);
      if (fileTypeResult && fileTypeResult.mime) {
        const category = fileTypeResult.mime.split("/")[0];
        if (["image", "video", "audio"].includes(category)) {
          type = category as "image" | "video" | "audio";
        } else {
          type = "document";
        }
      } else {
        type = "document";
      }
    }
    let chunkLimit = Math.floor(Math.random() * (5 - 3 + 1)) + 3;
    for (let i = 0; i < jids.length; i++) {
      if (platformOptions?.poster) {
        const company = await UserModel.findById(platformOptions.user);
        if (!company) throw new Error('Company not found');
        if (!company.companyName) throw new AppError('Company name not found', 404);
        let companyMedia = await Media.findById(company.companyLogo);
        let backgroundMedia = await Media.findById(platformOptions.poster.background);
        let iconMedia = await Media.findById(platformOptions.poster.icon);
        if (!iconMedia || !iconMedia.file) {
          throw new Error('Icon media file not found');
        }

        if (!companyMedia || !companyMedia.file) {
          throw new Error('Company logo media file not found');
        }
        console.log({ companyMedia, backgroundMedia, iconMedia });
        const lead = await LeadModel.findOne({ phone: jids[i].split("@")[0] });
        if (!lead) throw new AppError('Lead not found', 404);
        const poster = {
          ...platformOptions.poster,
          companyName: company.companyName,
          backgroundBuffer: backgroundMedia?.file ? Buffer.from(backgroundMedia.file) : undefined,
          iconBuffer: Buffer.from(iconMedia.file),
          name: lead.name,
          logoBuffer: Buffer.from(companyMedia.file)
        };
        if (!poster.iconBuffer) throw new AppError('Icon media file not found', 404);
        content = await posterGenerator.generate(poster);
        type = "image";
        await Media.findByIdAndDelete(platformOptions.poster?.icon);
        await Media.findByIdAndDelete(platformOptions.poster?.background);
      }

      let messageResponse = await this.sendMessage(
        jids[i],
        {
          [type]: content,
        },
        options,
        platformOptions
      );

      messages.push(messageResponse);
      messagesSinceLongDelay++;


      // If this isn't the last message in current chunk and there are more messages to send:
      if (messagesSinceLongDelay < chunkLimit && i !== jids.length - 1) {
        // Random delay between 5 and 17 seconds
        const delay = (Math.floor(Math.random() * (17 - 5 + 1)) + 5) * 1000;
        await sleep(delay);
      } else if (i !== jids.length - 1) {
        // End of a chunk: random delay between 30 and 60 seconds
        const delay = (Math.floor(Math.random() * (60 - 30 + 1)) + 30) * 1000;
        await sleep(delay);
        // Reset for next chunk
        messagesSinceLongDelay = 0;
        chunkLimit = Math.floor(Math.random() * (5 - 3 + 1)) + 3;
      }
    }
    return messages;
  }
}

const messageHandler = MessageHandler.getInstance();

// Initialize WhatsApp connection when server starts
(async () => {
  await messageHandler.initialize();
})();

export { messageHandler };

export default MessageHandler;
