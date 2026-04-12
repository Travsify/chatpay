import prisma from '../utils/prisma.js';
import axios from 'axios';

export class SyncService {
    
    /**
     * Synchronize transactions from Fincra.
     * @param depth How many pages to scan back. Default is 2 (for delta sync).
     */
    static async syncFincra(depth: number = 2) {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            const fincraSecret = config?.fincraSecret || process.env.FINCRA_SECRET_KEY;
            const businessId = config?.fincraBusinessId || process.env.FINCRA_BUSINESS_ID || '693c5533957c9000120117a6';

            if (!fincraSecret) return { error: 'No Fincra API Key' };

            const headers = { 
                'api-key': fincraSecret, 
                'x-business-id': businessId, 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };

            let inserted = 0;
            let skipped = 0;
            let page = 1;

            while (page <= depth) {
                console.log(`[SyncService] Fetching Fincra Page ${page}...`);
                // Standard collections endpoint (V1) is often just /collections
                const url = `https://api.fincra.com/collections?business=${businessId}&page=${page}&perPage=20`;
                const response = await axios.get(url, { headers });
                const rawData = response.data.data;
                const collections = Array.isArray(rawData) ? rawData : (rawData?.result || []);
                
                if (collections.length === 0) break;

                for (const record of collections) {
                    if (record.status !== 'successful' && record.status !== 'success') continue;

                    const reference = record.reference;
                    if (!reference) continue;

                    // Check if already synced
                    const exists = await prisma.transaction.findUnique({ where: { reference } });
                    if (exists) {
                        skipped++;
                        continue;
                    }

                    // Identify user
                    const virtualAccountId = record.virtualAccount?.id || record.virtualAccountId || record.customer?.virtualAccount;
                    const accountNumber = record.virtualAccount?.accountNumber || record.accountNumber || record.customer?.accountNumber;

                    let user = null;
                    if (virtualAccountId) user = await prisma.user.findFirst({ where: { fincraCustomerId: String(virtualAccountId) } });
                    if (!user && accountNumber) user = await prisma.user.findFirst({ where: { fincraWalletId: String(accountNumber) } });
                    
                    if (!user) continue;

                    // Create transaction record
                    await prisma.transaction.create({
                        data: {
                            userId: user.id,
                            type: 'FUNDING',
                            amount: parseFloat(record.amount || record.settledAmount || '0'),
                            currency: record.currency || 'NGN',
                            status: 'SUCCESS',
                            reference: reference, 
                            provider: 'FINCRA_SYNC',
                            description: `Deposit Sync (${record.sourceAccount?.accountNumber || 'External'})`
                        }
                    });
                    inserted++;
                }
                page++;
            }

            return { inserted, skipped, pages: page - 1 };
        } catch (error: any) {
            console.error('[SyncService] Fincra Sync Failed:', error.message);
            throw error;
        }
    }

    /**
     * Exhaustive sync for "Pull past transactions" request.
     */
    static async fullHistorySync() {
        console.log('[SyncService] Starting exhaustive history sync...');
        return await this.syncFincra(50); // Scan back 50 pages (~2,500 transactions)
    }

    /**
     * Heartbeat delta sync (fast).
     */
    static async autoSync() {
        console.log('[SyncService] Running scheduled delta sync...');
        return await this.syncFincra(2); // Scan back 2 pages to catch recent missed webhooks
    }
}
