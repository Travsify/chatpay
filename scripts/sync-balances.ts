import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

async function syncFincraCollections() {
    try {
        console.log('[Sync] Fetching global configuration...');
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        const fincraSecret = config?.fincraSecret || process.env.FINCRA_SECRET_KEY;
        const businessId = process.env.FINCRA_BUSINESS_ID || '693c5533957c9000120117a6';

        if (!fincraSecret) {
            console.error('[Sync] FAILURE: No Fincra API Key found.');
            process.exit(1);
        }

        console.log('[Sync] Pulling collections from Fincra API...');
        const headers = {
            'api-key': fincraSecret,
            'x-business-id': businessId,
            'Content-Type': 'application/json'
        };

        // Fincra collections (incoming transfers to virtual accounts)
        const response = await axios.get('https://api.fincra.com/collections', { headers });
        const collections = response.data.data?.result || response.data.data || [];

        console.log(`[Sync] Retrieved ${collections.length} total collections from Fincra...`);

        let inserted = 0;
        let skipped = 0;

        for (const record of collections) {
            if (record.status !== 'successful' && record.status !== 'success') {
                continue;
            }

            const virtualAccountId = record.virtualAccount?.id || record.virtualAccountId || record.customer?.virtualAccount;
            const accountNumber = record.virtualAccount?.accountNumber || record.accountNumber || record.customer?.accountNumber;
            const amount = parseFloat(record.amount || record.settledAmount || '0');
            const currency = record.currency || 'NGN';
            const reference = record.reference;

            if (!reference) continue;

            const exists = await prisma.transaction.findUnique({ where: { reference } });
            if (exists) {
                skipped++;
                continue;
            }

            let user = null;
            if (virtualAccountId) {
                user = await prisma.user.findFirst({ where: { fincraCustomerId: String(virtualAccountId) } });
            }
            if (!user && accountNumber) {
                user = await prisma.user.findFirst({ where: { fincraWalletId: String(accountNumber) } });
            }

            if (!user) {
                console.log(`[Sync] Orphan transaction skipped: ${reference} (No user matches VA ${virtualAccountId} or AC ${accountNumber})`);
                continue;
            }

            await prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'FUNDING',
                    amount: amount,
                    currency: currency,
                    status: 'SUCCESS',
                    reference: reference, // Fincra reference
                    provider: 'FINCRA_SYNC',
                    description: `Deposit via Virtual Account (${record.sourceAccount?.accountNumber || record.sourceAccountNumber || 'External'})`
                }
            });

            console.log(`[Sync] Added ₦${amount} for ${user.name}`);
            inserted++;
        }

        console.log(`\n✅ SYNC COMPLETE!`);
        console.log(`   Transactions Inserted: ${inserted}`);
        console.log(`   Transactions Skipped (Already Exist): ${skipped}`);
        console.log(`\nNote: All user balances are automatically recalculated dynamically based on these transactions. No additional balance update is needed!`);
        
    } catch (e: any) {
        console.error('[Sync] Error:', e.response?.data || e.message);
    } finally {
        await prisma.$disconnect();
    }
}

syncFincraCollections();
