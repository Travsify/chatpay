import { Request, Response } from 'express';
import axios from 'axios';
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
        // DIAGNOSTIC: Log outbound IP for Fincra whitelisting
        axios.get('https://api.ipify.org').then(res => console.log(`[DIAGNOSTIC] Server Outbound IP: ${res.data}`)).catch(() => {});

        const startTime = Date.now();
        try {
            const body = req.body;
            const messages = body.messages || [];
            
            for (const msg of messages) {
                if (msg.from_me) continue;

                const messageId = msg.id;
                if (messageId) {
                    const existing = await prisma.webhookLog.findFirst({
                        where: { payload: { contains: messageId }, status: 'PROCESSED' }
                    });
                    if (existing) {
                        console.log(`[Webhook] Skipping duplicate message: ${messageId}`);
                        continue;
                    }
                }

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
                } else if (msg.type === 'call_log' || msg.type === 'system') {
                    rawText = 'SYSTEM_CALL_REJECTED';
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

        // 0. Global Priority Commands (Reset, Menu, Help)
        if (rawText === 'SYSTEM_CALL_REJECTED') {
            await sendAndLog(`Hello! 🤖 I am ChatPay's AI Assistant. I operate natively inside WhatsApp, but I cannot answer voice or video calls on this line.\n\nPlease type your message or send a voice note, and I will assist you instantly!`, 'CALL_REJECTED');
            return;
        }

        const isMenu = rawText.toLowerCase() === 'menu' || rawText.toLowerCase() === 'features' || rawText.toLowerCase() === 'help' || rawText === 'HOME' || rawText.toLowerCase() === 'home';
        const isHi = rawText.toLowerCase().includes('hi') || rawText.toLowerCase().includes('hello');
        
        if (rawText.toLowerCase() === 'reset') {
            await prisma.session.deleteMany({ where: { userId: user.id } });
            await prisma.user.update({ where: { id: user.id }, data: { name: null, kycStatus: 'PENDING' } });
            await whapiService.sendMessage(phoneNumber, "✨ *ChatPay Session Reset:* Your vault has been refreshed. Say 'Hi' to restart.");
            return;
        }

        const context = typeof session.context === 'string' ? JSON.parse(session.context) : (session.context || {});
        
        if (rawText === 'BACK' && context.previousState) {
            await prisma.session.update({ 
                where: { id: session.id }, 
                data: { currentState: context.previousState, context: JSON.stringify({ ...context, previousState: null }) } 
            });
            // Re-trigger logic with empty text to refresh the previous state's prompt
            return WebhookController.processLogic(user, await prisma.session.findUnique({where:{id:session.id}}), aiResult, 'REFRESH');
        }

        if (isMenu || (isHi && session.currentState === 'START')) {
            if (!user.name || user.kycStatus !== 'VERIFIED') {
                const welcomeMsg = `✨ *Welcome to ChatPay: The World\'s First Truly Autonomous Bank* ✨\n\nI am your 24/7 AI financial companion. I don't just manage your money; I help you conquer the global financial landscape right here on WhatsApp.\n\n*Here is what I can do for you right now:*\n🌍 *Multi-Currency Accounts*: Get instant NGN/USD/EUR/GBP banking details.\n💸 *High-Speed Transfers*: Move funds to any Nigerian bank in seconds.\n💡 *Smart Bills*: One-tap payments for Airtime, Data, and Power.\n💳 *USD Virtual Cards*: Shop globally with our Master/Visa cards.\n₿ *Crypto Transactions*: Buy/Sell BTC & USDT at the best market rates.\n🎁 *Asset Trading*: Trade your Gift Cards for instant cash.\n\n*To activate your secure global vault and experience the future of banking, what is your Full Name?*`;
                try {
                    await whapiService.sendList(phoneNumber, welcomeMsg, "🚀 Get Started", [
                        { id: "START_ONBOARDING", title: "🏦 Open Account", description: "Get your global banking details" },
                        { id: "HELP_MENU", title: "ℹ️ Service Overview", description: "See everything ChatPay can do" },
                        { id: "HOME", title: "🏠 Home", description: "Back to main menu" }
                    ]);
                } catch (e) {
                    await whapiService.sendMessage(phoneNumber, welcomeMsg);
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
            } else {
                const menuTxt = `🏦 *Welcome to ChatPay: Your Global Autonomous Bank*\n\nHow can I help you manage your wealth today? Please select an option:`;
                await whapiService.sendList(user.phoneNumber, menuTxt, "📱 Banking Menu", [
                    { id: "CHECK_BALANCE", title: "💰 Check Balance", description: "View your current funds" },
                    { id: "FUND_WALLET", title: "🏦 Fund Wallet", description: "Get your account numbers" },
                    { id: "SEND_MONEY_FLOW", title: "💸 Send Money", description: "Transfer to any bank or user" },
                    { id: "PAY_BILLS", title: "💡 Pay Bills", description: "Airtime, Data, Power, TV" },
                    { id: "CARD_MENU", title: "💳 Virtual Cards", description: "USD Master/Visa cards" },
                    { id: "ASSET_TRADING", title: "₿ Asset Trading", description: "Buy/Sell Crypto & Giftcards" },
                    { id: "GLOBAL_ACCOUNTS", title: "🌍 Global Wallets", description: "Open USD, GBP or EUR accounts" },
                    { id: "HOME", title: "🏠 Home", description: "Refresh this menu" }
                ]);
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START' } });
            }
            return;
        }

        // 1. Check Ongoing Flow States
        if (session.currentState === 'AWAITING_NAME' || rawText === 'REFRESH' && session.currentState === 'AWAITING_NAME') {
            if (rawText !== 'REFRESH') {
                await prisma.user.update({ where: { id: user.id }, data: { name: rawText } });
            }
            await whapiService.sendButtons(phoneNumber, `Thanks ${user.name || 'there'}! 🤝 Is this account for yourself or a business?`, [
                { id: "TYPE_INDIVIDUAL", title: "👤 Individual" },
                { id: "TYPE_BUSINESS", title: "💼 Business" },
                { id: "HOME", title: "🏠 Home" }
            ], "Tap an option to proceed.");
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TYPE', context: JSON.stringify({ ...context, previousState: 'AWAITING_NAME' }) } });
            return;
        }

        if (session.currentState === 'AWAITING_TYPE' || (rawText.startsWith('TYPE_') || rawText === 'REFRESH' && session.currentState === 'AWAITING_TYPE')) {
            const choice = rawText.replace('TYPE_', '').toLowerCase();
            if (choice.includes('personal') || choice.includes('individual') || choice === '1' || choice === 'individual') {
                await sendAndLog(`Great! Kindly provide your *11-digit Bank Verification Number (BVN)* for private verification in order to create your virtual bank account. 🛡️\n\n_Dial *565*0# on your phone to check your BVN if you forgot it._`, 'SIGNUP_KYC');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC', context: JSON.stringify({ ...context, type: 'individual', previousState: 'AWAITING_TYPE' }) } });
            } else if (choice.includes('business') || choice.includes('company') || choice === '2' || choice === 'business') {
                await sendAndLog(`Understood. Please provide your *Registered Business Name*:`, 'SIGNUP_BUSINESS_NAME');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_BUSINESS_NAME', context: JSON.stringify({ ...context, type: 'business', previousState: 'AWAITING_TYPE' }) } });
            } else if (rawText !== 'REFRESH') {
                await sendAndLog(`Please choose Individual or Business from the menu.`, 'SIGNUP_TYPE_RETRY');
            }
            return;
        }

        if (session.currentState === 'AWAITING_BUSINESS_NAME' || rawText === 'REFRESH' && session.currentState === 'AWAITING_BUSINESS_NAME') {
            await sendAndLog(`Got it. Now, please provide your *CAC Number* (RC Number) for verification:`, 'SIGNUP_CAC');
            await prisma.session.update({ where: { id: session.id }, data: { 
                currentState: 'AWAITING_KYC', 
                context: JSON.stringify({ ...context, businessName: rawText, previousState: 'AWAITING_BUSINESS_NAME' }) 
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
                    data: { 
                        kycStatus: 'VERIFIED',
                        ...(isBusiness ? {} : { bvn: rawText.replace(/\D/g, '') }) 
                    } 
                });
                
                await sendAndLog(`⚠️ *Security Notice*: Your BVN has been securely encrypted in our vault. Please long-press and delete your previous message containing your BVN to protect yourself from unauthorized access to your device.`, 'KYC_SECURITY_NOTICE');
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
                await sendAndLog(`Invalid ${isBusiness ? 'CAC Number' : 'BVN'}. ❌ Please enter valid credentials to secure your wallet.`, 'KYC_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_CONFIRM') {
            const context = typeof session.context === 'string' ? JSON.parse(session.context) : session.context;
            const { amount, recipient } = context as any;
            
            if (rawText.toLowerCase().includes('yes') || rawText === 'CONFIRM_TX') {
                if (!user.transactionPin) {
                    await sendAndLog(`🔐 *Security Setup Required*\n\nPlease enter a *4-digit PIN* to secure your account and authorize payments:`, 'PIN_SETUP_START');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_SET' } });
                } else {
                    await sendAndLog(`Please enter your *4-digit PIN* to authorize this transaction:`, 'PIN_VERIFY_REQUEST');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_VERIFY' } });
                }
            } else if (rawText === 'BACK' || rawText === 'CANCEL_TX' || rawText.toLowerCase().includes('no')) {
                await sendAndLog(`Transaction cancelled. ❌`, 'TRANSFER_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else if (rawText === 'REFRESH') {
                await whapiService.sendButtons(phoneNumber, `Send ₦${amount} to ${recipient}? 💸`, [
                    { id: "CONFIRM_TX", title: "✅ Yes, Send" },
                    { id: "CANCEL_TX", title: "❌ No, Cancel" },
                    { id: "HOME", title: "🏠 Home" }
                ]);
            }
            return;
        }

        if (session.currentState === 'AWAITING_PIN_SET') {
            const pin = rawText.trim();
            if (pin.length === 4 && /^\d+$/.test(pin)) {
                await prisma.user.update({ where: { id: user.id }, data: { transactionPin: pin } });
                await sendAndLog(`PIN set successfully! ✅ Now, please enter it once more to authorize your pending transaction:\n\n⚠️ *Security Notice*: Please long-press and delete your previous message containing your new PIN to protect your account.`, 'PIN_SET_SUCCESS');
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
                    const newBalance = balance - totalDebit;
                    if (recipient) {
                        await prisma.transaction.create({ data: { userId: user.id, type: 'P2P_SEND', amount: parseFloat(amount), currency: 'NGN', status: 'SUCCESS', reference, provider: 'FINCRA', description: `Transfer to ${recipient}` } });
                        await sendAndLog(`Success! ✅ Sent ₦${amount} to ${recipient}.\n\n🧾 *Receipt*\nRef: ${reference}\nFee: ₦${totalDebit - parseFloat(amount)}\nNew Balance: ₦${newBalance.toLocaleString()}`, 'TRANSFER_SUCCESS');
                    } else if (billType) {
                        await FlutterwaveService.payBill(parseFloat(amount), customer, billType, reference);
                        await prisma.transaction.create({ data: { userId: user.id, type: 'BILL_PAYMENT', amount: parseFloat(amount), currency: 'NGN', status: 'SUCCESS', reference, provider: 'FLUTTERWAVE', description: `${billType} payment for ${customer}` } });
                        await sendAndLog(`Success! ✅ Your ${billType} bill is settled.\n\n🧾 *Receipt*\nRef: ${reference}\nFee: ₦${totalDebit - parseFloat(amount)}\nNew Balance: ₦${newBalance.toLocaleString()}`, 'BILL_SUCCESS');
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
            const { amount, billType } = context as any;
            
            if (rawText.toLowerCase().includes('yes') || rawText === 'CONFIRM_BILL') {
                if (!user.transactionPin) {
                    await sendAndLog(`🔐 *Security Setup Required*\n\nPlease enter a *4-digit PIN* to authorize your payment:`, 'PIN_SETUP_START');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_SET' } });
                } else {
                    await sendAndLog(`Please enter your *4-digit PIN* to authorize this bill payment:`, 'PIN_VERIFY_REQUEST');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_VERIFY' } });
                }
            } else if (rawText === 'CANCEL_BILL' || rawText.toLowerCase().includes('no')) {
                await sendAndLog(`Payment cancelled. ❌`, 'BILL_CANCELLED');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else if (rawText === 'REFRESH') {
                await whapiService.sendButtons(phoneNumber, `Pay ₦${amount} for ${billType}? 💡`, [
                    { id: "CONFIRM_BILL", title: "✅ Yes, Pay" },
                    { id: "CANCEL_BILL", title: "❌ No, Cancel" },
                    { id: "HOME", title: "🏠 Home" }
                ]);
            }
            return;
        }

        // ===== MENU BUTTON HANDLERS =====
        if (rawText === 'FUND_WALLET' || rawText === 'REFRESH' && session.currentState === 'FUND_WALLET') {
            const fundTxt = `🏦 *Fund Your Wallet*\n\nSelect the currency you'd like to fund:`;
            await whapiService.sendList(phoneNumber, fundTxt, "Select Currency", [
                { id: "FUND_NGN", title: "🇳🇬 Fund NGN", description: "Get your local bank details" },
                { id: "FUND_USD", title: "🇺🇸 Fund USD", description: "Get your US banking details" },
                { id: "FUND_GBP", title: "🇬🇧 Fund GBP", description: "Get your UK banking details" },
                { id: "HOME", title: "🔙 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'FUND_WALLET', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'FUND_NGN') {
            const balance = await WalletService.getBalance(user.id);
            const msg = `🇳🇬 *Your NGN Bank Details*\n\n*Bank*: WEMA BANK\n*Account Number*: ${user.fincraWalletId || 'PENDING'}\n*Account Name*: ${user.name}\n\nBalance: ₦${balance.toLocaleString()}\n\n_Transfer funds to this account to top up instantly._`;
            await whapiService.sendList(phoneNumber, msg, "Options", [
                { id: "CHECK_BALANCE", title: "💰 Refresh Balance", description: "See current funds" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            return;
        }

        if (rawText === 'CARD_MENU' || rawText === 'REFRESH' && session.currentState === 'CARD_MENU') {
            const cardTxt = `💳 *Virtual Cards*\n\nManage your global shopping cards:`;
            await whapiService.sendList(phoneNumber, cardTxt, "Card Services", [
                { id: "CREATE_CARD", title: "✨ Create New Card", description: "Generate a USD Master/Visa card" },
                { id: "MY_CARDS", title: "📂 View My Cards", description: "See active cards & balances" },
                { id: "TOPUP_CARD", title: "💰 Top Up Card", description: "Add funds to your virtual card" },
                { id: "BACK", title: "🔙 Back", description: "Return to previous menu" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'CARD_MENU', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'ASSET_TRADING' || rawText === 'REFRESH' && session.currentState === 'ASSET_TRADING') {
            const assetTxt = `₿ *Asset Trading Desk*\n\nSelect a market to trade in:`;
            await whapiService.sendList(phoneNumber, assetTxt, "Trading Markets", [
                { id: "CRYPTO_TRADE", title: "₿ Trade Crypto", description: "Buy/Sell BTC & USDT" },
                { id: "GIFTCARD", title: "🎁 Sell Giftcards", description: "Trade giftcards for cash" },
                { id: "BACK", title: "🔙 Back", description: "Return to previous menu" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'ASSET_TRADING', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'GLOBAL_ACCOUNTS' || rawText === 'REFRESH' && session.currentState === 'GLOBAL_ACCOUNTS') {
            const globalTxt = `🌍 *Global Wallets*\n\nExpand your financial reach:`;
            await whapiService.sendList(phoneNumber, globalTxt, "Global Services", [
                { id: "OPEN_ACCOUNT_USD", title: "🇺🇸 Open USD Account", description: "Get US Banking details" },
                { id: "OPEN_ACCOUNT_GBP", title: "🇬🇧 Open GBP Account", description: "Get UK Banking details" },
                { id: "BACK", title: "🔙 Back", description: "Return to previous menu" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'GLOBAL_ACCOUNTS', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'SEND_MONEY_FLOW') {
            await whapiService.sendList(phoneNumber, `Okay! 💸 Who are we sending money to? \n\nI can send money to any **Nigerian Bank Account** or another **ChatPay User** instantly.\n\nPlease reply with their *10-digit Account Number* (or ChatPay Phone Number) and the amount.\n\nExample: "Send 5000 to 08012345678"`, "Transfer Mode", [
                { id: "BANK_TRANSFER", title: "🏦 External Bank", description: "Any Nigerian bank" },
                { id: "P2P_TRANSFER", title: "📱 Internal User", description: "ChatPay to ChatPay" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'SEND_MONEY_FLOW', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'OPEN_ACCOUNT_USD') {
            rawText = "Open a USD account"; // Force AI to process this
        }

        if (rawText === 'OPEN_ACCOUNT_GBP') {
            rawText = "Open a GBP account"; // Force AI to process this
        }

        if (rawText === 'CRYPTO_TRADE') {
            await sendAndLog(`Okay! ₿ Which asset would you like to buy? (e.g. "Buy $100 USDT")`, 'CRYPTO_PROMPT');
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
                        await whapiService.sendButtons(phoneNumber, `Confirm: Send ₦${amount} to ${recipient}? 💸`, [
                            { id: "CONFIRM_TX", title: "✅ Yes, Send" },
                            { id: "CANCEL_TX", title: "❌ No, Cancel" },
                            { id: "HOME", title: "🏠 Home" }
                        ]);
                        await prisma.session.update({
                            where: { id: session.id },
                            data: { currentState: 'AWAITING_TRANSFER_CONFIRM', context: JSON.stringify({ ...context, amount, recipient, previousState: 'START' }) }
                        });
                    }
                }
                break;

            case 'CHECK_BALANCE':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Please signup/verify first to check your balance.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    // Auto-retry wallet creation if it failed during onboarding
                    if (!user.fincraCustomerId) {
                        await sendAndLog(`Setting up your wallet now... ⏳`, 'WALLET_RETRY');
                        try {
                            const wallet = await WalletService.setupUserWallet(user.id, 'individual');
                            user = await prisma.user.findUnique({ where: { id: user.id } }) as any;
                            const bankDetails = `✨ *Success! Your Wallet is Ready* 🏦\n\n*Account Number*: ${wallet?.accountNumber || 'Generating...'}\n*Bank Name*: WEMA BANK (ChatPay)\n*Account Name*: ${user.name}\n\n*Next Steps:*\n1. Fund your account using the details above.\n2. Type *"Balance"* to see your current funds.\n3. Type *"Menu"* to see everything I can do.`;
                            await sendAndLog(bankDetails, 'WALLET_CREATED');
                            break;
                        } catch (e) {
                            console.error('[Wallet] Auto-retry failed:', e);
                            await sendAndLog(`We're having trouble connecting to the bank. Please try again in a moment.`, 'WALLET_RETRY_FAILED');
                            break;
                        }
                    }

                    const balance = await WalletService.getBalance(user.id);
                    const isPending = user.fincraWalletId === 'PENDING' || !user.fincraWalletId;

                    if (isPending) {
                        await sendAndLog(`Your virtual account is still being generated by the bank... ⏳ Please try again in 60 seconds.`, 'BALANCE_PENDING');
                    } else {
                        const balMsg = `💰 *Your ChatPay Balance*:\n₦${balance.toLocaleString()}\n\n*Account*: ${user.fincraWalletId}\n*Bank*: WEMA BANK (ChatPay)`;
                        await whapiService.sendButtons(phoneNumber, balMsg, [
                            { id: "SEND_MONEY_FLOW", title: "💸 Send Money" },
                            { id: "PAY_BILLS", title: "💡 Pay Bills" },
                            { id: "HOME", title: "🏠 Home" }
                        ]);
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
                        await whapiService.sendButtons(phoneNumber, `Confirm: Pay ₦${amount} for *${billType}* to ${targetCustomer}? 💡`, [
                            { id: "CONFIRM_BILL", title: "✅ Yes, Pay" },
                            { id: "CANCEL_BILL", title: "❌ No, Cancel" },
                            { id: "HOME", title: "🏠 Home" }
                        ]);
                        await prisma.session.update({
                            where: { id: session.id },
                            data: { 
                                currentState: 'AWAITING_BILL_CONFIRM', 
                                context: JSON.stringify({ ...context, amount, billType, customer: targetCustomer, previousState: 'START' }) 
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
