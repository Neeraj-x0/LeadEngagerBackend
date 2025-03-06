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

type MessageType = "text" | "image" | "video" | "audio" | "document";

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

  private async determineMessageType(content: any): Promise<MessageType> {
    if (Buffer.isBuffer(content)) {
      return await this.getBufferType(content);
    }
    if (typeof content === "object" && content !== null) {
      const contentType = Object.keys(content)[0];
      return ["text", "image", "video", "audio", "document"].includes(contentType) 
        ? contentType as MessageType
        : "text";
    }
    return "text";
  }

  private async getBufferType(content: Buffer): Promise<MessageType> {
    const fileTypeResult = await fromBuffer(content);
    if (!fileTypeResult?.mime) return "document";
    
    const category = fileTypeResult.mime.split("/")[0];
    return ["image", "video", "audio"].includes(category)
      ? category as MessageType
      : "document";
  }

  private async recordMessage(result: any, jid: string, type: MessageType, platformOptions: any) {
    const receiver = await LeadModel.findOne({ phone: jid.split("@")[0] });
    if (!receiver) {
      throw new AppError("Failed to send message: Lead not found", 404);
    }

    const query: createMessageQuery = {
      content: result.message,
      key: result.key,
      type,
      receiver: receiver._id
    };

    if (platformOptions.user) query.user = platformOptions.user;
    if (platformOptions.engagementID) query.engagementID = platformOptions.engagementID;

    await createMessage(query);
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

    try {
      const type = await this.determineMessageType(content);
      const messageContent = Buffer.isBuffer(content)
        ? { [type]: content, caption: options.caption ?? "", fileName: options.fileName ?? "file" }
        : content;
        console.log("Message Type", type)
      const result = await this.sock.sendMessage(jid, messageContent);
      if (!result) {
        throw new AppError("Failed to send message: No result returned", 500);
      }

      await this.recordMessage(result, jid, type, platformOptions);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new AppError(`Failed to send message: ${errorMessage}`, 500);
    }
  }

  private async handlePosterGeneration(jid: string, platformOptions: any, company: any) {
    const posterGenerator = new PosterGenerator();
    const lead = await LeadModel.findOne({ phone: jid.split("@")[0] });
    if (!lead) throw new AppError('Lead not found', 404);

    const { iconMedia, companyMedia, backgroundMedia } = await this.getMediaFiles(platformOptions, company);
    
    const poster = {
      ...platformOptions.poster,
      companyName: company.companyName,
      backgroundBuffer: backgroundMedia?.file ? Buffer.from(backgroundMedia.file) : undefined,
      iconBuffer: Buffer.from(iconMedia.file),
      name: lead.name,
      logoBuffer: Buffer.from(companyMedia.file)
    };
    
    return posterGenerator.generate(poster);
  }

  private async getMediaFiles(platformOptions: any, company: any) {
    const companyMedia = await Media.findById(company.companyLogo);
    const backgroundMedia = await Media.findById(platformOptions.poster.background);
    const iconMedia = await Media.findById(platformOptions.poster.icon);
    
    if (!iconMedia?.file || !companyMedia?.file) {
      throw new Error('Required media files not found');
    }
    
    return { iconMedia, companyMedia, backgroundMedia };
  }

  private async sendWithDelay(index: number, total: number, messagesSinceLongDelay: number, chunkLimit: number) {
    if (index === total - 1) return;
    
    if (messagesSinceLongDelay < chunkLimit) {
      await new Promise(resolve => setTimeout(resolve, 
        (Math.floor(Math.random() * (17 - 5 + 1)) + 5) * 1000));
      return { messagesSinceLongDelay: messagesSinceLongDelay + 1, chunkLimit };
    } else {
      await new Promise(resolve => setTimeout(resolve, 
        (Math.floor(Math.random() * (60 - 30 + 1)) + 30) * 1000));
      return { 
        messagesSinceLongDelay: 0, 
        chunkLimit: Math.floor(Math.random() * (5 - 3 + 1)) + 3 
      };
    }
  }

  async sendBulkMessages(
    phone: string[],
    content: string | Buffer,
    options: MediaOptions = {},
    platformOptions?: any
  ): Promise<Array<typeof messageResponseType>> {
    if (!this.sock) throw new AppError("WhatsApp connection not established", 503);

    const messages = [];
    const jids = phone.map(p => `${validatePhone(p)}@s.whatsapp.net`);
    let messagesSinceLongDelay = 0;
    let chunkLimit = Math.floor(Math.random() * (5 - 3 + 1)) + 3;

    for (let i = 0; i < jids.length; i++) {
      let messageContent = content;
      
      if (platformOptions?.poster?.title) {
        const company = await UserModel.findById(platformOptions.user);
        if (!company?.companyName) throw new AppError('Company details not found', 404);
        messageContent = await this.handlePosterGeneration(jids[i], platformOptions, company);
      }

      const messageResponse = await this.sendMessage(
        jids[i],
        platformOptions?.poster ? { image: messageContent } : messageContent,
        options,
        platformOptions
      );
      messages.push(messageResponse);

      const delayResult = await this.sendWithDelay(i, jids.length, messagesSinceLongDelay, chunkLimit);
      if (delayResult) {
        ({ messagesSinceLongDelay, chunkLimit } = delayResult);
      }
    }

    if (platformOptions?.poster?.icon) {
      await Media.deleteMany({ 
        _id: { 
          $in: [platformOptions.poster.icon, platformOptions.poster.background] 
        } 
      });
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
