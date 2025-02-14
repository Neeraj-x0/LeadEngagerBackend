import { proto, WASocket } from "baileys";

import Base from "./Base"
import { ExtendedWASocket } from "./types";

class Message extends Base {
    prefix: any;
    message!: proto.IMessage;
    text: any;
    mention: any;
    reply_message: any;
    constructor(client: ExtendedWASocket, data?: any) {
        super(client, data);
    }

    _patch(data: { prefix: any; key: any; message: { extendedTextMessage: { contextInfo: any; }; }; body: any; quoted: any; }) {
        super._patch(data);
        this.message = data.message
        this.text = data.body;
        const contextInfo = data.message.extendedTextMessage?.contextInfo;
        this.mention = contextInfo?.mentionedJid || false;
        return this;
    }

    async edit(text: string, opt = {}) {
        await this.client.sendMessage(this.jid, { text, edit: this.key, ...opt });
    }

}

module.exports = Message;