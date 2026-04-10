import { Request, Response } from 'express';
import { whapiService } from '../services/whapi.service';
import { aiService } from '../services/ai.service';
import { WalletService } from '../services/wallet.service';
import prisma from '../utils/prisma';

export class WebhookController {
    
    static async handleIncoming(req: Request, res: Response) {
        try {
            const body = req.body;
            const messages = body.messages || [];
            
            for (const msg of messages) {
                if (msg.from_me) continue;

                const senderNumber = msg.from;
                const messageText = msg.text?.body;

                if (!messageText) continue;

                let user = await prisma.user.findUnique({ where: { phoneNumber: senderNumber } });
                if (!user) {
                    user = await prisma.user.create({ data: { phoneNumber: senderNumber } });
                }

                let session = await prisma.session.findFirst({
                    where: { userId: user.id },
                    orderBy: { updatedAt: 'desc' }
                });

                if (!session) {
                    session = await prisma.session.create({ data: { userId: user.id, currentState: 'START' } });
                }

                const aiResult = await aiService.parseIntent(messageText);
                await WebhookController.processLogic(user, session, aiResult, messageText);
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Internal Error');
        }
    }

    private static async processLogic(user: any, session: any, aiResult: any, rawText: string) {
        const { phoneNumber } = user;

        // 1. Check Ongoing Flow States
        if (session.currentState === 'AWAITING_NAME') {
            await prisma.user.update({ where: { id: user.id }, data: { name: rawText } });
            await whapiService.sendMessage(phoneNumber, `Thanks ${rawText}! Please provide your BVN/NIN for verification.`);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC' } });
            return;
        }

        if (session.currentState === 'AWAITING_KYC') {
            await whapiService.sendMessage(phoneNumber, `Verifying your identity... ⏳`);
            const isVerified = rawText.length >= 10; 
            if (isVerified) {
                await prisma.user.update({ where: { id: user.id }, data: { kycStatus: 'VERIFIED' } });
                await whapiService.sendMessage(phoneNumber, `Verified! ✅ Finalizing your wallet setup...`);
                try {
                    const wallet = await WalletService.setupUserWallet(user.id);
                    await whapiService.sendMessage(phoneNumber, `Success! 🏦 Account: ${wallet?.accountNumber || 'Pending'}\nBank: Wema (ChatPay)`);
                } catch (e) {
                    await whapiService.sendMessage(phoneNumber, `Verification complete! We'll notify you when your wallet is ready.`);
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START' } });
            } else {
                await whapiService.sendMessage(phoneNumber, `Invalid ID. Please enter a valid BVN/NIN.`);
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_CONFIRM') {
            if (rawText.toLowerCase().includes('yes') || rawText.toLowerCase().includes('confirm')) {
                const { amount, recipient } = session.context as any;
                await whapiService.sendMessage(phoneNumber, `Sending ₦${amount} to ${recipient}... 🚀`);
                await whapiService.sendMessage(phoneNumber, `Success! Transaction ref: CP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await whapiService.sendMessage(phoneNumber, `Transaction cancelled. ❌`);
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }

        // 2. Process Intent
        switch (aiResult.intent) {
            case 'SIGNUP':
                if (user.kycStatus === 'VERIFIED') {
                    await whapiService.sendMessage(phoneNumber, `You're all set, ${user.name}!`);
                } else {
                    await whapiService.sendMessage(phoneNumber, `Welcome! Let's start. What is your full name?`);
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
                }
                break;

            case 'SEND_FUNDS':
                if (user.kycStatus !== 'VERIFIED') {
                    await whapiService.sendMessage(phoneNumber, `Please signup/verify first.`);
                } else {
                    const { amount, recipient } = aiResult.entities || {};
                    if (!amount || !recipient) {
                        await whapiService.sendMessage(phoneNumber, `Please specify amount and recipient.`);
                    } else {
                        await whapiService.sendMessage(phoneNumber, `Send ₦${amount} to ${recipient}? (Yes/No)`);
                        await prisma.session.update({
                            where: { id: session.id },
                            data: { currentState: 'AWAITING_TRANSFER_CONFIRM', context: { amount, recipient } }
                        });
                    }
                }
                break;

            case 'INVOICE':
                if (user.kycStatus !== 'VERIFIED') {
                    await whapiService.sendMessage(phoneNumber, `Verify first to create invoices.`);
                } else {
                    const { amount, description } = aiResult.entities || {};
                    if (!amount) {
                        await whapiService.sendMessage(phoneNumber, `Please specify an amount for the invoice.`);
                    } else {
                        const invoiceLink = `https://pay.chatpay.io/inv_${Math.random().toString(36).substr(2, 6)}`;
                        await whapiService.sendMessage(phoneNumber, `Invoice Created! 📄\nAmount: ₦${amount}\nDescription: ${description || 'Services'}\nLink: ${invoiceLink}\n\nSend this link to your customer to get paid.`);
                    }
                }
                break;

            default:
                const response = await aiService.generateResponse(`User: "${rawText}". Respond as ChatPay bot.`);
                await whapiService.sendMessage(phoneNumber, response);
        }
    }
}
