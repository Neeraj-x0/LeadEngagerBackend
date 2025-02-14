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

  WhatsAppMessageContent,
  MediaOptions,
} from "../types/WhatsApp";
import { validatePhone } from "../utils/functions";
import { MessageModel } from "../models/MessageModel";
import { processMessage } from "../utils/IncomingMessage";
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
      await processMessage(data,sock);
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

    try {
      console.log(content)

      console.log(`Sending message to ${jid}:`, content);
      const result = await this.sock.sendMessage(jid, {
        ...content,
        caption: options.caption || "",
        fileName: options.fileName || "file",
        mimetype: options.mimetype || "",
      });
      console.log(`Message sent to ${jid}:`, result);

      if (!result) {
        throw new AppError("Failed to send message: No result returned", 500);
      }

      await MessageModel.create({
        content: result.message, key: result.key, engagementID: platformOptions.engagementID, user: platformOptions.id, type: Object.keys(content)[0]
      }
      )

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
    content: any,
    options: MediaOptions = {},
    type: "text" | "image" | "video" | "audio" | "sticker" = "text"
  ): Promise<Array<typeof messageResponseType>> {
    const messages = [];
    if (!this.sock) {
      throw new AppError("WhatsApp connection not established", 503);
    }
    const jids = phone.map((p) => `${validatePhone(p)}@s.whatsapp.net`);
    console.log(`Sending ${type} messages to:`, jids);
    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let messagesSinceLongDelay = 0;
    // Set initial chunk limit (random integer between 3 and 5)
    let chunkLimit = Math.floor(Math.random() * (5 - 3 + 1)) + 3;
    for (let i = 0; i < jids.length; i++) {
      let messageResponse = await this.sendMessage(
        jids[i],
        { [type]: content },
        options,
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
