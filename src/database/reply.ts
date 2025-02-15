import mongoose from "mongoose";
import { ReplyModel } from "../models/replyModel";
import { LeadModel } from "../models/LeadModel";

async function updateReplyStatus(lead: mongoose.Types.ObjectId) {
    try {
        const lastMessage = await LeadModel.findOne({ _id: lead }).select("lastMessage");
        if (!lastMessage) {
            return;
        }
        await ReplyModel.findOneAndUpdate({ messageID: lastMessage.lastMessage }, { reply: true });
    } catch (error) {
        console.error("Error updating reply status:", error);
        throw error;
    }
}

export { updateReplyStatus };