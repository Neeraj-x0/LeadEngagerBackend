import mongoose from "mongoose";
import { ReplyModel } from "../models/replyModel";
import { LeadModel } from "../models/LeadModel";
import { MessageModel } from "../models/MessageModel";

async function updateReplyStatus(lead: mongoose.Types.ObjectId) {
    try {
        const lastMessage = await LeadModel.findOne({ _id: lead }).select("lastMessage");
        if (!lastMessage) {
            return;
        }
        const message = await MessageModel.findOne({ _id: lastMessage.lastMessage });
        if (!message) return;
        const messageID = message._id;
        const receiver = message.receiver;
        const engagementID = message.engagementID;
        const user = message.user;
        await ReplyModel.create({ messageID, lead: receiver, engagementID, user })
        return;
    } catch (error) {
        console.error("Error updating reply status:", error);
        throw error;
    }
}

export { updateReplyStatus };