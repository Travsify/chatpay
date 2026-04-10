import { fincraService } from './fincra.service.js';
import prisma from '../utils/prisma.js';

export class WalletService {
    
    static async setupUserWallet(userId: string) {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || user.fincraWalletId) return;

        try {
            // 1. Create Fincra Customer
            const names = (user.name || 'ChatPay User').split(' ');
            const customer = await fincraService.createCustomer({
                firstName: names[0],
                lastName: names[1] || 'User',
                email: `${user.phoneNumber}@chatpay.io`,
                phoneNumber: user.phoneNumber,
                type: 'individual'
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
        if (!user || !user.fincraWalletId) return 0;
        
        // In real world, we'd call Fincra API here
        // const balanceData = await fincraService.getWalletBalance(user.fincraWalletId);
        // return balanceData.availableBalance;
        return 15250.75; // Mocked
    }
}
