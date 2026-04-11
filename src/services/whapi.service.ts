import axios from 'axios';
import prisma from '../utils/prisma.js';

export class WhapiService {
    private apiUrl: string;
    private token: string;

    constructor() {
        this.apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
        this.token = process.env.WHAPI_TOKEN || '';
    }

    private async getUrl() {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            if (config?.whapiApiUrl && config.whapiApiUrl.trim() !== '') {
                // Aggressive ASCII-only filter
                let url = config.whapiApiUrl.trim().replace(/[^\x20-\x7E]/g, '');
                return url.endsWith('/') ? url.slice(0, -1) : url;
            }
        } catch (e) {
            console.error('[Whapi] Failed to fetch URL from DB');
        }
        return process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
    }

    private async getToken() {
        let rawToken = '';
        
        // PRIORITY 0: Check Database (God Mode Vault)
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            if (config?.whapiToken && config.whapiToken.trim() !== '') {
                rawToken = config.whapiToken.trim();
            }
        } catch (e) {
            console.error('[Whapi] Failed to fetch token from DB');
        }

        // PRIORITY 1: Direct Environment Override
        if (!rawToken && process.env.WHAPI_TOKEN && process.env.WHAPI_TOKEN !== '' && process.env.WHAPI_TOKEN !== 'your_whapi_token_here') {
            rawToken = process.env.WHAPI_TOKEN.trim();
        }

        // PRIORITY 2: Emergency Hardcoded Fallback
        if (!rawToken) {
            rawToken = 'eoR2mA57NDEn40E6OrfrD6y5PcajTBjx';
        }

        // FINAL SANITIZATION
        const clean = rawToken.replace(/[^\x20-\x7E]/g, '').trim();
        return Buffer.from(clean, 'utf-8').toString('latin1');
    }

    async sendMessage(to: string, body: string) {
        const token = await this.getToken();
        const cleanTo = to.replace(/\D/g, ''); 
        
        if (!token || token === '' || token === 'your_whapi_token_here') {
            return { sent: true, mock: true };
        }
        try {
            const apiUrl = await this.getUrl();
            const response = await axios.post(`${apiUrl}/messages/text`, {
                typing_time: 0,
                to: cleanTo,
                body: body
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('Whapi delivery failure:', error.response?.data || error.message);
            throw error;
        }
    }

    async sendImage(to: string, mediaUrl: string, caption?: string) {
        const token = await this.getToken();
        try {
            const apiUrl = await this.getUrl();
            const response = await axios.post(`${apiUrl}/messages/image`, {
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
            const apiUrl = await this.getUrl();
            const response = await axios.patch(`${apiUrl}/settings`, {
                webhooks: [
                    {
                        url: webhookUrl,
                        events: [
                            { type: "messages", method: "post" },
                            { type: "statuses", method: "post" }
                        ],
                        mode: "body"
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
            throw error;
        }
    }

    async getFileBuffer(fileId: string): Promise<Buffer> {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        try {
            const response = await axios.get(`${apiUrl}/media/${fileId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'arraybuffer'
            });
            return Buffer.from(response.data);
        } catch (error: any) {
            throw error;
        }
    }

    async sendAudio(to: string, audioBuffer: Buffer) {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        try {
            const base64 = `data:audio/ogg;base64,${audioBuffer.toString('base64')}`;
            await axios.post(`${apiUrl}/messages/audio`, { to, media: base64 }, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        } catch (error: any) {
            console.error('[Whapi] Audio send failed:', error.response?.data || error.message);
        }
    }

    async sendButtons(to: string, text: string, buttons: { id: string, title: string }[]) {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        const numericTo = to.replace(/\D/g, '');
        const payload = {
            to: numericTo,
            body: { text: text },
            typing_time: 0,
            action: {
                buttons: buttons.map(b => ({
                    type: 'quick_reply',
                    reply: {
                        id: b.id,
                        title: b.title.substring(0, 20)
                    }
                }))
            }
        };

        try {
            await axios.post(`${apiUrl}/messages/interactive`, payload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        } catch (error: any) {
            console.error('[Whapi] Button send failed, falling back to text:', error.response?.data || error.message);
            const btnList = buttons.map((b, i) => `${i + 1}. *${b.title}*`).join('\n');
            await this.sendMessage(numericTo, `${text}\n\n${btnList}`);
        }
    }

    async sendList(to: string, text: string, button: string, options: { id: string, title: string, description?: string }[]) {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        const numericTo = to.replace(/\D/g, '');
        const payload = {
            to: numericTo,
            body: { text: text },
            typing_time: 0,
            action: {
                button,
                sections: [
                    {
                        title: button.substring(0, 24),
                        rows: options.map(opt => ({
                            id: opt.id,
                            title: opt.title.substring(0, 24),
                            description: opt.description?.substring(0, 72)
                        }))
                    }
                ]
            }
        };

        try {
            await axios.post(`${apiUrl}/messages/interactive`, payload, {
                headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
            });
        } catch (error: any) {
            console.error('[Whapi] List send failed, falling back to text:', error.response?.data || error.message);
            const listItems = options.map((opt, i) => `${i + 1}. *${opt.title}*`).join('\n');
            await this.sendMessage(numericTo, `${text}\n\n${listItems}`);
        }
    }

    async getChannelHealth() {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        try {
            const response = await axios.get(`${apiUrl}/health`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            return response.data;
        } catch (error: any) {
             return { status: 'ERROR' };
        }
    }
}

export const whapiService = new WhapiService();
