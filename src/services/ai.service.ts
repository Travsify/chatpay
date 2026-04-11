import OpenAI from 'openai';
import prisma from '../utils/prisma.js';

export interface IntentResult {
    intent: 'SIGNUP' | 'SEND_FUNDS' | 'PAY_BILL' | 'CHECK_BALANCE' | 'INVOICE' | 'UNKNOWN';
    entities?: {
        amount?: number;
        recipient?: string;
        billType?: string;
        name?: string;
        description?: string;
    };
    response?: string;
}

export class AiService {
    private openai: OpenAI;

    private async getOpenAI(): Promise<OpenAI | null> {
        if (this.openai) return this.openai;
        
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            const key = config?.openaiKey || process.env.OPENAI_API_KEY;
            
            if (key && key !== 'your_openai_api_key_here' && key !== '') {
                this.openai = new OpenAI({ apiKey: key });
                return this.openai;
            }
        } catch (e) {}
        return null;
    }

    async parseIntent(message: string, context?: any): Promise<IntentResult> {
        const openai = await this.getOpenAI();
        if (!openai) {
            console.log(`[MOCK AI] No API key, using mock for: "${message}"`);
            const lower = message.toLowerCase();
            const greetings = ['hi', 'hello', 'hey', 'yo', 'sup', 'morning', 'afternoon', 'evening', '👋'];
            if (greetings.some(g => lower.includes(g))) return { intent: 'SIGNUP' };
            if (lower.includes('send') || lower.includes('pay') || lower.includes('transfer')) return { intent: 'SEND_FUNDS', entities: { amount: 2500, recipient: 'Peter' } };
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

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: message }
                ],
                response_format: { type: "json_object" }
            });

            const content = response.choices[0].message.content;
            return JSON.parse(content || '{}') as IntentResult;
        } catch (error) {
            console.error('Error in AiService:', error);
            return { intent: 'UNKNOWN' };
        }
    }

    async generateResponse(prompt: string): Promise<string> {
        const openai = await this.getOpenAI();
        if (!openai) {
            return "Mock AI Response: How can I help you with your ChatPay wallet today?";
        }
        try {
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: prompt }]
            });
            return response.choices[0].message.content || "I'm sorry, I didn't quite catch that.";
        } catch (error) {
            console.error('Error generating AI response:', error);
            return "I'm having trouble thinking right now. Please try again later.";
        }
    }
}

export const aiService = new AiService();
