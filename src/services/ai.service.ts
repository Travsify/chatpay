import OpenAI from 'openai';
import prisma from '../utils/prisma.js';

export interface IntentResult {
    intent: 'SIGNUP' | 'SEND_FUNDS' | 'INTERNATIONAL_TRANSFER' | 'PAY_BILL' | 'CHECK_BALANCE' | 'INVOICE' | 'CRYPTO' | 'CARD' | 'GIFTCARD' | 'OPEN_ACCOUNT' | 'SCHEDULE_TASK' | 'CONVERT' | 'GENERATE_VOUCHER' | 'REDEEM_VOUCHER' | 'CHECK_BUDGET' | 'UNKNOWN';
    entities?: {
        amount?: number;
        recipient?: string;
        billType?: string;
        asset?: string;
        currency?: string;
        country?: string;
        date?: string; // For scheduling
        priceCondition?: number; // For "Buy the Dip"
        recurring?: boolean;
        language?: string; // For translation logic
    };
    response?: string;
    actions?: string[]; // A sequence of actions to perform
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
                You are ChatPay AI Agent, a sophisticated multi-step financial assistant. 
                Extract intent, entities, and required ACTIONS.
                We speak English, Pidgin, Yoruba, Igbo, and Hausa.
                
                Intents: SIGNUP, SEND_FUNDS, INTERNATIONAL_TRANSFER, PAY_BILL, CHECK_BALANCE, INVOICE, CRYPTO, CARD, GIFTCARD, OPEN_ACCOUNT, SCHEDULE_TASK, CONVERT, UNKNOWN.
                
                Examples:
                1. "Abeg pay 50k for light on Friday" -> { "intent": "SCHEDULE_TASK", "entities": { "amount": 50000, "billType": "Electricity", "date": "next Friday" }, "actions": ["SCHEDULE_BILL"] }
                2. "Swap 20k to USDT and fund my card" -> { "intent": "CONVERT", "entities": { "amount": 20000, "asset": "USDT" }, "actions": ["SWAP", "FUND_CARD"] }
                3. "If BTC fall enter $60k, buy me 10k" -> { "intent": "SCHEDULE_TASK", "entities": { "amount": 10000, "asset": "BTC", "priceCondition": 60000 }, "actions": ["AUTO_BUY"] }
                4. "How much did I spend this week?" -> { "intent": "CHECK_BUDGET" }
                5. "Send 500 cedis to Ghana" -> { "intent": "INTERNATIONAL_TRANSFER", "entities": { "amount": 500, "currency": "GHS", "country": "Ghana" } }
                
                Return JSON only.
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

    /**
     * Agent Vision: Scrapes data from a document or image
     */
    async scrapeDocument(buffer: Buffer, mimeType: string): Promise<any> {
        const openai = await this.getOpenAI();
        if (!openai) return { error: "Vision AI unavailable" };

        try {
            const base64 = buffer.toString('base64');
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a specialized Fintech Document Scraper. Extract Beneficiary Name, Bank Name, Account Number, and Amount from this invoice/receipt. Return JSON only."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Please extract payment details from this document." },
                            { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } }
                        ]
                    }
                ],
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content || '{}');
        } catch (error) {
            console.error('[AI Vision] Scrape failed:', error);
            return null;
        }
    }

    /**
     * Agent Advisor: Performs a deep dive into user spending habits
     */
    async analyzeSpending(transactions: any[]): Promise<string> {
        const openai = await this.getOpenAI();
        if (!openai) return "Budgeting logic unavailable.";

        try {
            const txSummary = transactions.map(tx => `[${tx.createdAt}] ${tx.type}: ₦${tx.amount} (${tx.description})`).join('\n');
            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [
                    {
                        role: "system",
                        content: "You are a professional Financial Advisor for ChatPay. Analyze the user's spending habits and provide a concise, helpful summary in second-person. Highlight trends, high spending categories, and offer one practical saving tip. Be friendly and professional."
                    },
                    {
                        role: "user",
                        content: `Here is my transaction history for the last period:\n\n${txSummary}`
                    }
                ]
            });

            return response.choices[0].message.content || "I'm still analyzing your data. Check back soon!";
        } catch (error) {
            console.error('[AI Advisor] Analysis failed:', error);
            return "I couldn't analyze your spending at this time.";
        }
    }
}

export const aiService = new AiService();
