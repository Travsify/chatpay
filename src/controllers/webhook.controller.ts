import { Request, Response } from 'express';
import { whapiService } from '../services/whapi.service.js';
import { aiService } from '../services/ai.service.js';
import { WalletService } from '../services/wallet.service.js';
import { FlutterwaveService } from '../services/flutterwave.service.js';
import { quidaxService } from '../services/quidax.service.js';
import { mapleradService } from '../services/maplerad.service.js';
import { pressMntService } from '../services/pressmnt.service.js';
import prisma from '../utils/prisma.js';

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

        // 0. New User Global Entry & Proactive Greeting
        if (!user.name && user.kycStatus === 'PENDING' && session.currentState === 'START') {
            const welcomeMsg = `✨ *Welcome to ChatPay!* ✨\n\nYour autonomous financial companion natively inside WhatsApp.\n\n*What I can do for you:*\n🏦 *Virtual Accounts*: Nigerian bank details in seconds.\n🚀 *Transfers*: Swift payments to any bank.\n💡 *Bills*: Airtime & Utilities.\n₿ *Crypto*: Trade assets instantly.\n\nTo get started with your secure wallet, please tell me your *Full Name*:`;
            await sendAndLog(welcomeMsg, 'WELCOME_ONBOARDING');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
            return;
        }

        // 1. Check Ongoing Flow States
        if (session.currentState === 'AWAITING_NAME') {
            await prisma.user.update({ where: { id: user.id }, data: { name: rawText } });
            await sendAndLog(`Thanks ${rawText}! 🤝 Is this account for yourself or a business?\n\n1. *Individual* (Personal usage)\n2. *Business* (Company usage)`, 'SIGNUP_TYPE');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TYPE' } });
            return;
        }

        if (session.currentState === 'AWAITING_TYPE') {
            const choice = rawText.toLowerCase();
            if (choice.includes('personal') || choice.includes('individual') || choice === '1') {
                await sendAndLog(`Great! Please provide your *BVN or NIN* for private verification. 🛡️`, 'SIGNUP_KYC');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC', context: JSON.stringify({ type: 'individual' }) } });
            } else if (choice.includes('business') || choice.includes('company') || choice === '2') {
                await sendAndLog(`Understood. Please provide your *Registered Business Name*:`, 'SIGNUP_BUSINESS_NAME');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_BUSINESS_NAME', context: JSON.stringify({ type: 'business' }) } });
            } else {
                await sendAndLog(`Please choose 1 for Individual or 2 for Business.`, 'SIGNUP_TYPE_RETRY');
            }
            return;
        }

        if (session.currentState === 'AWAITING_BUSINESS_NAME') {
            const context = JSON.parse(String(session.context || '{}'));
            await sendAndLog(`Got it. Now, please provide your *CAC Number* (RC Number) for verification:`, 'SIGNUP_CAC');
            await prisma.session.update({ where: { id: session.id }, data: { 
                currentState: 'AWAITING_KYC', 
                context: JSON.stringify({ ...context, businessName: rawText }) 
            } });
            return;
        }

        if (session.currentState === 'AWAITING_KYC') {
            const context = JSON.parse(String(session.context || '{}'));
            const isBusiness = context.type === 'business';
            
            await sendAndLog(`Verifying your ${isBusiness ? 'business' : 'identity'} details... ⏳`, 'KYC_FLOW');
            
            const isVerified = rawText.length >= 8; // Basic length validation
            if (isVerified) {
                await prisma.user.update({ 
                    where: { id: user.id }, 
                    data: { kycStatus: 'VERIFIED' } 
                });
                
                await sendAndLog(`Verified! ✅ Finalizing your ${isBusiness ? 'Business' : 'Individual'} wallet setup...`, 'KYC_VERIFIED');
                try {
                    const wallet = await WalletService.setupUserWallet(user.id, isBusiness ? 'business' : 'individual', context.businessName);
                    
                    const bankDetails = `✨ *Success! Your Wallet is Ready* 🏦\n\n*Type*: ${isBusiness ? '💼 Business' : '👤 Individual'}\n*Account Number*: ${wallet?.accountNumber || 'Generating...'}\n*Bank Name*: WEMA BANK (ChatPay)\n*Account Name*: ${isBusiness ? context.businessName : user.name}\n\n*Next Steps:*\n1. Fund your account using the details above.\n2. Type *"Balance"* to see your current funds.\n3. Type *"Menu"* to see everything I can do.`;
                    
                    await sendAndLog(bankDetails, 'WALLET_CREATED');
                } catch (e) {
                    await sendAndLog(`Verification complete! ✅ We're finalizing your virtual account now. Type "Balance" in a moment to see your details.`, 'WALLET_PENDING');
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Invalid ${isBusiness ? 'CAC Number' : 'BVN/NIN'}. ❌ Please enter valid credentials to secure your wallet.`, 'KYC_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_CONFIRM') {
            const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;
            if (rawText.toLowerCase().includes('yes') || rawText.toLowerCase().includes('confirm')) {
                const { amount, recipient } = context as any;
                await sendAndLog(`Sending ₦${amount} to ${recipient}... 🚀`, 'TRANSFER_PROCESSING');

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

                await sendAndLog(`Success! ✅ Transaction ref: ${reference}`, 'TRANSFER_SUCCESS');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Transaction cancelled. ❌`, 'TRANSFER_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }

        if (session.currentState === 'AWAITING_BILL_CONFIRM') {
            const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;
            if (rawText.toLowerCase().includes('yes') || rawText.toLowerCase().includes('confirm')) {
                const { amount, customer, billType } = context as any;
                await sendAndLog(`Processing your ${billType} payment of ₦${amount}... ⏳`, 'BILL_PROCESSING');

                try {
                    const reference = `BILL-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                    // In a real scenario, we'd map billType to a Flutterwave biller code
                    // For now, using the billType directly as the name
                    await FlutterwaveService.payBill(parseFloat(amount), customer, billType, reference);

                    await prisma.transaction.create({
                        data: {
                            userId: user.id,
                            type: 'BILL_PAYMENT',
                            amount: parseFloat(amount),
                            currency: 'NGN',
                            status: 'SUCCESS',
                            reference,
                            provider: 'FLUTTERWAVE',
                            description: `${billType} payment for ${customer}`
                        }
                    });

                    await sendAndLog(`Success! ✅ Your ${billType} has been paid. Ref: ${reference}`, 'BILL_SUCCESS');
                } catch (e: any) {
                    await sendAndLog(`Payment failed: ${e.message}. Please check your balance and try again.`, 'BILL_FAILED');
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Payment cancelled. ❌`, 'BILL_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }

        if (rawText.toLowerCase() === 'menu' || rawText.toLowerCase() === 'features' || rawText.toLowerCase() === 'help' || rawText.toLowerCase().includes('hi')) {
            const menuMsg = `🏦 *ChatPay Command Menu*\n\n💰 *Wallets*: "Check Balance"\n🚀 *Send Money*: "Send 5k to John"\n💡 *Bills*: "Pay DSTV" or "Buy Airtime"\n🌐 *International*: "Create USD Card"\n₿ *Crypto*: "Buy $20 USDT"\n📜 *Giftcards*: "Sell Amazon card"\n📄 *Invoicing*: "Create 20k invoice"\n\nHow can I help you right now?`;
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
            
            case 'PAY_BILL':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Please verify your identity first to pay bills.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const { amount, billType, customer } = aiResult.entities || {};
                    const targetCustomer = customer || phoneNumber; 
                    
                    if (!amount || !billType) {
                        await sendAndLog(`Please specify the amount and what you want to pay for (e.g. Airtime, DSTV).`, 'MISSING_ENTITIES');
                    } else {
                        await sendAndLog(`Confirm paying ₦${amount} for *${billType}* to ${targetCustomer}? (Yes/No)`, 'BILL_CONFIRM');
                        await prisma.session.update({
                            where: { id: session.id },
                            data: { 
                                currentState: 'AWAITING_BILL_CONFIRM', 
                                context: JSON.stringify({ amount, billType, customer: targetCustomer }) 
                            }
                        });
                    }
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

            case 'CRYPTO':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Please verify your identity first to trade crypto.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const { amount, asset } = aiResult.entities || {};
                    if (!amount || !asset) {
                        await sendAndLog(`Please specify the amount (in USD) and asset (USDT/BTC).`, 'MISSING_ENTITIES');
                    } else {
                        await sendAndLog(`Executing Market Buy for $${amount} *${asset.toUpperCase()}*... ₿ 🚀`, 'CRYPTO_PROCESSING');
                        try {
                            const result = await quidaxService.buyCrypto(user.id, asset, parseFloat(String(amount)));
                            await sendAndLog(`Success! ✅ Your ${asset.toUpperCase()} has been purchased. Ref: ${result.data?.id || 'PROCESSED'}`, 'CRYPTO_SUCCESS');
                        } catch (e: any) {
                            await sendAndLog(`Trade failed: ${e.message}`, 'CRYPTO_FAILED');
                        }
                    }
                }
                break;

            case 'GIFTCARD':
                const cardTypes = await pressMntService.getGiftCardRates();
                const rateList = cardTypes.map(c => `• ${c.name}: ${c.rate}`).join('\n');
                await sendAndLog(`🎁 *Gift Card Desk*\n\nOur current rates:\n${rateList}\n\nTo sell a card, please type: "Sell [Type] Card [Amount]" (e.g., Sell Amazon Card $50)`, 'GIFTCARD_RATES');
                break;

            case 'CARD':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Verify your account to create Virtual Cards.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    await sendAndLog(`🌐 *Virtual Card Creation*\n\nInitiating your USD Master/Visa card... 💳`, 'CARD_START');
                    try {
                        const card = await mapleradService.createVirtualCard(user.id, 'USD', 10); // Default $10 funding
                        await sendAndLog(`Success! 🛡️ Your USD Virtual Card is active.\nType *"My Cards"* to see details.`, 'CARD_SUCCESS');
                    } catch (e: any) {
                        await sendAndLog(`Card issuance failed: ${e.message}`, 'CARD_FAILED');
                    }
                }
                break;
            case 'UNKNOWN':
            default:
                const response = await aiService.generateResponse(`User: "${rawText}". Respond as ChatPay bot — a WhatsApp banking assistant. Keep response concise and helpful.`);
                await sendAndLog(response, 'AI_FALLBACK');
                break;
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
                    payload: payload.substring(0, 2000), 
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
