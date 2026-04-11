import { fincraService } from './fincra.service.js';
import prisma from '../utils/prisma.js';

export class WalletService {
    
    static async setupUserWallet(userId: string, type: 'individual' | 'business' = 'individual', businessName?: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) return;

        try {
            // 1. Create Fincra Customer
            const names = (user.name || 'ChatPay User').split(' ');
            const customer = await fincraService.createCustomer({
                firstName: type === 'business' ? (businessName || names[0]) : names[0],
                lastName: type === 'business' ? 'Enterprise' : (names[1] || 'User'),
                email: `${user.phoneNumber}@chatpay.io`,
                phoneNumber: user.phoneNumber,
                type: type
            });

            // 2. Create Virtual Account
            const virtualAccount = await fincraService.createVirtualAccount({
                currency: 'NGN',
                accountType: 'default',
                customerId: customer.data.id
            });

            // 3. Update User in DB
            await prisma.user.update({
                where: { id: userId },
                data: {
                    fincraCustomerId: customer.data.id,
                    fincraWalletId: virtualAccount.data.accountNumber || 'PENDING'
                }
            });

            return virtualAccount.data;
        } catch (error) {
            console.error('Failed to setup user wallet:', error);
            throw error;
        }
    }

    static async getBalance(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.fincraWalletId || user.fincraWalletId === 'PENDING') return 0;
        
        try {
            const balanceData = await fincraService.getWalletBalance(user.fincraWalletId);
            // Fincra returns numeric strings in sub-units usually, ensure we return the float amount
            return parseFloat(balanceData.data?.availableBalance || '0');
        } catch (error) {
            console.error('Wallet balance fetch failed:', error);
            return 0;
        }
    }
}
