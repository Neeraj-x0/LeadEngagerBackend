import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
  makeCacheableSignalKeyStore,
} from "baileys";
import { Boom } from "@hapi/boom";
import pino from "pino";
import { AppError } from "../utils/errorHandler";

import {
  WhatsAppSocket,
  WhatsAppMessageContent,
  MediaOptions,
} from "../types/WhatsApp";
import { validatePhone } from "../utils/functions";

class MessageHandler {
  private static instance: MessageHandler;
  private sock: WhatsAppSocket | null = null;
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
    }) as WhatsAppSocket;

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
    sock.ev.on("messages.upsert", (data) => {});
  }

  async sendMessage(
    jid: string,
    content: any,
    options: MediaOptions = {},
    type: "text" | "image" | "video" | "audio" | "sticker" = "text"
  ): Promise<any> {
    if (!this.sock) {
      throw new AppError("WhatsApp connection not established", 503);
    }

    const messageContent: WhatsAppMessageContent = {};

    try {
      switch (type) {
        case "text":
          messageContent.text = content;
          break;

        case "image":
        case "video":
        case "sticker":
        case "audio":
          messageContent[type] = Buffer.isBuffer(content)
            ? { buffer: content }
            : { url: content };

          if (options.caption) {
            messageContent.caption = options.caption;
          }
          if (options.viewOnce) {
            messageContent.viewOnce = options.viewOnce;
          }
          break;
      }

      const result = await this.sock.sendMessage(jid, messageContent);
      console.log(`Message sent to ${jid}:`, result);

      // Store message in database if needed
      // await saveMessage(result, jid);

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new AppError(
        `Failed to send ${type} message: ${errorMessage}`,
        500
      );
    }
  }

  async sendBulkMessages(
    phone: string[],
    content: any,
    options: MediaOptions = {},
    type: "text" | "image" | "video" | "audio" | "sticker" = "text"
  ): Promise<void> {
    if (!this.sock) {
      throw new AppError("WhatsApp connection not established", 503);
    }
    const jids = phone.map((p) => `${validatePhone(p)}@s.whatsapp.net`);

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    let messagesSinceLongDelay = 0;
    // Set initial chunk limit (random integer between 3 and 5)
    let chunkLimit = Math.floor(Math.random() * (5 - 3 + 1)) + 3;

    for (let i = 0; i < jids.length; i++) {
      await this.sendMessage(jids[i], content, options, type);
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
  }
}

const messageHandler = MessageHandler.getInstance();

// Initialize WhatsApp connection when server starts
(async () => {
  await messageHandler.initialize();
})();

export { messageHandler };

export default MessageHandler;
