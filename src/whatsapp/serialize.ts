import { downloadContentFromMessage, getContentType, WASocket } from "baileys";
import fsSync, { promises as fs } from "fs";
import path from "path";
import { fromBuffer } from "file-type";
import { ExtendedIMessageInfo, ExtendedWASocket, QuotedMessage } from "./types";
import { createEmptyQuotedMessage, processQuotedMessage } from "./functions";





async function serialize(conn: ExtendedWASocket, message: ExtendedIMessageInfo): Promise<{ conn: ExtendedWASocket, message: ExtendedIMessageInfo }> {
  if (message.key) {
    Object.assign(message, {
      id: message.key.id,
      isSelf: message.key.fromMe,
      from: message.key.remoteJid
    });
  }

  if (message.message) {
    message.type = getContentType(message.message);
    try {
      const quoted = message.type ?
        ((message.message as any)[message.type])?.contextInfo : undefined;

      if (quoted) {
        message.quoted = processQuotedMessage(quoted, conn, message.from!);
      }
    } catch (error) {
      console.error("Error in processing quoted message:", error);
      message.quoted = createEmptyQuotedMessage(message.from!);
    }
  }

  // Add file handling capability
  conn.getFile = createFileHandler();

  return { conn, message };
}

function createFileHandler() {
  return async (PATH: string | Buffer, returnAsFilename: boolean = false) => {
    try {
      const { data, type } = await processFileInput(PATH);
      if (returnAsFilename) {
        const filename = path.join(__dirname, "../" + Date.now() + type.ext);
        await fs.writeFile(filename, data);
        return { filename, ...type, data };
      }
      return { ...type, data };
    } catch (error) {
      console.error("Error in file handling:", error);
      throw error;
    }
  };
}

async function processFileInput(PATH: string | Buffer) {
  let data: Buffer;

  if (Buffer.isBuffer(PATH)) {
    data = PATH;
  } else if (/^data:.*?\/.*?;base64,/i.test(PATH)) {
    data = Buffer.from(PATH.split(',')[1], "base64");
  } else if (/^https?:\/\//.test(PATH)) {
    const res = await fetch(PATH);
    data = Buffer.from(await res.arrayBuffer());
  } else if (fsSync.existsSync(PATH)) {
    data = fsSync.readFileSync(PATH);
  } else if (typeof PATH === "string") {
    data = Buffer.from(PATH);
  } else {
    data = Buffer.alloc(0);
  }

  if (!Buffer.isBuffer(data)) {
    throw new TypeError("Result is not a buffer");
  }

  const type = await fromBuffer(data) || {
    mime: "application/octet-stream",
    ext: ".bin",
  };

  return { data, type };
}

export default serialize;