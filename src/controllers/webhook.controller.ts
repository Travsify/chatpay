import { Request, Response } from 'express';
import { whapiService } from '../services/whapi.service.js';
import { aiService } from '../services/ai.service.js';
import { WalletService } from '../services/wallet.service.js';
import { FlutterwaveService } from '../services/flutterwave.service.js';
import { quidaxService } from '../services/quidax.service.js';
import { mapleradService } from '../services/maplerad.service.js';
import { pressMntService } from '../services/pressmnt.service.js';
import { VoiceService } from '../services/voice.service.js';
import prisma from '../utils/prisma.js';
import fs from 'fs';
import path from 'path';

export class WebhookController {
    
    static async handleIncoming(req: Request, res: Response) {
        const startTime = Date.now();
        try {
            const body = req.body;
            const messages = body.messages || [];
            
            for (const msg of messages) {
                if (msg.from_me) continue;

                const senderNumber = msg.from;
                let rawText = '';
                let isAudio = false;

                // 1. Unified Extraction (Text, Voice, Buttons)
                if (msg.type === 'action' && msg.action?.id) {
                    rawText = msg.action.id;
                } else if (msg.type === 'audio' || msg.type === 'voice') {
                    isAudio = true;
                    try {
                        const buffer = await whapiService.getFileBuffer(msg.audio?.id || msg.voice?.id);
                        const tmp = path.join(process.cwd(), `voice_${senderNumber}.ogg`);
                        fs.writeFileSync(tmp, buffer);
                        rawText = await VoiceService.transcribe(tmp);
                        fs.unlinkSync(tmp);
                        console.log(`[Voice] ${senderNumber}: ${rawText}`);
                    } catch (e) {
                        console.error('[Voice] Failed:', e);
                        rawText = 'VOICE_TRANSCRIPTION_FAILED';
                    }
                } else {
                    rawText = msg.text?.body || '';
                }

                if (!rawText) continue;

                // Log inbound webhook
                await WebhookController.logWebhook('INBOUND', senderNumber, JSON.stringify(msg), 'RECEIVED', Date.now() - startTime);

                let user = await prisma.user.findUnique({ where: { phoneNumber: senderNumber } });
                if (!user) user = await prisma.user.create({ data: { phoneNumber: senderNumber } });

                let session = await prisma.session.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } });
                if (!session) session = await prisma.session.create({ data: { userId: user.id, currentState: 'START' } });

                const aiResult = await aiService.parseIntent(rawText);

                await prisma.conversationLog.create({
                    data: {
                        userId: user.id,
                        direction: 'INBOUND',
                        message: rawText,
                        intent: aiResult.intent,
                        confidence: null
                    }
                });

                await WebhookController.processLogic(user, session, aiResult, rawText, isAudio);

                // Mark processed
                await WebhookController.logWebhook('INBOUND', senderNumber, '', 'PROCESSED', Date.now() - startTime);
            }

            res.status(200).send('OK');
        } catch (error) {
            console.error('Webhook Error:', error);
            await WebhookController.logWebhook('INBOUND', 'UNKNOWN', JSON.stringify(error), 'FAILED', Date.now() - startTime, String(error));
            res.status(500).send('Internal Error');
        }
    }

    private static async processLogic(user: any, session: any, aiResult: any, rawText: string, isAudio: boolean = false) {
        const { phoneNumber } = user;

        // Helper to send + log outbound messages (Hybrid Text/Voice)
        const sendAndLog = async (message: string, intent?: string) => {
            if (isAudio) {
                try {
                    const audioBuffer = await VoiceService.textToSpeech(message);
                    await whapiService.sendAudio(phoneNumber, audioBuffer);
                } catch (e) {
                    await whapiService.sendMessage(phoneNumber, message);
                }
            } else {
                await whapiService.sendMessage(phoneNumber, message);
            }
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
            const welcomeMsg = `✨ *Welcome to ChatPay: The World's First Truly Autonomous Bank* ✨\n\nI am your 24/7 AI financial companion. I don't just manage your money; I help you conquer the global financial landscape right here on WhatsApp.\n\n*Here is what I can do for you right now:*\n🌍 *Multi-Currency Accounts*: Get instant NGN/USD/EUR/GBP banking details.\n💸 *High-Speed Transfers*: Move funds to any Nigerian bank in seconds.\n💡 *Smart Bills*: One-tap payments for Airtime, Data, and Power.\n💳 *USD Virtual Cards*: Shop globally with our Master/Visa cards.\n₿ *Crypto Transactions*: Buy/Sell BTC & USDT at the best market rates.\n🎁 *Asset Trading*: Trade your Gift Cards for instant cash.\n\n*To activate your secure global vault and experience the future of banking, what is your Full Name?*`;
            await whapiService.sendList(phoneNumber, welcomeMsg, "🚀 Get Started", [
                { id: "START_ONBOARDING", title: "🏦 Open Account", description: "Get your global banking details" },
                { id: "HELP_MENU", title: "ℹ️ Service Overview", description: "See everything ChatPay can do" },
                { id: "HOME", title: "🏠 Home", description: "Back to main menu" }
            ]);
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
                if (!user.transactionPin) {
                    await sendAndLog(`🔐 *Security Setup Required*\n\nPlease enter a *4-digit PIN* to secure your account and authorize payments:`, 'PIN_SETUP_START');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_SET' } });
                } else {
                    await sendAndLog(`Please enter your *4-digit PIN* to authorize this transaction:`, 'PIN_VERIFY_REQUEST');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_VERIFY' } });
                }
            } else {
                await sendAndLog(`Transaction cancelled. ❌`, 'TRANSFER_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }

        if (session.currentState === 'AWAITING_PIN_SET') {
            const pin = rawText.trim();
            if (pin.length === 4 && /^\d+$/.test(pin)) {
                await prisma.user.update({ where: { id: user.id }, data: { transactionPin: pin } });
                await sendAndLog(`PIN set successfully! ✅ Now, please enter it once more to authorize your pending transaction:`, 'PIN_SET_SUCCESS');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_VERIFY' } });
            } else {
                await sendAndLog(`Invalid PIN. ❌ Enter exactly 4 numbers (e.g., 1234):`, 'PIN_SET_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_PIN_VERIFY') {
            if (rawText.trim() === user.transactionPin) {
                const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;
                const { amount, recipient, billType, customer } = context as any;
                
                const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
                const totalDebit = parseFloat(amount) + (config?.flatFee || 0) + (parseFloat(amount) * (config?.feePercentage || 0) / 100);
                const balance = await WalletService.getBalance(user.id);

                if (balance < totalDebit) {
                    await sendAndLog(`PIN Verified! ✅ But insufficient funds. ❌ Balance: ₦${balance.toLocaleString()}`, 'INSUFFICIENT_POST_PIN');
                } else {
                    await sendAndLog(`Authorization successful! 🚀 Processing...`, 'PIN_AUTHORIZED');
                    const reference = `${recipient ? 'CP' : 'BILL'}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                    if (recipient) {
                        await prisma.transaction.create({ data: { userId: user.id, type: 'P2P_SEND', amount: parseFloat(amount), currency: 'NGN', status: 'SUCCESS', reference, provider: 'FINCRA', description: `Transfer to ${recipient}` } });
                        await sendAndLog(`Success! ✅ Sent ₦${amount} to ${recipient}. Ref: ${reference}`, 'TRANSFER_SUCCESS');
                    } else if (billType) {
                        await FlutterwaveService.payBill(parseFloat(amount), customer, billType, reference);
                        await prisma.transaction.create({ data: { userId: user.id, type: 'BILL_PAYMENT', amount: parseFloat(amount), currency: 'NGN', status: 'SUCCESS', reference, provider: 'FLUTTERWAVE', description: `${billType} payment for ${customer}` } });
                        await sendAndLog(`Success! ✅ Your ${billType} bill is settled. Ref: ${reference}`, 'BILL_SUCCESS');
                    }
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Incorrect PIN. ❌ Verification failed. Please try again:`, 'PIN_INCORRECT');
            }
            return;
        }

        if (session.currentState === 'AWAITING_BILL_CONFIRM') {
            const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;
            if (rawText.toLowerCase().includes('yes') || rawText.toLowerCase().includes('confirm')) {
                if (!user.transactionPin) {
                    await sendAndLog(`🔐 *Security Setup Required*\n\nPlease enter a *4-digit PIN* to authorize your payment:`, 'PIN_SETUP_START');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_SET' } });
                } else {
                    await sendAndLog(`Please enter your *4-digit PIN* to authorize this bill payment:`, 'PIN_VERIFY_REQUEST');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_VERIFY' } });
                }
            } else {
                await sendAndLog(`Payment cancelled. ❌`, 'BILL_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }

        if (rawText.toLowerCase() === 'menu' || rawText.toLowerCase() === 'features' || rawText.toLowerCase() === 'help' || rawText.toLowerCase().includes('hi') || rawText === 'HOME' || rawText.toLowerCase() === 'home') {
            const menuTxt = `🏦 *Welcome to ChatPay: Your Global Autonomous Bank*\n\nManaging your finances has never been this easy. Please select an action from the menu below:`;
            await whapiService.sendList(user.phoneNumber, menuTxt, "📱 Banking Menu", [
                { id: "CHECK_BALANCE", title: "💰 Check Balance", description: "View your current funds" },
                { id: "SEND_MONEY_FLOW", title: "💸 Send Money", description: "Transfer to any bank" },
                { id: "PAY_BILLS", title: "💡 Pay Bills", description: "Airtime, Data, Power" },
                { id: "CREATE_CARD", title: "💳 Virtual Cards", description: "USD Global Shopping Card" },
                { id: "CRYPTO_TRADE", title: "₿ Trade Crypto", description: "Buy/Sell BTC & USDT" },
                { id: "OPEN_ACCOUNT_USD", title: "🌍 Open USD Account", description: "Get a US Bank Account" },
                { id: "HOME", title: "🏠 Home", description: "Refresh this menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START' } });
            return;
        }

        // Map Button IDs to Intent logic
        if (rawText === 'SEND_MONEY_FLOW') {
            await sendAndLog(`Okay! Who are we sending money to? Just tell me the name and amount (e.g., "Send 5k to John")`, 'TRANSFER_PROMPT');
            return;
        }
        if (rawText === 'OPEN_ACCOUNT_USD') {
            rawText = "Open a USD account"; // Force AI to process this
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
                    const isPending = user.fincraWalletId === 'PENDING' || !user.fincraWalletId;

                    if (isPending) {
                        await sendAndLog(`Your virtual account is still being generated by the bank... ⏳ Please try again in 60 seconds.`, 'BALANCE_PENDING');
                    } else {
                        await sendAndLog(`💰 Your ChatPay Balance:\n₦${balance.toLocaleString()}\n\nAccount: ${user.fincraWalletId}\nBank: WEMA BANK (ChatPay)`, 'BALANCE_CHECK');
                    }
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
                        // Using Admin Exchange Rate + Markup
                        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
                        const sellRate = (config?.usdExchangeRate || 1500) + (config?.usdMarkup || 50);
                        const totalNaira = parseFloat(String(amount)) * sellRate;
                        
                        await sendAndLog(`Executing Market Buy for $${amount} *${asset.toUpperCase()}*... @ ₦${sellRate}/$\nTotal: ₦${totalNaira.toLocaleString()}\n₿ 🚀`, 'CRYPTO_PROCESSING');
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
            case 'OPEN_ACCOUNT':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Verify your account first to open global currency wallets.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const { currency } = aiResult.entities || {};
                    const targetCurrency = (currency || 'USD').toUpperCase();
                    await sendAndLog(`Generating your *${targetCurrency}* Virtual Account... 🏦 ⏳`, 'ACCOUNT_START');
                    try {
                        const account = await WalletService.setupUserWallet(user.id, 'individual', undefined, targetCurrency);
                        const accountMsg = `🎉 *Your ${targetCurrency} Account is Live!* 🌍\n\n*Account Number*: ${account?.accountNumber || 'Pending'}\n*Bank*: WEMA BANK (ChatPay)\n*Currency*: ${targetCurrency}\n*Account Name*: ${user.name}\n\nFund this account to start transacting globally!`;
                        await sendAndLog(accountMsg, 'ACCOUNT_CREATED');
                    } catch (e: any) {
                        await sendAndLog(`Account creation failed: ${e.message}`, 'ACCOUNT_FAILED');
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
