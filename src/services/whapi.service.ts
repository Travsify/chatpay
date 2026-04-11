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

        // FINAL SANITIZATION: DEFINITIVE FIX - Aggressive ASCII filter + Latin1 Buffer encoding
        // This removes ALL non-header-safe characters including newlines, tabs, and hidden Unicode.
        const clean = rawToken.replace(/[^\x20-\x7E]/g, '').trim();
        return Buffer.from(clean, 'utf-8').toString('latin1');
    }

    async sendMessage(to: string, body: string) {
        const token = await this.getToken();
        const cleanTo = to.replace(/\D/g, ''); // Ensure no +, spaces, etc.
        
        console.log(`[Whapi] Sending message to ${cleanTo}...`);
        
        if (!token || token === '' || token === 'your_whapi_token_here') {
            console.log(`[MOCK WHAPI] Sending to ${cleanTo}: ${body}`);
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
        
        // Debug logging (masking middle for security)
        const maskedToken = token ? `${token.substring(0, 6)}...${token.substring(token.length - 4)}` : 'NONE';
        console.log(`[Whapi] Attempting to sync webhook to ${webhookUrl} using token: ${maskedToken}`);

        try {
            const apiUrl = await this.getUrl();
            // Updated structure to match standard Whapi.cloud settings payload
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
            console.log('[Whapi] Sync success:', response.status);
            return response.data;
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            console.error('[Whapi] Sync failure details:', JSON.stringify(errorData));
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
            console.error('[Whapi] Media download failed:', error.message);
            throw error;
        }
    }

    async sendAudio(to: string, audioBuffer: Buffer) {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        try {
            // WHAPI uses base64 for direct buffer uploads
            const base64 = `data:audio/ogg;base64,${audioBuffer.toString('base64')}`;
            const response = await axios.post(`${apiUrl}/messages/audio`, {
                to,
                media: base64
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[Whapi] Audio send failed:', error.response?.data || error.message);
        }
    }

    async sendList(to: string, text: string, buttonText: string, rows: { id: string; title: string; description?: string }[]) {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        let cleanTo = to.replace(/\D/g, '');
        if (!cleanTo.includes('@')) cleanTo += '@s.whatsapp.net';

        try {
            const response = await axios.post(`${apiUrl}/messages/interactive`, {
                to: cleanTo,
                type: 'list',
                body: { text: text },
                action: {
                    button: buttonText,
                    sections: [{
                        title: "Services",
                        rows: rows.map(r => ({
                            id: r.id,
                            title: r.title.replace(/[^\w\s]/gi, '').trim(), // Strip emojis for stability test
                            description: r.description
                        }))
                    }]
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            console.error('[Whapi] List send failed, falling back to text:', JSON.stringify(errorData));
            
            // Format fallback text
            let fallbackText = `${text}\n\n*${buttonText}:*\n`;
            rows.forEach((row, idx) => {
                fallbackText += `${idx + 1}. *${row.title}*${row.description ? ` - ${row.description}` : ''}\n`;
            });
            fallbackText += `\n_Reply with the option name or number._`;

            return await this.sendMessage(cleanTo, fallbackText);
        }
    }

    async sendButtons(to: string, text: string, buttons: { id: string; title: string }[], footer?: string) {
        const token = await this.getToken();
        const apiUrl = await this.getUrl();
        let cleanTo = to.replace(/\D/g, '');
        if (!cleanTo.includes('@')) cleanTo += '@s.whatsapp.net';

        try {
            const response = await axios.post(`${apiUrl}/messages/interactive`, {
                to: cleanTo,
                type: 'button',
                body: { text: text },
                footer: footer ? { text: footer } : undefined,
                action: {
                    buttons: buttons.map(b => ({
                        type: 'reply',
                        reply: { id: b.id, title: b.title }
                    }))
                }
            }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            return response.data;
        } catch (error: any) {
            console.error('[Whapi] Button send failed, falling back to text:', error.response?.data || error.message);
            let fallbackText = `${text}\n\n`;
            buttons.forEach(b => {
                fallbackText += `• *${b.title}*\n`;
            });
            if (footer) fallbackText += `\n_${footer}_`;
            return await this.sendMessage(cleanTo, fallbackText);
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
             console.error('[Whapi] Health Check Failed:', error.response?.data?.message || error.message);
             return { status: 'ERROR', error: error.response?.data || error.message };
        }
    }
}

export const whapiService = new WhapiService();
