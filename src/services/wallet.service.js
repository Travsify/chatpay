"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletService = void 0;
const fincra_service_1 = require("./fincra.service");
const prisma_1 = __importDefault(require("../utils/prisma"));
class WalletService {
    static async setupUserWallet(userId) {
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user || user.fincraWalletId)
            return;
        try {
            // 1. Create Fincra Customer
            const names = (user.name || 'ChatPay User').split(' ');
            const customer = await fincra_service_1.fincraService.createCustomer({
                firstName: names[0],
                lastName: names[1] || 'User',
                email: `${user.phoneNumber}@chatpay.io`,
                phoneNumber: user.phoneNumber,
                type: 'individual'
            });
            // 2. Create Virtual Account
            const virtualAccount = await fincra_service_1.fincraService.createVirtualAccount({
                currency: 'NGN',
                accountType: 'default',
                customerId: customer.data.id
            });
            // 3. Update User in DB
            await prisma_1.default.user.update({
                where: { id: userId },
                data: {
                    fincraCustomerId: customer.data.id,
                    fincraWalletId: virtualAccount.data.accountNumber || 'PENDING'
                }
            });
            return virtualAccount.data;
        }
        catch (error) {
            console.error('Failed to setup user wallet:', error);
            throw error;
        }
    }
    static async getBalance(userId) {
        const user = await prisma_1.default.user.findUnique({ where: { id: userId } });
        if (!user || !user.fincraWalletId)
            return 0;
        // In real world, we'd call Fincra API here
        // const balanceData = await fincraService.getWalletBalance(user.fincraWalletId);
        // return balanceData.availableBalance;
        return 15250.75; // Mocked
    }
}
exports.WalletService = WalletService;
//# sourceMappingURL=wallet.service.js.map