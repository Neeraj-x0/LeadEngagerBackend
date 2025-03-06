import { MessageUpsertType, proto, WAMessage, WASocket } from "baileys";
import { ExtendedIMessageInfo } from "../whatsapp/types";
import serialize from "../whatsapp/serialize";
import { updateReplyStatus } from "../database/reply";
import ChatBotService from "../services/ChatBot";

const bot = new ChatBotService();

interface IncomingMessage {
    messages: WAMessage[];
    type: MessageUpsertType;
    requestId?: string;
}
async function processMessage(messageUpsert: IncomingMessage, sock: WASocket) {
    const { messages, type } = messageUpsert;
    if (type !== "notify") return
    const { message, conn } = await serialize(sock, messages[0] as unknown as ExtendedIMessageInfo);
    if (message.leadID) await updateReplyStatus(message.leadID)
    conn.readMessages([message.key])
    if (message.key.remoteJid === "status@broadcast" || message.isGroup || !message.text) return
    const botResponse = await bot.getResponse(message.text, { userID: message.userID, phone: message.from });
    if (botResponse && message.from) {
        await conn.sendMessage(message.from, { text: botResponse }, { quoted: messages[0] });
    }


    return message
}

export { processMessage };