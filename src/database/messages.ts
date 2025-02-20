import { MessageModel } from "../models/MessageModel";
import { LeadModel } from "../models/LeadModel";
import { ReplyModel } from "../models/replyModel";
import mongoose from "mongoose";
import { proto } from "baileys";
import { createMessageQuery } from "../types/WhatsApp";
import { EmailModel } from "../models/EmailModel";
import { EngagementModel } from "../models";
interface options {
  type: string;
  id: string;
  leadId?: string;
  engagementID?: string;
  user: string;
}

export const createBulkMessages = async (messages: any, options: options) => {
  try {
    const { type, id, engagementID } = options;
    messages = messages.map(({ message, key }: any) => ({
      content: message,
      type,
      key,
      user: id,
      receiver: key.remoteJid.split("@")[0],
      engagementID,
    }));
    await MessageModel.insertMany(messages);
  } catch (error) {
    console.error("Error creating messages:", error);
    throw error;
  }
};






export const createMessage = async (query: createMessageQuery) => {
  try {
    let { _id: messageID, engagementID, user, receiver, } = (await MessageModel.create(query))
    if (engagementID) {
      await LeadModel.findOneAndUpdate({ _id: query.receiver }, { lastMessage: messageID })
      await EngagementModel.findOneAndUpdate({ _id: engagementID }, { lastMessage: new Date() })
    } else return
  } catch (error) {
    console.error("Error creating message:", error);
    throw error;
  }
};

export const getMessages = async (options: {
  id: string;
  engagementID?: string;
  leadId?: string;
}) => {
  try {
    const { id, engagementID, leadId } = options;
    // Constructing the base query...
    const query: any = { user: id };
    if (engagementID) query.engagementID = engagementID;
    if (leadId) query.leadId = leadId;

    // Fetching messages from both sources
    const [WAMessage, emailMessage] = await Promise.all([
      MessageModel.find(query),
      EmailModel.find(query)
    ]);

    // Processing WhatsApp messages
    const waProcessed = await Promise.all(WAMessage.map(async (msg) => {
      // Calculate reply percentage
      const totalReplies = await ReplyModel.countDocuments({
        messageID: msg._id
      });
      const positiveReplies = await ReplyModel.countDocuments({
        messageID: msg._id,
        reply: true
      });
      const replyPercentage = totalReplies ?
        ((positiveReplies / totalReplies) * 100).toFixed(2) :
        "0";

      return {
        messageType: 'text', // Default to text if not specified
        source: 'whatsapp',
        replyPercentage: parseFloat(replyPercentage),
        ...msg.toObject()
      };
    }));

    // Processing email messages
    const emailProcessed = emailMessage.map(email => ({
      messageType: 'text',
      source: 'email',
      replyPercentage: 0, // Assuming emails don't have reply tracking
      ...email.toObject()
    }));

    // Combining and sorting all messages
    const allMessages = await Promise.all([...waProcessed, ...emailProcessed].map(async (msg) => {
      return {
        ...msg,
        timestamp: msg.timestamp.getTime(),
        lead: (await LeadModel.findOne({ _id: msg.receiver }).select('name')),

      };
    }));

    const final = allMessages.sort((a, b) => b.timestamp - a.timestamp);
    return final.map(message => ({
      source: message.source,
      type: message.messageType,
      replyPercentage: message.replyPercentage,
      timestamp: message.timestamp,
      messageId: message._id,
      totalMessages: { whatsapp: waProcessed.length, email: emailProcessed.length },
      repliedMessages: final.filter(msg => msg.replyPercentage > 0).length,
    }));

  } catch (error) {
    console.error("Error getting messages:", error);
    throw error;
  }
};

export const getMessageCount = async (options: {
  id: string;
  engagementID?: string;
  leadId?: string;
}) => {
  try {
    const { id, engagementID, leadId } = options;
    const query: any = { user: id };
    if (engagementID) query.engagementID = engagementID;
    if (leadId) query.leadId = leadId;
    let message = await MessageModel.countDocuments(query);
    let email = await EmailModel.countDocuments(query);
    return message + email;
  } catch (error) {
    console.error("Error getting message count:", error);
    throw error;
  }
};
