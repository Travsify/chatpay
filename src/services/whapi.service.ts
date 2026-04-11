import axios from 'axios';
import prisma from '../utils/prisma.js';

export class WhapiService {
    private apiUrl: string;
    private token: string;

    constructor() {
        this.apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
        this.token = process.env.WHAPI_TOKEN || '';
    }

    private async getToken() {
        // PRIORITY 1: Check Database (God Mode Vault)
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            if (config?.whapiToken && config.whapiToken !== '') {
                return config.whapiToken;
            }
        } catch (e) {
            console.error('[Whapi] Failed to fetch token from DB');
        }

        // PRIORITY 2: Fallback to Environment Variable
        if (this.token && this.token !== '' && this.token !== 'your_whapi_token_here') {
            return this.token;
        }

        // PRIORITY 3: Emergency Hardcoded Fallback (for immediate activation)
        return 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImExZDI2YWYyYmY4MjVmYjI5MzVjNWI3OTY3ZDA3YmYwZTMxZWIxYjcifQ.eyJwYXJ0bmVyIjp0cnVlLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vd2hhcGktYTcyMWYiLCJhdWQiOiJ3aGFwaS1hNzIxZiIsImF1dGhfdGltZSI6MTc3NTMyOTE4NCwidXNlcl9pZCI6IjJXakhmM2NIUGRWRVZESVI1VU9tSXgxelNvSTMiLCJzdWIiOiIyV2pIZjNjSFBkVkVWRElSNVVPbUl4MXpTb0kzIiwiaWF0IjoxNzc1MzI5MTg0LCJleHAiOjE4MzU4MDkxODQsImVtYWlsIjoidG9uZXJvY29vbDFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidG9uZXJvY29vbDFAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.OWrB1KfD73sBjRYgE7V-HufKZnvy7aKISRBWFwlK-ilIU4CNejye2q7ckZ0OB4p0jLEow8evUXxVWvdJ9x5kX0Mw_TgzOmbWbUw4-kK_Bt7QUckKhGUMmgh1_e6Cw4_qsD0lj955fDwnQgIVz3wwV3exBSaBbaZJggESlFmkg9f-SP175nYAHCc87eOlm8t3xzN99q6UiUMD1G2RRQpEWDW8f0acZKwomxY_rX1glUI4E6ihg9SpZx7eAtFJ1HvgA0l7uH47k5S6Nl4uwoTq5zhbT1F1MLSu-6iY1xRVa1HnvU3_ffJ7uSP14ht-gsQ-6ZlCXgqSLaLMynPg0pYl4g';
    }

    async sendMessage(to: string, body: string) {
        const token = await this.getToken();
        const cleanTo = to.replace(/\D/g, ''); // Ensure no +, spaces, etc.
        
        console.log(`[Whapi] Sending message to ${cleanTo} using token: ${token.substring(0, 5)}...`);
        
        if (!token || token === '' || token === 'your_whapi_token_here') {
            console.log(`[MOCK WHAPI] Sending to ${cleanTo}: ${body}`);
            return { sent: true, mock: true };
        }
        try {
            const response = await axios.post(`${this.apiUrl}/messages/text`, {
                typing_time: 0,
                to: cleanTo,
                body: body
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            console.log(`[Whapi] Response Status: ${response.status} | Data:`, JSON.stringify(response.data));
            return response.data;
        } catch (error: any) {
            console.error('Whapi delivery failure:', error.response?.data || error.message);
            throw error;
        }
    }

    async sendImage(to: string, mediaUrl: string, caption?: string) {
        const token = await this.getToken();
        try {
            const response = await axios.post(`${this.apiUrl}/messages/image`, {
                to: to,
                media: mediaUrl,
                caption: caption
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error sending Whapi image:', error.response?.data || error.message);
            throw error;
        }
    }

    async registerWebhook(webhookUrl: string) {
        const token = await this.getToken();
        try {
            const response = await axios.patch(`${this.apiUrl}/settings`, {
                webhooks: [
                    {
                        url: webhookUrl,
                        events: [
                            { type: "messages", method: "post" },
                            { type: "statuses", method: "post" }
                        ],
                        mode: "full"
                    }
                ]
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error registering Whapi webhook:', error.response?.data || error.message);
            throw error;
        }
    }
    async getChannelHealth() {
        const token = await this.getToken();
        try {
            const response = await axios.get(`${this.apiUrl}/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error: any) {
             return { status: 'ERROR', error: error.response?.data || error.message };
        }
    }
}

export const whapiService = new WhapiService();
