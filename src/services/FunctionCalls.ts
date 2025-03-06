import { messageHandler } from "./WhatsApp";
import { getBrochure } from "../database/brochure";
import { SchemaType } from "@google/generative-ai";

async function sendBrochure(phoneNumber: string, user: string) {
    const brochure = await getBrochure(user);
    if (!brochure) {
        return "Sorry, I couldn't find a brochure for you. Please try again later.";
    }
    await messageHandler.sendMessage(phoneNumber, Buffer.from(brochure.brochure), { mimetype: brochure.mimetype, fileName: brochure.fileName }, { user: user });
    return "Here is the brochure for you";
}
const sendBrochureDeclaration = {
    name: "sendBrochure",
    description: "Send a brochure to a phone number",
    parameters: {
        type: SchemaType.OBJECT,
        properties: {
            phoneNumber: { type: SchemaType.STRING, description: "The phone number to send the brochure to" },
            user: { type: SchemaType.STRING, description: "The unique identifier used to retrieve the user's brochure" },
        },
        required: ["phoneNumber", "user"],
    },
};

const functions = {
    sendBrochure: async (phoneNumber: string, user: string) => {
        return await sendBrochure(phoneNumber, user)
    }
}





export { sendBrochure, sendBrochureDeclaration, functions };
