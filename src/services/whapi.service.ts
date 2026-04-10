import axios from 'axios';

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
            const prisma = (await import('../utils/prisma')).default;
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            return config?.whapiToken || this.token;
        } catch (e) {
            return this.token;
        }
    }

    async sendMessage(to: string, body: string) {
        const token = await this.getToken();
        if (!token || token === 'your_whapi_token_here') {
            console.log(`[MOCK WHAPI] Sending to ${to}: ${body}`);
            return { sent: true, mock: true };
        }
        try {
            const response = await axios.post(`${this.apiUrl}/messages/text`, {
                typing_time: 0,
                to: to,
                body: body
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error sending Whapi message:', error.response?.data || error.message);
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
}

export const whapiService = new WhapiService();
