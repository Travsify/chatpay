"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiService = exports.AiService = void 0;
const openai_1 = __importDefault(require("openai"));
class AiService {
    openai;
    constructor() {
        this.openai = new openai_1.default({
            apiKey: process.env.OPENAI_API_KEY
        });
    }
    async parseIntent(message, context) {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
            console.log(`[MOCK AI] Parsing: "${message}"`);
            const lower = message.toLowerCase();
            if (lower.includes('sign') || lower.includes('hi'))
                return { intent: 'SIGNUP' };
            if (lower.includes('send') || lower.includes('pay'))
                return { intent: 'SEND_FUNDS', entities: { amount: 2500, recipient: 'Peter' } };
            if (lower.includes('bvn') || lower.length >= 10)
                return { intent: 'UNKNOWN' }; // Let the state machine handle it
            return { intent: 'UNKNOWN' };
        }
        try {
            const systemPrompt = `
                You are ChatPay AI, a financial assistant. 
                Extract the user's intent and entities from their message.
                Intents: SIGNUP, SEND_FUNDS, PAY_BILL, CHECK_BALANCE, INVOICE, UNKNOWN.
                Return JSON only.
                Example: "Create invoice for 50k for logo design" -> { "intent": "INVOICE", "entities": { "amount": 50000, "description": "logo design" } }
                Example: "Send 5k to John" -> { "intent": "SEND_FUNDS", "entities": { "amount": 5000, "recipient": "John" } }
            `;
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                response_format: { type: "json_object" }
            });
            const content = response.choices[0].message.content;
            return JSON.parse(content || '{}');
        }
        catch (error) {
            console.error('Error in AiService:', error);
            return { intent: 'UNKNOWN' };
        }
    }
    async generateResponse(prompt) {
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
            return "Mock AI Response: How can I help you with your ChatPay wallet today?";
        }
        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }]
            });
            return response.choices[0].message.content || "I'm sorry, I didn't quite catch that.";
        }
        catch (error) {
            console.error('Error generating AI response:', error);
            return "I'm having trouble thinking right now. Please try again later.";
        }
    }
}
exports.AiService = AiService;
exports.aiService = new AiService();
//# sourceMappingURL=ai.service.js.map