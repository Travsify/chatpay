import axios from 'axios';

export class FincraService {
    private apiUrl: string;
    private apiKey: string;

    constructor() {
        this.apiUrl = process.env.FINCRA_BASE_URL || 'https://api.fincra.com';
        this.apiKey = process.env.FINCRA_API_KEY || '';
    }

    async createCustomer(data: { firstName: string, lastName: string, email: string, phoneNumber: string, type: 'individual' | 'business' }) {
        try {
            const response = await axios.post(`${this.apiUrl}/core/customers`, data, {
                headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error creating Fincra customer:', error.response?.data || error.message);
            throw error;
        }
    }

    async createVirtualAccount(data: { currency: string, accountType: 'default' | 'mapped', customerId: string }) {
        try {
            const response = await axios.post(`${this.apiUrl}/core/virtual-accounts`, data, {
                headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error creating Fincra virtual account:', error.response?.data || error.message);
            throw error;
        }
    }

    async getWalletBalance(walletId: string) {
        try {
            const response = await axios.get(`${this.apiUrl}/core/wallets/${walletId}`, {
                headers: { 'api-key': this.apiKey }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error fetching Fincra wallet balance:', error.response?.data || error.message);
            throw error;
        }
    }

    async transferFunds(data: { amount: number, currency: string, destinationAddress: string, paymentDestination: 'fincra_wallet' | 'bank_account' }) {
        try {
            const response = await axios.post(`${this.apiUrl}/core/disbursements`, data, {
                headers: { 'api-key': this.apiKey, 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error: any) {
            console.error('Error transferring funds via Fincra:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const fincraService = new FincraService();
