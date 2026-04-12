import axios from 'axios';
import prisma from '../utils/prisma.js';

class BitnobService {
    private async getHeaders() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        const apiKey = config?.bitnobApiKey || process.env.BITNOB_API_KEY;
        return {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    private getBaseUrl() {
        // Defaulting to production, change to sandbox for testing
        return process.env.NODE_ENV === 'production' 
            ? 'https://api.bitnob.co/api/v1' 
            : 'https://sandboxapi.bitnob.co/api/v1';
    }

    /**
     * VIRTUAL CARDS: Create a Premium USD Virtual Card
     */
    async createVirtualCard(data: {
        customerEmail: string,
        amount: number, // in USD (cents)
        firstName: string,
        lastName: string,
        cardName?: string
    }) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/virtualcards/register/visa`, {
                amount: data.amount,
                firstName: data.firstName,
                lastName: data.lastName,
                email: data.customerEmail,
                cardName: data.cardName || 'ChatPay Premium'
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Bitnob] Card Creation Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create premium card');
        }
    }

    /**
     * WALLETS: Create a BTC/USDT/USD wallet for a user
     */
    async createWallet(customerEmail: string, asset: 'btc' | 'usdt' | 'usd') {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/wallets`, {
                email: customerEmail,
                asset: asset.toLowerCase()
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Bitnob] Wallet Creation Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to initialize crypto wallet');
        }
    }

    /**
     * LIGHTNING: Generate a Lightning Invoice
     */
    async createLightningInvoice(amount: number, description: string) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/wallets/lightning/invoice`, {
                amount,
                description,
                callbackUrl: `${process.env.BASE_URL}/webhook/bitnob`
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Bitnob] Lightning invoice Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to generate invoice');
        }
    }

     /**
     * LIGHTNING: Send to a Lightning Address or LNURL
     */
    async sendLightning(data: { address: string, amount: number, comment?: string }) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/wallets/lightning/send`, data, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Bitnob] Lightning Send Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Lightning transfer failed');
        }
    }

    /**
     * SWAPS: Perform instant swap between assets
     */
    async swap(data: { amount: number, from: string, to: string }) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/swaps`, {
                amount: data.amount,
                from: data.from.toLowerCase(),
                to: data.to.toLowerCase()
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Bitnob] Swap Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Asset swap failed');
        }
    }

    /**
     * BALANCES: Get business or user wallet balance
     */
    async getBalances() {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/wallets`, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('[Bitnob] Balance Fetch Error:', error);
            throw new Error('Could not retrieve balances');
        }
    }

    /**
     * MARKET: Get real-time price of an asset (e.g. BTC)
     */
    async getCurrentPrice(asset: string = 'btc') {
        try {
            const baseUrl = this.getBaseUrl();
            // Bitnob typically has an exchange rates or market price endpoint
            const response = await axios.get(`${baseUrl}/rates`, {
                headers: await this.getHeaders()
            });
            // Result is typically a list of pairs like BTC/USD
            return response.data;
        } catch (error) {
            console.error('[Bitnob] Price Fetch Error:', error);
            return null;
        }
    }
}

export const bitnobService = new BitnobService();
