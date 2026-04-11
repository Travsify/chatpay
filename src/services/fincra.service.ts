import axios from 'axios';
import prisma from '../utils/prisma.js';

export class FincraService {
    private async getApiKey() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.fincraSecret || process.env.FINCRA_API_KEY || '';
    }

    private async getBaseUrl() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.whapiApiUrl?.includes('sandbox') ? 'https://sandbox-api.fincra.com' : 'https://api.fincra.com';
    }

    async createCustomer(data: { firstName: string, lastName: string, email: string, phoneNumber: string, type: 'individual' | 'business' }) {
        try {
            const apiKey = await this.getApiKey();
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/core/customers`, data, {
                headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error creating Fincra customer:', error.response?.data || error.message);
            throw error;
        }
    }

    async createVirtualAccount(data: { currency: string, accountType: 'default' | 'mapped', customerId: string }) {
        try {
            const apiKey = await this.getApiKey();
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/core/virtual-accounts`, data, {
                headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error creating Fincra virtual account:', error.response?.data || error.message);
            throw error;
        }
    }
    
    async listVirtualAccounts(customerId: string) {
        try {
            const apiKey = await this.getApiKey();
            const baseUrl = await this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/core/virtual-accounts?customer=${customerId}`, {
                headers: { 'api-key': apiKey }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error listing Fincra virtual accounts:', error.response?.data || error.message);
            throw error;
        }
    }

    async getWalletBalance(walletId: string) {
        try {
            const apiKey = await this.getApiKey();
            const baseUrl = await this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/core/wallets/${walletId}`, {
                headers: { 'api-key': apiKey }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error fetching Fincra wallet balance:', error.response?.data || error.message);
            throw error;
        }
    }

    async transferFunds(data: { amount: number, currency: string, destinationAddress: string, paymentDestination: 'fincra_wallet' | 'bank_account' }) {
        try {
            const apiKey = await this.getApiKey();
            const baseUrl = await this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/core/disbursements`, data, {
                headers: { 'api-key': apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error transferring funds via Fincra:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const fincraService = new FincraService();
