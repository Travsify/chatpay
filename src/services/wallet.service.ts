import { fincraService } from './fincra.service.js';
import prisma from '../utils/prisma.js';

export class WalletService {
    
    /**
     * Set up a virtual account for a user via Fincra.
     * This directly creates a virtual account (no separate customer step).
     */
    static async setupUserWallet(userId: string, type: 'individual' | 'business' = 'individual', businessName?: string, currency: string = 'NGN') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return null;

        // If user already has a wallet, skip creation
        if (user.fincraWalletId && user.fincraWalletId !== 'PENDING') {
            console.log(`[Wallet] User ${userId} already has wallet: ${user.fincraWalletId}`);
            return { accountNumber: user.fincraWalletId };
        }

        try {
            const names = (user.name || 'ChatPay User').split(' ');
            const firstName = names[0];
            const lastName = names.slice(1).join(' ') || 'User';

            const result = await fincraService.createVirtualAccount({
                firstName: type === 'business' ? (businessName || firstName) : firstName,
                lastName: type === 'business' ? 'Enterprise' : lastName,
                email: `${user.phoneNumber}@chatpay.io`,
                accountType: type === 'business' ? 'corporate' : 'individual',
                currency: currency,
                businessName: type === 'business' ? businessName : undefined,
                merchantReference: `chatpay-${user.id.slice(0, 8)}`
            });

            // Extract account details from response
            const accountData = result.data;
            const accountNumber = accountData?.accountInformation?.accountNumber || accountData?.accountNumber || 'PENDING';
            const virtualAccountId = accountData?._id || null;
            const bankName = accountData?.accountInformation?.bankName || 'WEMA BANK';

            console.log(`[Wallet] Account created: ${accountNumber} @ ${bankName} (VA ID: ${virtualAccountId})`);

            // Save to database
            await prisma.user.update({
                where: { id: userId },
                data: {
                    fincraCustomerId: virtualAccountId,  // Store the VA _id for future lookups
                    fincraWalletId: accountNumber
                }
            });

            return {
                accountNumber,
                bankName,
                accountName: accountData?.accountInformation?.accountName || user.name,
                virtualAccountId
            };
        } catch (error: any) {
            console.error('[Wallet] Failed to setup user wallet:', error.response?.status, error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Get balance for a user. 
     * Note: Fincra virtual accounts don't hold balances directly.
     * Funds settle in the merchant wallet. This checks the merchant balance.
     */
    static async getBalance(userId: string) {
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return 0;
        
        // AUTO-SYNC: If account is pending, try to fetch it now
        if (!user.fincraWalletId || user.fincraWalletId === 'PENDING') {
            await this.syncWallet(userId);
            user = await prisma.user.findUnique({ where: { id: userId } });
        }

        if (!user || !user.fincraWalletId || user.fincraWalletId === 'PENDING') return 0;
        
        // For now, return 0 as balance tracking is handled via our transaction ledger
        // Fincra virtual accounts route funds to the merchant wallet, not individual wallets
        try {
            const transactions = await prisma.transaction.findMany({
                where: { userId: user.id, status: 'SUCCESS' }
            });
            
            let balance = 0;
            for (const tx of transactions) {
                if (tx.type === 'DEPOSIT' || tx.type === 'P2P_RECEIVE') {
                    balance += tx.amount;
                } else {
                    balance -= tx.amount;
                }
            }
            return Math.max(0, balance);
        } catch (error) {
            console.error('[Wallet] Balance calculation failed:', error);
            return 0;
        }
    }

    /**
     * Sync wallet: If the virtual account was created but details weren't saved,
     * fetch them from Fincra and update the database.
     */
    static async syncWallet(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.fincraCustomerId) return null;

        try {
            const accountData = await fincraService.getVirtualAccount(user.fincraCustomerId);
            const accountNumber = accountData.data?.accountInformation?.accountNumber;
            
            if (accountNumber) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { fincraWalletId: accountNumber }
                });
                console.log(`[Wallet] Synced account: ${accountNumber}`);
                return accountData.data;
            }
        } catch (e) {
            console.error('[Wallet] Sync failed:', e);
        }
        return null;
    }
}
