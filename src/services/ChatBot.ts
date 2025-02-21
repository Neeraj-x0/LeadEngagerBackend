import { AppError } from "../utils/errorHandler";
import { WAMessage } from "baileys";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";
import mongoose from "mongoose";
import ChatBotPrompt from "../models/ChatBotPrompt";

class ChatBotService {
  private model!: GenerativeModel;
  private static readonly SYSTEM_PROMPT = `You are Axintract – a professional, friendly lead engagement assistant. Your mission is to qualify leads and guide them smoothly through the sales funnel. Customize interactions to each lead while maintaining a warm, personal tone.

KEY GUIDELINES:

1. Tone & Identity:
   • Use natural, conversational language with appropriate emojis.
   • Always greet leads by name and remain professional.
   • Never reveal you are automated.

2. Engagement Protocol:
   • Respond instantly and keep interactions concise.
   • Ask focused questions to qualify leads.
   • Categorize leads as Hot 🔥, Warm ✅, or Cold ❄️.
   • Personalize responses by referencing previous interactions.

3. Response Strategy:
   • First Message: Warm greeting using the lead’s name.
   • Follow-up if no reply within 24 hours.
   • Provide clear, actionable answers. Escalate to a human when needed.

4. Communication Rules:
   DO:
     - Respond promptly and professionally.
     - Use clear, action-oriented language.
     - Encourage next steps.
   DON'T:
     - Overpromise or provide inaccurate info.
     - Use aggressive sales tactics.
     - Ignore concerns or be generic.

5. Escalation Triggers:
   • Escalate immediately if the lead requests human interaction, asks complex questions, or if high-value opportunities arise.

DEFAULT RESPONSES:
   • Uncertain: “That's an excellent question! Let me connect you with a team member.”
   • Escalation: “I'll have our specialist reach out to you shortly.”

Your effectiveness is measured by response speed, engagement quality, successful lead qualification, and customer satisfaction.
`;

  constructor() {
    this.initializeModel();
  }

  private initializeModel(): void {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new AppError("GEMINI_API_KEY is not set", 500);
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
    });
  }

  private getGenerationConfig() {
    return {
      temperature: 0.9, // Slightly reduced for more focused responses
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "text/plain",
    };
  }

  async getResponse(prompt: string, user: mongoose.Types.ObjectId): Promise<string> {
    try {
      const Systemprompt = (await ChatBotPrompt.findOne({
        user,
      }))?.prompt || ChatBotService.SYSTEM_PROMPT;
      const chat = this.model.startChat({
        history: [
          {

            role: "user",
            parts: [{ text: Systemprompt }],
          },
          {
            role: "model",
            parts: [
              {
                text: "Understood. I will follow these guidelines in our interaction.",
              },
            ],
          },
        ],
        generationConfig: this.getGenerationConfig(),
      });
      const result = await chat.sendMessage(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini API Error:", error);
      throw new AppError("Failed to generate response", 500);
    }
  }

  // Helper method to format the chat history
  private async formatChatHistory(
    messages: Array<{ role: string; content: string }>
  ) {
    return messages.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
  }

  // Method to handle lead categorization
  private categorizeLead(response: string): "Hot" | "Warm" | "Cold" {
    const keywords = {
      hot: ["urgent", "immediately", "ready to buy", "purchase now"],
      warm: ["interested", "considering", "tell me more", "pricing"],
      cold: ["just looking", "not now", "maybe later", "too expensive"],
    };

    const lowerResponse = response.toLowerCase();

    if (keywords.hot.some((keyword) => lowerResponse.includes(keyword)))
      return "Hot";
    if (keywords.warm.some((keyword) => lowerResponse.includes(keyword)))
      return "Warm";
    return "Cold";
  }
}

export default ChatBotService;
