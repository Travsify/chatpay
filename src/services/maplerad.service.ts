import axios from 'axios';
import prisma from '../utils/prisma.js';

export class MapleradService {
    private async getSecretKey() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.mapleradSecret || process.env.MAPLERAD_SECRET_KEY;
    }

    /**
     * Get or create a Maplerad customer for a ChatPay user.
     */
    async getOrCreateCustomer(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new Error('User not found');
        if (user.mapleradCustomerId) return user.mapleradCustomerId;

        const secretKey = await this.getSecretKey();
        const names = (user.name || 'ChatPay User').split(' ');
        const firstName = names[0];
        const lastName = names.slice(1).join(' ') || 'Customer';

        try {
            const response = await axios.post('https://api.maplerad.com/v1/customers', {
                first_name: firstName,
                last_name: lastName,
                email: user.email || `${user.phoneNumber}@chatpay.io`,
                country: 'NG'
            }, {
                headers: { 'Authorization': `Bearer ${secretKey}` }
            });

            const customerId = response.data.data.id;
            await prisma.user.update({
                where: { id: userId },
                data: { mapleradCustomerId: customerId }
            });

            return customerId;
        } catch (error: any) {
            console.error('[MAPLERAD CUSTOMER ERROR]', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to create Maplerad customer');
        }
    }

    async createVirtualCard(userId: string, currency: 'USD' | 'NGN' = 'USD', amount: number) {
        try {
            const secretKey = await this.getSecretKey();
            if (!secretKey) throw new Error('Maplerad API Key not configured');

            const customerId = await this.getOrCreateCustomer(userId);

            const response = await axios.post('https://api.maplerad.com/v1/issuing/cards', {
                customer_id: customerId,
                type: 'VIRTUAL',
                currency: currency,
                amount: Math.round(amount * 100), // In cents/kobo
                auto_upgrade: true
            }, {
                headers: { 'Authorization': `Bearer ${secretKey}` }
            });

            return response.data;
        } catch (error: any) {
            console.error('[MAPLERAD CARD ERROR]', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Failed to issue virtual card');
        }
    }

    async getCards(userId: string) {
        try {
            const secretKey = await this.getSecretKey();
            const customerId = await this.getOrCreateCustomer(userId);
            
            const response = await axios.get(`https://api.maplerad.com/v1/issuing/cards?customer_id=${customerId}`, {
                headers: { 'Authorization': `Bearer ${secretKey}` }
            });
            return response.data.data || [];
        } catch (error) {
            return [];
        }
    }
}

export const mapleradService = new MapleradService();
