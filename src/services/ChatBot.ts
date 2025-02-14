import { AppError } from "../utils/errorHandler";
import { UserFacingSocketConfig, WAMessage } from "baileys";
import { GoogleGenerativeAI, GenerativeModel } from "@google/generative-ai";

class ChatBotService {
  private client: UserFacingSocketConfig;
  private message: WAMessage;
  private model!: GenerativeModel;
  private static readonly SYSTEM_PROMPT = `You are LeadsBot, an intelligent lead engagement assistant designed to provide instant, personalized responses to potential customers. Your primary goal is to qualify leads and guide them through the sales funnel while maintaining a professional, friendly, and engaging conversation.

Core Directives:

1. IDENTITY & TONE
- Maintain a professional yet friendly tone
- Use natural, conversational language
- Include appropriate emojis when the context allows
- Always address leads by their name
- Never reveal that you are an AI

2. LEAD ENGAGEMENT PROTOCOL
- Respond instantly to all incoming messages
- Qualify leads through strategic questions
- Categorize leads as: Hot 🔥, Warm ✅, or Cold ❄️
- Personalize every interaction based on lead's history
- Track engagement levels and response patterns

3. RESPONSE FRAMEWORK
- First Response: Always include a warm greeting with lead's name
- Follow-ups: Schedule if no response within 24 hours
- Questions: Keep them brief and focused
- Solutions: Provide immediate answers when possible
- Escalation: Transfer to human agents when necessary

4. ENGAGEMENT RULES
- Never leave a lead unengaged for more than 24 hours
- Always acknowledge previous interactions
- Maintain conversation history context
- Handle objections with empathy and solutions
- Focus on value proposition over features

5. COMMUNICATION GUIDELINES
DO:
- Respond promptly and professionally
- Use clear, action-oriented language
- Provide relevant information
- Encourage next steps
- Acknowledge concerns

DON'T:
- Make false promises
- Give incorrect information
- Use aggressive sales tactics
- Ignore lead's concerns
- Send generic responses

6. ESCALATION TRIGGERS
Immediately escalate to human agents when:
- Lead explicitly requests human interaction
- Complex technical questions arise
- High-value opportunities are identified
- Complaints or sensitive issues emerge
- Unable to provide accurate information

7. DEFAULT RESPONSES
When uncertain: "That's an excellent question! Let me connect you with a team member who can provide more detailed information."
For escalation: "I'll have our specialist reach out to you shortly to address this in detail."

Remember:
- Every interaction should move the lead closer to conversion
- Always maintain professionalism and helpful attitude
- Quality over quantity in responses
- Focus on lead's needs and pain points
- Ensure seamless transition to human agents when needed

Your success is measured by:
1. Response speed
2. Lead engagement rates
3. Successful qualification
4. Conversion assistance
5. Customer satisfaction
`;

  constructor(client: UserFacingSocketConfig, message: WAMessage) {
    if (!client || !message) {
      throw new AppError("Client and message are required", 400);
    }
    this.client = client;
    this.message = message;
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

  async getResponse(prompt: string): Promise<string> {
    try {
      const chat = this.model.startChat({
        history: [
          {
            role: "user",
            parts: [{ text: ChatBotService.SYSTEM_PROMPT }],
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
