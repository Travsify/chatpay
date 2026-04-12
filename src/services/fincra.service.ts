import axios from 'axios';
import prisma from '../utils/prisma.js';

export class FincraService {
    private async getApiKey() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.fincraSecret || process.env.FINCRA_SECRET_KEY || '';
    }

    private getBaseUrl() {
        return 'https://api.fincra.com';
    }

    private async getHeaders() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        const apiKey = config?.fincraSecret || process.env.FINCRA_SECRET_KEY || '';
        const businessId = config?.fincraBusinessId || process.env.FINCRA_BUSINESS_ID || '693c5533957c9000120117a6';
        
        if (!apiKey) {
            console.error('[Fincra] CRITICAL: No API Key found in DB or Environment!');
        }

        return {
            'api-key': apiKey,
            'x-business-id': businessId,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    
    /**
     * Create a customer object on Fincra.
     * Required for International Virtual Accounts.
     */
    async createCustomer(data: { name: string, email: string, phoneNumber: string, type: 'individual' | 'corporate' }) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/customers`, data, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error creating customer:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Create an NGN virtual account directly (no separate customer step needed).
     * Endpoint: POST /profile/virtual-accounts/requests
     * Docs: https://docs.fincra.com/docs/ngn-virtual-account
     */
    async createVirtualAccount(data: {
        firstName: string,
        lastName: string,
        email: string,
        bvn?: string,
        accountType: 'individual' | 'corporate',
        currency?: string,
        channel?: string,
        merchantReference?: string,
        businessName?: string,
        customerId?: string // Optional, required for some currencies
    }) {
        try {
            const apiKey = await this.getApiKey();
            const baseUrl = this.getBaseUrl();

            const payload: any = {
                currency: data.currency || 'NGN',
                accountType: data.accountType,
                KYCInformation: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                    email: data.email,
                }
            };

            if (data.customerId) {
                payload.customerId = data.customerId;
            }

            // BVN is required for NGN accounts
            if (data.bvn) {
                payload.KYCInformation.bvn = data.bvn;
            }

            // Channel: wema (individual default), globus (corporate)
            if (data.channel) {
                payload.channel = data.channel;
            }

            // For corporate accounts
            if (data.accountType === 'corporate' && data.businessName) {
                payload.KYCInformation.businessName = data.businessName;
                payload.KYCInformation.bvnName = `${data.firstName} ${data.lastName}`;
            }

            if (data.merchantReference) {
                payload.merchantReference = data.merchantReference;
            }

            console.log('[Fincra] Creating virtual account:', JSON.stringify(payload));
            
            const response = await axios.post(`${baseUrl}/profile/virtual-accounts/requests`, payload, {
                headers: await this.getHeaders()
            });

            console.log('[Fincra] Virtual account created:', JSON.stringify(response.data));
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error creating virtual account:', error.response?.status, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get a specific virtual account by ID.
     * Endpoint: GET /profile/virtual-accounts/:id
     */
    async getVirtualAccount(virtualAccountId: string) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/profile/virtual-accounts/${virtualAccountId}`, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error fetching virtual account:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * List all virtual accounts for the merchant.
     * Endpoint: GET /profile/virtual-accounts/?currency=ngn
     */
    async listVirtualAccounts(currency: string = 'ngn') {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/profile/virtual-accounts/?currency=${currency}`, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error listing virtual accounts:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get merchant wallet balances.
     * Endpoint: GET /wallets
     */
    async getWalletBalance() {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/wallets`, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error fetching wallet balance:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get list of supported banks.
     */
    async getBanks(country: string = 'Nigeria') {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/core/banks?country=${country}`, {
                headers: await this.getHeaders()
            });
            return response.data.data || [];
        } catch (error: any) {
            console.error('[Fincra] Error listing banks:', error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Resolve account number to get Account Name.
     */
    async resolveAccount(accountNumber: string, bankCode: string) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.get(`${baseUrl}/core/accounts-resolve?accountNumber=${accountNumber}&bankCode=${bankCode}`, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error resolving account:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Verification failed. Please check account details.');
        }
    }

    /**
     * UTILITIES: Pay Airtime, Data, Power or Cable TV via Fincra
     */
    async payUtility(type: 'airtime' | 'data' | 'power' | 'cabletv', data: any) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/utilities/${type}/pay`, data, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error(`[Fincra] Utility Payment Error (${type}):`, error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Utility payment failed');
        }
    }

    /**
     * CONVERSIONS: Get a quote for swapping currency (e.g. NGN to USD)
     */
    async createConversionQuote(amount: number, from: string, to: string) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/conversions/quotes`, {
                amount,
                sourceCurrency: from,
                destinationCurrency: to
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Conversion Quote Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to get exchange rate');
        }
    }

    /**
     * CONVERSIONS: Execute currency swap using a quote ID
     */
    async convertCurrency(quoteReference: string) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/conversions`, {
                quoteReference
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Conversion Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Conversion failed');
        }
    }

    /**
     * CHECKOUT: Create a one-time payment link for wallet funding
     */
    async createPaymentLink(amount: number, currency: string, customer: { name: string, email: string }, redirectUrl?: string) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/payment-links`, {
                amount,
                currency,
                customer,
                redirectUrl: redirectUrl || 'https://chatpayapp.online',
                type: 'one-time'
            }, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Payment Link Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to generate payment link');
        }
    }

    /**
     * INTERNATIONAL PAYOUTS: Send funds to global banks
     */
    async internationalTransfer(data: {
        amount: number,
        sourceCurrency: string,
        destinationCurrency: string,
        beneficiary: any,
        paymentDestination: 'bank_account' | 'mobile_money'
    }) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/disbursements/payouts`, data, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] International Transfer Error:', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'International transfer failed');
        }
    }

    /**
     * Send a payout (bank transfer).
     * Endpoint: POST /disbursements/payouts
     */
    async transferFunds(data: { 
        amount: number, 
        currency: string, 
        destinationAddress?: string, 
        paymentDestination: 'bank_account',
        beneficiary: {
            firstName: string,
            lastName: string,
            accountNumber: string,
            accountHolderName: string,
            bankCode: string,
            type: 'individual' | 'corporate'
        }
    }) {
        try {
            const baseUrl = this.getBaseUrl();
            const response = await axios.post(`${baseUrl}/disbursements/payouts`, data, {
                headers: await this.getHeaders()
            });
            return response.data;
        } catch (error: any) {
            console.error('[Fincra] Error transferring funds:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const fincraService = new FincraService();
