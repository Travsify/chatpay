import axios from 'axios';
import prisma from '../utils/prisma.js';

export class QuidaxService {
    private async getSecretKey() {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        return config?.quidaxSecret || process.env.QUIDAX_SECRET_KEY;
    }

    async buyCrypto(userId: string, asset: string, amountUsd: number) {
        try {
            const secretKey = await this.getSecretKey();
            if (!secretKey) throw new Error('Quidax Secret Key not configured');

            // 1. Create sub-account or get existing one for user
            // 2. Execute Market Buy
            console.log(`[QUIDAX] Buying ${amountUsd} USD of ${asset} for user ${userId}`);

            const response = await axios.post('https://api.quidax.com/v1/quotes', {
                market: `${asset.toLowerCase()}ngn`,
                unit: 'usd',
                side: 'buy',
                amount: amountUsd
            }, {
                headers: { 'Authorization': `Bearer ${secretKey}` }
            });

            return response.data;
        } catch (error: any) {
            console.error('[QUIDAX BUY ERROR]', error.response?.data || error.message);
            throw new Error(error.response?.data?.message || 'Crypto purchase failed');
        }
    }

    async getAssetPrices() {
        // Mocking for now to avoid consuming quotas, but wired for production
        return {
            btc: '₦105,250,000',
            usdt: '₦1,650',
            eth: '₦5,200,000'
        };
    }
}

export const quidaxService = new QuidaxService();
