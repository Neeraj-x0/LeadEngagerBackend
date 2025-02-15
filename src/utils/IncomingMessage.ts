import { MessageUpsertType, proto, WAMessage, WASocket } from "baileys";
import { ExtendedIMessageInfo } from "../whatsapp/types";
import serialize from "../whatsapp/serialize";
import { updateReplyStatus } from "../database/reply";

interface IncomingMessage {
    messages: WAMessage[];
    type: MessageUpsertType;
    requestId?: string;
}
async function processMessage(messageUpsert: IncomingMessage, sock: WASocket) {
    const { messages, type, requestId } = messageUpsert;
    if (type !== "notify") return
    const { message, conn } = await serialize(sock, messages[0] as unknown as ExtendedIMessageInfo);
    if (message.leadID) await updateReplyStatus(message.leadID)
    return message 
}

export { processMessage };