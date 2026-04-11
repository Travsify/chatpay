import { fincraService } from './fincra.service.js';
import prisma from '../utils/prisma.js';

export class WalletService {
    
    static async setupUserWallet(userId: string, type: 'individual' | 'business' = 'individual', businessName?: string, currency: string = 'NGN') {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        try {
            // 1. Get or Create Fincra Customer
            let customerId = user.fincraCustomerId;
            if (!customerId) {
                const names = (user.name || 'ChatPay User').split(' ');
                const customer = await fincraService.createCustomer({
                    firstName: type === 'business' ? (businessName || names[0]) : names[0],
                    lastName: type === 'business' ? 'Enterprise' : (names[1] || 'User'),
                    email: `${user.phoneNumber}@chatpay.io`,
                    phoneNumber: user.phoneNumber,
                    type: type
                });
                customerId = customer.data.id;
            }

            // 2. Create Virtual Account with requested currency
            const virtualAccount = await fincraService.createVirtualAccount({
                currency: currency,
                accountType: 'default',
                customerId: customerId!
            });

            // 3. Update User in DB (Save NGN wallet as primary if it's the first time)
            await prisma.user.update({
                where: { id: userId },
                data: {
                    fincraCustomerId: customerId,
                    fincraWalletId: currency === 'NGN' ? (virtualAccount.data.accountNumber || 'PENDING') : user.fincraWalletId
                }
            });

            return virtualAccount.data;
        } catch (error) {
            console.error('Failed to setup user wallet:', error);
            throw error;
        }
    }

    static async getBalance(userId: string) {
        let user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return 0;
        
        // AUTO-SYNC: If account is pending, try to fetch it now
        if (!user.fincraWalletId || user.fincraWalletId === 'PENDING') {
            await this.syncWallet(userId);
            user = await prisma.user.findUnique({ where: { id: userId } });
        }

        if (!user || !user.fincraWalletId || user.fincraWalletId === 'PENDING') return 0;
        
        try {
            const balanceData = await fincraService.getWalletBalance(user.fincraWalletId);
            return parseFloat(balanceData.data?.availableBalance || '0');
        } catch (error) {
            console.error('Wallet balance fetch failed:', error);
            return 0;
        }
    }

    static async syncWallet(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.fincraCustomerId) return null;

        try {
            const accounts = await fincraService.listVirtualAccounts(user.fincraCustomerId);
            const ngnAccount = (accounts.data || []).find((a: any) => a.currency === 'NGN' && a.accountNumber);
            
            if (ngnAccount) {
                await prisma.user.update({
                    where: { id: userId },
                    data: { fincraWalletId: ngnAccount.accountNumber }
                });
                return ngnAccount;
            }
        } catch (e) {
            console.error('[Wallet] Sync failed:', e);
        }
        return null;
    }
}
