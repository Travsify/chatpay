import axios from 'axios';
import prisma from '../utils/prisma.js';

export class MapleradService {
    private async getSecretKey() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.mapleradSecret || process.env.MAPLERAD_SECRET_KEY;
    }

    async createVirtualCard(userId: string, currency: 'USD' | 'NGN' = 'USD', amount: number) {
        try {
            const secretKey = await this.getSecretKey();
            if (!secretKey) throw new Error('Maplerad API Key not configured');

            const response = await axios.post('https://api.maplerad.com/v1/issuing/cards', {
                type: 'VIRTUAL',
                currency: currency,
                amount: amount * 100, // In cents/kobo
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
        // Return active cards from database/API
        return [];
    }
}

export const mapleradService = new MapleradService();
