"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fincraService = exports.FincraService = void 0;
const axios_1 = __importDefault(require("axios"));
class FincraService {
    apiUrl;
    apiKey;
    constructor() {
        this.apiUrl = process.env.FINCRA_BASE_URL || 'https://api.fincra.com';
        this.apiKey = process.env.FINCRA_API_KEY || '';
    }
    async createCustomer(data) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/core/customers`, data, {
                headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error creating Fincra customer:', error.response?.data || error.message);
            throw error;
        }
    }
    async createVirtualAccount(data) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/core/virtual-accounts`, data, {
                headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error creating Fincra virtual account:', error.response?.data || error.message);
            throw error;
        }
    }
    async getWalletBalance(walletId) {
        try {
            const response = await axios_1.default.get(`${this.apiUrl}/core/wallets/${walletId}`, {
                headers: { 'api-key': this.apiKey }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error fetching Fincra wallet balance:', error.response?.data || error.message);
            throw error;
        }
    }
    async transferFunds(data) {
        try {
            const response = await axios_1.default.post(`${this.apiUrl}/core/disbursements`, data, {
                headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        }
        catch (error) {
            console.error('Error transferring funds via Fincra:', error.response?.data || error.message);
            throw error;
        }
    }
}
exports.FincraService = FincraService;
exports.fincraService = new FincraService();
//# sourceMappingURL=fincra.service.js.map