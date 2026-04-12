import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { whapiService } from '../services/whapi.service.js';
import { EmailService } from '../services/email.service.js';
import crypto from 'crypto';

export class FincraWebhookController {
    static async handleIncoming(req: Request, res: Response) {
        try {
            const payload = req.body || {};
            const signature = req.headers['x-fincra-signature'];
            
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            const secret = config?.fincraWebhookSecret || process.env.FINCRA_WEBHOOK_SECRET;

            if (secret) {
                const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(payload)).digest('hex');
                if (hash !== signature) {
                    console.error('[Fincra Webhook] Invalid signature detected');
                    return res.status(401).send('Unauthorized');
                }
            }

            console.log('[Fincra Webhook] Received Verified:', JSON.stringify(payload));
            
            // Typical Fincra webhook structure for Virtual Account deposit
            // event: 'collection.successful' or 'virtualaccount.payment.received'
            const event = payload?.event || '';
            const data = payload?.data;
            
            if (!data) {
                return res.status(200).send('OK');
            }

            // Extract the virtual account ID or the account number
            // Depending on the exact Fincra event
            const virtualAccountId = data.virtualAccount || data.virtualAccountId || data.customer?.virtualAccount;
            const accountNumber = data.accountNumber || data.customer?.accountNumber;
            const amount = parseFloat(data.amount || data.settledAmount || '0');
            const currency = data.currency || 'NGN';
            const reference = data.reference || `DEP-${Date.now()}`;
            
            if (amount <= 0) {
                return res.status(200).send('Ignored');
            }

            // Find the user who owns this Fincra Virtual Account
            let user = null;
            
            if (virtualAccountId) {
                user = await prisma.user.findFirst({ where: { fincraCustomerId: virtualAccountId } });
            }
            if (!user && accountNumber) {
                user = await prisma.user.findFirst({ where: { fincraWalletId: String(accountNumber) } });
            }

            if (!user) {
                console.error(`[Fincra Webhook] User not found for VA ID: ${virtualAccountId} or Account Number: ${accountNumber}`);
                return res.status(200).send('User not found');
            }

            // Prevent duplicate transaction processing using reference
            const exists = await prisma.transaction.findUnique({ where: { reference } });
            if (exists) {
                console.log(`[Fincra Webhook] Duplicate transaction ignored: ${reference}`);
                return res.status(200).send('Duplicate');
            }

            // Log the Funding transaction
            await prisma.transaction.create({
                data: {
                    userId: user.id,
                    type: 'FUNDING',
                    amount: amount,
                    currency: currency,
                    status: 'SUCCESS',
                    reference: reference, // Ensure reference from webhook is unique
                    provider: 'FINCRA',
                    description: `Deposit via Virtual Account (${data.sourceAccountNumber || 'External'})`
                }
            });

            // Calculate new local ledger balance
            const incomingTransactions = await prisma.transaction.findMany({
                where: { userId: user.id, status: 'SUCCESS' }
            });
            let balance = 0;
            for (const tx of incomingTransactions) {
                if (tx.type === 'FUNDING' || tx.type === 'P2P_RECEIVE') balance += tx.amount;
                else balance -= tx.amount;
            }

            // Send WhatsApp Alert to the User using Whapi
            const alertMessage = `🔔 *Credit Alert!* 🔔\n\nYour account has been funded successfully.\n\n*Amount*: ₦${amount.toLocaleString()}\n*New Balance*: ₦${Math.max(0, balance).toLocaleString()}\n*Ref*: ${reference}\n\nType *"Menu"* to continue transacting.`;
            
            try {
                await whapiService.sendMessage(user.phoneNumber, alertMessage);
                
                // NEW: AUTOMATIC PDF RECEIPT
                const { ReceiptService } = await import('../services/receipt.service.js');
                await ReceiptService.generateAndSend(user.phoneNumber, {
                    type: 'Deposit (Incoming)',
                    amount: `₦${amount.toLocaleString()}`,
                    reference: reference,
                    status: 'SUCCESS',
                    date: new Date().toLocaleString(),
                    recipient: user.name || 'You'
                });

                console.log(`[Fincra Webhook] Sent credit alert + PDF to ${user.phoneNumber}`);
                if (user.email) {
                    await EmailService.sendReceipt(user.email, { type: 'Deposit (Incoming)', amount, reference, balance });
                }
            } catch (notifyErr) {
                console.error(`[Fincra Webhook] Failed to notify ${user.phoneNumber}`, notifyErr);
            }

            return res.status(200).send('Processed');
        } catch (err) {
            console.error('[Fincra Webhook] Error processing:', err);
            return res.status(500).send('Internal Server Error');
        }
    }
}
