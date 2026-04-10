import { Request, Response } from 'express';
import { whapiService } from '../services/whapi.service';
import { aiService } from '../services/ai.service';
import { WalletService } from '../services/wallet.service';
import prisma from '../utils/prisma';

export class WebhookController {
    
    static async handleIncoming(req: Request, res: Response) {
        const startTime = Date.now();
        try {
            const body = req.body;
            const messages = body.messages || [];
            
            for (const msg of messages) {
                if (msg.from_me) continue;

                const senderNumber = msg.from;
                const messageText = msg.text?.body;

                if (!messageText) continue;

                // Log inbound webhook
                await WebhookController.logWebhook('INBOUND', senderNumber, JSON.stringify(msg), 'RECEIVED', Date.now() - startTime);

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

                // Log inbound conversation
                const aiResult = await aiService.parseIntent(messageText);

                await prisma.conversationLog.create({
                    data: {
                        userId: user.id,
                        direction: 'INBOUND',
                        message: messageText,
                        intent: aiResult.intent,
                        confidence: null
                    }
                });

                await WebhookController.processLogic(user, session, aiResult, messageText);

                // Mark webhook as processed
                await WebhookController.logWebhook('INBOUND', senderNumber, '', 'PROCESSED', Date.now() - startTime);
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook Error:', error);
            await WebhookController.logWebhook('INBOUND', 'UNKNOWN', JSON.stringify(error), 'FAILED', Date.now() - startTime, String(error));
            res.status(500).send('Internal Error');
        }
    }

    private static async processLogic(user: any, session: any, aiResult: any, rawText: string) {
        const { phoneNumber } = user;

        // Helper to send + log outbound messages
        const sendAndLog = async (message: string, intent?: string) => {
            await whapiService.sendMessage(phoneNumber, message);
            await prisma.conversationLog.create({
                data: {
                    userId: user.id,
                    direction: 'OUTBOUND',
                    message: message,
                    intent: intent || aiResult.intent,
                    aiResponse: message
                }
            });
            await WebhookController.logWebhook('OUTBOUND', phoneNumber, JSON.stringify({ body: message }), 'PROCESSED');
        };

        // 0. New User Global Entry
        if (!user.name && user.kycStatus === 'PENDING' && session.currentState === 'START' && aiResult.intent !== 'SIGNUP') {
            const welcomeMsg = `✨ *Welcome to ChatPay!* ✨\n\nYour autonomous financial companion natively inside WhatsApp.\n\n*What I can do for you:*\n🏦 *Virtual Accounts*: Local & International bank details.\n🚀 *Transfers*: Swift payments to any Nigerian bank.\n💡 *Bills*: Airtime, Data, & Utility payments.\n₿ *Crypto & Cards*: Trade assets & gift cards instantly.\n\nTo get started with your secure wallet, please tell me your *Full Name*:`;
            await sendAndLog(welcomeMsg, 'WELCOME_ONBOARDING');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
            return;
        }

        // 1. Check Ongoing Flow States
        if (session.currentState === 'AWAITING_NAME') {
            await prisma.user.update({ where: { id: user.id }, data: { name: rawText } });
            await sendAndLog(`Thanks ${rawText}! Please provide your BVN/NIN for verification.`, 'SIGNUP_FLOW');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC' } });
            return;
        }

        if (session.currentState === 'AWAITING_KYC') {
            await sendAndLog(`Verifying your identity... ⏳`, 'KYC_FLOW');
            const isVerified = rawText.length >= 10; 
            if (isVerified) {
                await prisma.user.update({ where: { id: user.id }, data: { kycStatus: 'VERIFIED' } });
                await sendAndLog(`Verified! ✅ Finalizing your wallet setup...`, 'KYC_VERIFIED');
                try {
                    const wallet = await WalletService.setupUserWallet(user.id);
                    
                    // Log the virtual account creation
                    if (wallet?.accountNumber) {
                        await prisma.virtualAccount.create({
                            data: {
                                userId: user.id,
                                accountNumber: wallet.accountNumber,
                                bankName: 'WEMA BANK',
                                currency: 'NGN',
                                provider: 'FINCRA'
                            }
                        });
                    }

                    await sendAndLog(`Success! 🏦 Account: ${wallet?.accountNumber || 'Pending'}\nBank: Wema (ChatPay)`, 'WALLET_CREATED');
                } catch (e) {
                    await sendAndLog(`Verification complete! We'll notify you when your wallet is ready.`, 'WALLET_PENDING');
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START' } });
            } else {
                await sendAndLog(`Invalid ID. Please enter a valid BVN/NIN.`, 'KYC_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_CONFIRM') {
            const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;
            if (rawText.toLowerCase().includes('yes') || rawText.toLowerCase().includes('confirm')) {
                const { amount, recipient } = context as any;
                await sendAndLog(`Sending ₦${amount} to ${recipient}... 🚀`, 'TRANSFER_PROCESSING');

                // Create transaction record
                const reference = `CP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                await prisma.transaction.create({
                    data: {
                        userId: user.id,
                        type: 'P2P_SEND',
                        amount: parseFloat(amount),
                        currency: 'NGN',
                        status: 'SUCCESS',
                        reference,
                        provider: 'FINCRA',
                        description: `Transfer to ${recipient}`
                    }
                });

                await sendAndLog(`Success! Transaction ref: ${reference}`, 'TRANSFER_SUCCESS');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Transaction cancelled. ❌`, 'TRANSFER_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }

        if (rawText.toLowerCase() === 'menu' || rawText.toLowerCase() === 'features' || rawText.toLowerCase() === 'help') {
            const menuMsg = `🏦 *ChatPay Command Menu*\n\n💰 *Check Balance*: "Balance"\n🚀 *Send Money*: "Send 5k to John"\n💡 *Pay Bills*: "Pay DSTV" or "Buy Airtime"\n📄 *Invoicing*: "Create invoice of 20k"\n₿ *Trade Crypto*: "Buy $20 USDT"\n📜 *Redeem Cards*: "Sell Amazon card"\n\nHow can I help you right now?`;
            await sendAndLog(menuMsg, 'HELP_MENU');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START' } });
            return;
        }

        // 2. Process Intent
        switch (aiResult.intent) {
            case 'SIGNUP':
                if (user.kycStatus === 'VERIFIED') {
                    await sendAndLog(`Welcome back, ${user.name || 'valued customer'}! 🏦\n\nYour balance is currently up to date. How can I assist you today?\n\n- 💰 Check Balance\n- 🚀 Send Money\n- 💡 Pay Bills\n- 📄 Create Invoice`, 'SIGNUP_EXISTS');
                } else {
                    const welcomeMsg = `✨ *Welcome to ChatPay!* ✨\n\nYour autonomous financial companion natively inside WhatsApp.\n\n*What I can do for you:*\n🏦 *Virtual Accounts*: Local & International bank details.\n🚀 *Transfers*: Swift payments to any Nigerian bank.\n💡 *Bills*: Airtime, Data, & Utility payments.\n₿ *Crypto & Cards*: Trade assets & gift cards instantly.\n\nTo get started with your secure wallet, please tell me your *Full Name*:`;
                    await sendAndLog(welcomeMsg, 'SIGNUP_START');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
                }
                break;

            case 'SEND_FUNDS':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Please signup/verify first.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const { amount, recipient } = aiResult.entities || {};
                    if (!amount || !recipient) {
                        await sendAndLog(`Please specify amount and recipient.`, 'MISSING_ENTITIES');
                    } else {
                        await sendAndLog(`Send ₦${amount} to ${recipient}? (Yes/No)`, 'TRANSFER_CONFIRM');
                        await prisma.session.update({
                            where: { id: session.id },
                            data: { currentState: 'AWAITING_TRANSFER_CONFIRM', context: JSON.stringify({ amount, recipient }) }
                        });
                    }
                }
                break;

            case 'CHECK_BALANCE':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Please signup/verify first to check your balance.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const balance = await WalletService.getBalance(user.id);
                    await sendAndLog(`💰 Your ChatPay Balance:\n₦${balance.toLocaleString()}\n\nAccount: ${user.fincraWalletId || 'Pending'}\nBank: Wema (ChatPay)`, 'BALANCE_CHECK');
                }
                break;

            case 'INVOICE':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Verify first to create invoices.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const { amount, description } = aiResult.entities || {};
                    if (!amount) {
                        await sendAndLog(`Please specify an amount for the invoice.`, 'MISSING_ENTITIES');
                    } else {
                        const invoiceRef = `inv_${Math.random().toString(36).substr(2, 6)}`;
                        const invoiceLink = `https://chatpayapp.online/pay/${invoiceRef}`;

                        // Record transaction
                        await prisma.transaction.create({
                            data: {
                                userId: user.id,
                                type: 'FUNDING',
                                amount: parseFloat(String(amount)),
                                currency: 'NGN',
                                status: 'PENDING',
                                reference: `INV-${invoiceRef.toUpperCase()}`,
                                provider: 'CHATPAY',
                                description: description || 'Invoice'
                            }
                        });

                        await sendAndLog(`Invoice Created! 📄\nAmount: ₦${amount}\nDescription: ${description || 'Services'}\nLink: ${invoiceLink}\n\nSend this link to your customer to get paid.`, 'INVOICE_CREATED');
                    }
                }
                break;

            default:
                const response = await aiService.generateResponse(`User: "${rawText}". Respond as ChatPay bot — a WhatsApp banking assistant. Keep response concise and helpful.`);
                await sendAndLog(response, 'AI_FALLBACK');
        }
    }

    // ===== WEBHOOK LOGGING UTILITY =====
    private static async logWebhook(
        direction: 'INBOUND' | 'OUTBOUND',
        phoneNumber: string,
        payload: string,
        status: 'RECEIVED' | 'PROCESSED' | 'FAILED',
        latencyMs?: number,
        errorMsg?: string
    ) {
        try {
            await prisma.webhookLog.create({
                data: {
                    direction,
                    phoneNumber,
                    payload: payload.substring(0, 2000), // Cap payload size
                    status,
                    latencyMs: latencyMs || null,
                    errorMsg: errorMsg || null
                }
            });
        } catch (err) {
            console.error('Failed to log webhook:', err);
        }
    }
}
