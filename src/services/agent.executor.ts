import prisma from '../utils/prisma.js';
import { fincraService } from './fincra.service.js';
import { bitnobService } from './bitnob.service.js';
import { whapiService } from './whapi.service.js';
import { ReceiptService } from './receipt.service.js';

export class AgentExecutor {
    /**
     * The background engine that processes all PENDING missions in the Task Ledger.
     */
    static async processMissions() {
        console.log('[Agent Executor] Scanning for active missions...');
        
        try {
            const pendingTasks = await prisma.scheduledTask.findMany({
                where: {
                    status: 'PENDING',
                    targetDate: { lte: new Date() }
                },
                include: { user: true }
            });

            if (pendingTasks.length === 0) return;

            console.log(`[Agent Executor] Found ${pendingTasks.length} missions to execute.`);

            for (const task of pendingTasks) {
                const context = JSON.parse(task.context || '{}');
                
                // If it's a price-triggered task (Buy the Dip), check market first
                if (task.type === 'AUTO_BUY' && context.priceCondition) {
                    const currentPrice = await bitnobService.getCurrentPrice(context.asset || 'btc');
                    if (currentPrice && currentPrice.data > context.priceCondition) {
                        console.log(`[Agent Executor] Skip AUTO_BUY: Price (${currentPrice.data}) is above trigger (${context.priceCondition})`);
                        continue; 
                    }
                }

                await this.executeMission(task);
            }
        } catch (error) {
            console.error('[Agent Executor] Critical Failure:', error);
        }
    }

    private static async executeMission(task: any) {
        console.log(`[Agent Executor] Executing Mission: ${task.reference} (${task.type})`);
        const context = JSON.parse(task.context || '{}');
        
        try {
            switch (task.type) {
                case 'SCHEDULE_TRANSFER':
                case 'TRANSFER':
                    await this.runTransfer(task, context);
                    break;
                case 'SCHEDULE_BILL':
                case 'BILL':
                    await this.runBill(task, context);
                    break;
                case 'SWAP':
                case 'AUTO_BUY':
                    await this.runSwap(task, context);
                    break;
                case 'DEBT_COLLECTION':
                    await this.runDebtRemind(task, context);
                    break;
                case 'PROACTIVE_NUDGE':
                    await this.runNudge(task, context);
                    break;
                default:
                    console.log(`[Agent Executor] Unknown Mission Type: ${task.type}`);
                    break;
            }

            // Mark as SUCCESS
            await prisma.scheduledTask.update({
                where: { id: task.id },
                data: { status: 'SUCCESS' }
            });

        } catch (e: any) {
            console.error(`[Agent Executor] Mission ${task.reference} FAILED:`, e.message);
            await prisma.scheduledTask.update({
                where: { id: task.id },
                data: { status: 'FAILED' }
            });
            await whapiService.sendMessage(task.user.phoneNumber, `❌ *Mission Failed*\n\nMy attempt to execute task ${task.reference} failed: ${e.message}. Please check your vault.`);
        }
    }

    private static async runTransfer(task: any, context: any) {
        // Logic similar to Payouts in WebhookController
        await fincraService.transferFunds({
            amount: task.amount,
            currency: 'NGN',
            paymentDestination: 'bank_account',
            beneficiary: {
                firstName: (context.recipient || 'User').split(' ')[0],
                lastName: (context.recipient || 'User').split(' ')[1] || 'Agent',
                accountNumber: context.accountNumber,
                accountHolderName: context.recipient,
                bankCode: context.bankCode,
                type: 'individual'
            }
        });

        await whapiService.sendMessage(task.user.phoneNumber, `✅ *Mission Accomplished*\n\nI have successfully sent ₦${task.amount.toLocaleString()} to ${context.recipient}.`);
        
        // Generate Receipt
        await ReceiptService.generateAndSend(task.user.phoneNumber, {
            type: 'Autonomous Transfer',
            amount: `₦${task.amount.toLocaleString()}`,
            reference: task.reference,
            recipient: context.recipient,
            bank: context.bankName || 'N/A',
            status: 'SUCCESS',
            date: new Date().toLocaleString()
        });
    }

    private static async runBill(task: any, context: any) {
        let utilityType: any = 'airtime';
        const billType = (context.billType || '').toLowerCase();
        if (billType.includes('data')) utilityType = 'data';
        if (billType.includes('power')) utilityType = 'power';
        if (billType.includes('tv')) utilityType = 'cabletv';

        await fincraService.payUtility(utilityType, {
            amount: task.amount,
            customerIdentifier: context.customer,
            phoneNumber: task.user.phoneNumber,
            billerName: context.billType
        });

        await whapiService.sendMessage(task.user.phoneNumber, `✅ *Mission Accomplished*\n\nYour ${context.billType} bill (₦${task.amount.toLocaleString()}) has been settled automatically.`);
    }

    private static async runSwap(task: any, context: any) {
        const result = await bitnobService.swap({
            amount: task.amount * 100, // cents
            from: 'usd',
            to: (context.asset || 'btc').toLowerCase()
        });
        await whapiService.sendMessage(task.user.phoneNumber, `✅ *Mission Accomplished*\n\nI have swapped your funds to ${context.asset}. Your vault is updated.`);
    }

    private static async runDebtRemind(task: any, context: any) {
        const borrowerPhone = context.recipient; // This would be the phone number detected by AI
        const amount = task.amount;
        
        // 1. Notify the lender
        await whapiService.sendMessage(task.user.phoneNumber, `🔔 *Debt Collection Alert*\n\nToday is the day ${borrowerPhone} is scheduled to pay back ₦${amount.toLocaleString()}. I am sending a reminder now.`);

        // 2. Attempt to notify the borrower if they are a user
        const borrower = await prisma.user.findUnique({ where: { phoneNumber: borrowerPhone } });
        if (borrower) {
            await whapiService.sendMessage(borrowerPhone, `👋 *Friendly Nudge from ChatPay*\n\nHi! This is the ChatPay Agent. Just a reminder from ${task.user.name || 'your friend'} about the ₦${amount.toLocaleString()} loan due today.\n\nYou can pay back instantly via P2P on ChatPay!`);
        } else {
            // If they aren't on ChatPay, we can't message them directly via Whapi (unless we have permission)
            // So we suggest the lender to forward a pre-written message
            await whapiService.sendMessage(task.user.phoneNumber, `Actually, since ${borrowerPhone} isn't on ChatPay yet, you can forward this message to them:\n\n"Hi! Jus a reminder about the ₦${amount.toLocaleString()} loan. You can pay back into my ChatPay NGN account."`);
        }
    }

    private static async runNudge(task: any, context: any) {
        const { WalletService } = await import('./wallet.service.js');
        const { bitnobService } = await import('./bitnob.service.js');
        
        const balance = await WalletService.getBalance(task.userId);
        const rates = await bitnobService.getCurrentPrice('btc');
        const btcRate = rates?.data?.find((r: any) => r.symbol === 'BTCNGN')?.rate || 90000000;

        let message = `👋 *Morning Briefing*\n\nYour current vault balance is ₦${balance.toLocaleString()}.\n\n`;
        
        if (balance > 10000) {
            message += `Bitcoin is currently ₦${btcRate.toLocaleString()}. Want to put ₦5,000 to work and buy some fractions? 📈`;
        } else {
            message += `Your account is looking a bit low. Want to fund it now and pay some bills or fund your SportyBet? ⚽`;
        }

        await whapiService.sendMessage(task.user.phoneNumber, message);
    }
}
