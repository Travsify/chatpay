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
export declare class AiService {
    private openai;
    constructor();
    parseIntent(message: string, context?: any): Promise<IntentResult>;
    generateResponse(prompt: string): Promise<string>;
}
export declare const aiService: AiService;
//# sourceMappingURL=ai.service.d.ts.map