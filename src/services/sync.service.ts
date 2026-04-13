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
            let totalFound = 0;
            let page = 1;

            // 1. SYNC COLLECTIONS (Incoming)
            while (page <= depth) {
                console.log(`[SyncService] Fetching Fincra Collections Page ${page}...`);
                const url = `https://api.fincra.com/v1/collections?page=${page}&perPage=20`;
                const response = await axios.get(url, { headers });
                const rawData = response.data.data;
                const collections = Array.isArray(rawData) ? rawData : (rawData?.result || rawData?.collections || []);
                
                totalFound += collections.length;
                if (collections.length === 0) break;

                for (const record of collections) {
                    // Log the first successful-looking record's structure for developer review if requested
                    const reference = record.reference;
                    if (!reference) continue;

                    if (await prisma.transaction.findUnique({ where: { reference } })) {
                        skipped++;
                        continue;
                    }

                    // Greedily find user even if account info is missing from the record
                    const vId = record.virtualAccount?.id || record.virtualAccountId || record.customer?.virtualAccount || (typeof record.virtualAccount === 'string' ? record.virtualAccount : null);
                    const vAcc = record.virtualAccount?.accountNumber || record.accountNumber || record.customer?.accountNumber;
                    const accountName = record.virtualAccount?.accountName || record.customer?.name || '';
                    
                    const user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { fincraCustomerId: String(vId || 'none') },
                                { fincraWalletId: String(vAcc || 'none') },
                                { name: { contains: accountName, mode: 'insensitive' } } // Fallback to name match for orphaned VAs
                            ]
                        }
                    });
                    
                    if (!user) {
                        // ORPHAN: Record for manual intervention
                        await prisma.unmatchedTransaction.upsert({
                            where: { reference },
                            update: {},
                            create: {
                                amount: parseFloat(record.amount || record.settledAmount || '0'),
                                currency: record.currency || 'NGN',
                                reference: reference,
                                provider: 'FINCRA_COLLECTION',
                                description: `Unmatched: ${record.sourceAccount?.accountName || 'Unknown'} - ${record.sourceAccount?.accountNumber || ''}`,
                                metadata: JSON.stringify(record)
                            }
                        });
                        console.log(`[SyncService] Orphaned transaction recorded: ${reference}`);
                        continue;
                    }

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

            // 2. SYNC DISBURSEMENTS (Outgoing)
            let dPage = 1;
            while (dPage <= depth) {
                console.log(`[SyncService] Fetching Fincra Payouts Page ${dPage}...`);
                const dUrl = `https://api.fincra.com/v1/payouts?page=${dPage}&perPage=20`;
                try {
                    const dRes = await axios.get(dUrl, { headers });
                    const dData = dRes.data.data?.result || dRes.data.data || [];
                    if (dData.length === 0) break;

                    for (const record of dData) {
                        if (record.status !== 'successful' && record.status !== 'success' && record.status !== 'processed') continue;
                        
                        const reference = record.reference;
                        if (!reference || await prisma.transaction.findUnique({ where: { reference } })) continue;

                        // Try to find user by merchant reference pattern (e.g. chatpay-USERID-ngn)
                        const merchantRef = record.customerReference || record.merchantReference || '';
                        let userId = null;
                        if (merchantRef.startsWith('chatpay-')) {
                            const parts = merchantRef.split('-');
                            if (parts[1]) {
                                const partialId = parts[1];
                                const userMatch = await prisma.user.findFirst({ where: { id: { startsWith: partialId } } });
                                userId = userMatch?.id;
                            }
                        }

                        if (!userId) continue;

                        await prisma.transaction.create({
                            data: {
                                userId,
                                type: 'TRANSFER',
                                amount: parseFloat(record.amount || '0'),
                                currency: record.currency || 'NGN',
                                status: 'SUCCESS',
                                reference: reference,
                                provider: 'FINCRA_SYNC_OUT',
                                description: `Payout Sync (${record.beneficiary?.accountNumber || 'External'})`
                            }
                        });
                        inserted++;
                    }
                } catch (e) { break; }
                dPage++;
            }

            return { inserted, skipped, totalFound, pages: page - 1 };
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
