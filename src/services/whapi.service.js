"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.whapiService = exports.WhapiService = void 0;
const axios_1 = __importDefault(require("axios"));
class WhapiService {
    apiUrl;
    token;
    constructor() {
        this.apiUrl = process.env.WHAPI_API_URL || 'https://gate.whapi.cloud';
        this.token = process.env.WHAPI_TOKEN || '';
    }
    async sendMessage(to, body) {
        if (!this.token || this.token === 'your_whapi_token_here') {
            console.log(`[MOCK WHAPI] Sending to ${to}: ${body}`);
            return { sent: true, mock: true };
        }
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/messages/text`, {
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
        }
        catch (error) {
            console.error('Error sending Whapi message:', error.response?.data || error.message);
            throw error;
        }
    }
    async sendImage(to, mediaUrl, caption) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/messages/image`, {
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
        }
        catch (error) {
            console.error('Error sending Whapi image:', error.response?.data || error.message);
            throw error;
        }
    }
}
exports.WhapiService = WhapiService;
exports.whapiService = new WhapiService();
//# sourceMappingURL=whapi.service.js.map