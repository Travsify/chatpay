import axios from 'axios';

export class WhapiService {
    private apiUrl: string;
    private token: string;

    constructor() {
        this.apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
        this.token = process.env.WHAPI_TOKEN || '';
    }

    async sendMessage(to: string, body: string) {
        if (!this.token || this.token === 'your_whapi_token_here') {
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
                    'Authorization': `Bearer ${this.token}`,
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
        try {
            const response = await axios.post(`${this.apiUrl}/messages/image`, {
                to: to,
                media: mediaUrl,
                caption: caption
            }, {
                headers: {
                    'Authorization': `Bearer ${this.token}`,
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
