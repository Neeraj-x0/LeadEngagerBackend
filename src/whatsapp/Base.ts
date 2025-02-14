"use strict";
import { isUrl, decodeJid, parsedJid } from "./functions";
import fileType from "file-type";
import { generateWAMessageFromContent, generateWAMessage } from "baileys";
import { ExtendedWASocket } from "./types";


class Base {
    client!: ExtendedWASocket;
    user!: string;
    key: any;
    isGroup!: boolean;
    id!: string;
    jid!: string;
    pushName!: string;
    participant!: string;
    fromMe!: boolean;
    timestamp: any;
    isBaileys!: boolean;
    sudo!: boolean;

    constructor(client: ExtendedWASocket, data?: any) {
        Object.defineProperty(this, "client", { value: client });
        if (data) this._patch(data);
    }

    _patch(data: any) {
        this.user = decodeJid(this.client.user?.id || '');
        this.key = data.key;
        this.isGroup = data.isGroup;
        this.id = data.key.id;
        this.jid = data.key.remoteJid;
        this.pushName = data.pushName;
        this.participant = parsedJid(data.sender)[0];
        this.fromMe = data.key.fromMe;
        this.timestamp = typeof data.messageTimestamp === "object"
            ? data.messageTimestamp.low
            : data.messageTimestamp;
        this.isBaileys = this.id.startsWith("BAE5");
        return data;
    }

    _clone() {
        return Object.assign(Object.create(this), this);
    }

    async sendFile(content: any, options: Record<string, any> = {}) {
        if (!this.client?.getFile) throw new Error('Client or getFile method not available');
        let { data } = await this.client.getFile(content);
        let type = await fileType.fromBuffer(data);
        const mediaType = type?.mime.split("/")[0];

        const messageContent: any = mediaType && {
            image: { image: data },
            video: { video: data },
            audio: { audio: data },
        }[mediaType] || { document: { document: data } };

        return this.client.sendMessage(
            this.jid,
            { ...messageContent, ...options },
            { ...options }
        );
    }

    async reply(text: any, opt = {}) {
        return this.client.sendMessage(
            this.jid,
            { text: require("util").format(text), ...opt },
            { ...opt, quoted: this }
        );
    }

    async send(jid: string, text: any, opt = {}) {
        const recipient = jid.endsWith("@s.whatsapp.net") ? jid : this.jid;
        return this.client.sendMessage(
            recipient,
            { text: require("util").format(text), ...opt },
            { ...opt }
        );
    }

    async sendMessage(
        jid: string,
        content: any,
        opt: Record<string, any>,
        type = "text"
    ) {
        const recipient = jid || this.jid;
        switch (type.toLowerCase()) {
            case "text":
                return this.client.sendMessage(recipient, { text: content, ...opt });
            case "image":
                if (Buffer.isBuffer(content)) {
                    return this.client.sendMessage(recipient, { image: content, ...opt });
                } else if (isUrl(content)) {
                    return this.client.sendMessage(recipient, { image: { url: content }, ...opt });
                }
                break;
            case "video":
                if (Buffer.isBuffer(content)) {
                    return this.client.sendMessage(recipient, { video: content, ...opt });
                } else if (isUrl(content)) {
                    return this.client.sendMessage(recipient, { video: { url: content }, ...opt });
                }
                break;
            case "audio":
                if (Buffer.isBuffer(content)) {
                    return this.client.sendMessage(recipient, { audio: content, ...opt });
                } else if (isUrl(content)) {
                    return this.client.sendMessage(recipient, { audio: { url: content }, ...opt });
                }
                break;
        }
    }

    async delete(key: any) {
        await this.client.sendMessage(this.jid, { delete: key });
    }

    async updateName(name: string) {
        await this.client.updateProfileName(name);
    }

    async getPP(jid: string) {
        return await this.client.profilePictureUrl(jid, "image");
    }

    async setPP(jid: string, pp: any) {
        if (Buffer.isBuffer(pp)) {
            await this.client.updateProfilePicture(jid, pp);
        } else {
            await this.client.updateProfilePicture(jid, { url: pp });
        }
    }

    async block(jid: string) {
        await this.client.updateBlockStatus(jid, "block");
    }

    async unblock(jid: string) {
        await this.client.updateBlockStatus(jid, "unblock");
    }

    async add(jid: string) {
        return await this.client.groupParticipantsUpdate(this.jid, [jid], "add");
    }

    async kick(jid: string) {
        return await this.client.groupParticipantsUpdate(this.jid, [jid], "remove");
    }

    async promote(jid: string) {
        return await this.client.groupParticipantsUpdate(this.jid, [jid], "promote");
    }

    async demote(jid: string) {
        return await this.client.groupParticipantsUpdate(this.jid, [jid], "demote");
    }
}

export default Base;
