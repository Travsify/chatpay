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
        if (this.token && this.token !== '' && this.token !== 'your_whapi_token_here') return this.token;
        
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            return config?.whapiToken || this.token;
        } catch (e) {
            return this.token;
        }
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
}

export const whapiService = new WhapiService();
