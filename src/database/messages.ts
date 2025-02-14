import { MessageModel } from "../models/MessageModel";

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

export const createMessage = async (message: any, options: options) => {
  try {
    const { type, id, leadId } = options;
    const { message: content, key } = message;
    await MessageModel.create({
      content,
      type,
      key,
      user: id,
      receiver: key.remoteJid.split("@")[0],
      leadId,
    });
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
    const query: any = { user: id };
    if (engagementID) query.engagementID = engagementID;
    if (leadId) query.leadId = leadId;
    return await MessageModel.find(query);
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
    return await MessageModel.countDocuments(query);
  } catch (error) {
    console.error("Error getting message count:", error);
    throw error;
  }
};
