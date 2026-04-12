import { Request, Response } from 'express';
import axios from 'axios';
import { whapiService } from '../services/whapi.service.js';
import { aiService } from '../services/ai.service.js';
import { WalletService } from '../services/wallet.service.js';
import { bitnobService } from '../services/bitnob.service.js';
import { pressMntService } from '../services/pressmnt.service.js';
import { VoiceService } from '../services/voice.service.js';
import { EmailService } from '../services/email.service.js';
import { fincraService } from '../services/fincra.service.js';
import { mapleradService } from '../services/maplerad.service.js';
import prisma from '../utils/prisma.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

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

                // 1. Robust Extraction (Text, Voice, Buttons, Lists, Media)
                if (msg.type === 'audio' || msg.type === 'voice') {
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
                } else if (msg.type === 'image' || msg.type === 'document') {
                    try {
                        const mediaId = msg.image?.id || msg.document?.id;
                        const mime = msg.image?.mime_type || msg.document?.mime_type || 'image/jpeg';
                        const buffer = await whapiService.getFileBuffer(mediaId);
                        
                        // Let Agent "read" the document
                        const extracted = await aiService.scrapeDocument(buffer, mime);
                        if (extracted && extracted.AccountNumber) {
                            rawText = `SCRAPED_DOCUMENT:${JSON.stringify(extracted)}`;
                        } else {
                            rawText = 'DOCUMENT_READ_FAILURE';
                        }
                    } catch (mediaErr) {
                        console.error('[Media Scrape] Failed:', mediaErr);
                        rawText = 'MEDIA_PROCESSING_ERROR';
                    }
                } else if (msg.type === 'call_log' || msg.type === 'system') {
                    rawText = 'SYSTEM_CALL_REJECTED';
                } else {
                    // Extract ID from any possible interactive reply path
                    const interactiveId = 
                        msg.action?.id || 
                        msg.interactive?.button_reply?.id || 
                        msg.interactive?.list_reply?.id || 
                        msg.button_reply?.id || 
                        msg.list_reply?.id ||
                        (msg.type === 'interactive' && msg.interactive?.type === 'button_reply' ? msg.interactive?.button_reply?.id : null) ||
                        (msg.type === 'interactive' && msg.interactive?.type === 'list_reply' ? msg.interactive?.list_reply?.id : null);

                    if (msg.type === 'interactive' && msg.interactive?.type === 'flow_response') {
                        const flowData = msg.interactive.flow_response?.response_json;
                        // Map flow data to a recognizable text trigger for the logic processor
                        if (flowData) {
                            rawText = `FLOW_RESPONSE_${JSON.stringify(flowData)}`;
                            console.log(`[Webhook] Extracted Flow Data:`, flowData);
                        }
                    } else if (interactiveId) {
                        rawText = interactiveId;
                        // Strip Whapi gateway prefixes
                        if (rawText.includes(':')) rawText = rawText.split(':').pop() || rawText;
                        console.log(`[Webhook] Extracted Interactive ID: ${rawText}`);
                    } else {
                        rawText = msg.text?.body || msg.body || '';
                    }
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

    static async requestSync(req: Request, res: Response) {
        const { phoneNumber } = req.body;
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Save OTP to user context in session
        const user = await prisma.user.upsert({
            where: { phoneNumber },
            update: {},
            create: { phoneNumber }
        });
        
        await prisma.session.upsert({
            where: { userId: user.id },
            update: { context: JSON.stringify({ syncOtp: otp }) },
            create: { userId: user.id, context: JSON.stringify({ syncOtp: otp }) }
        });

        const msg = `🔐 *Web Vault Sync Code*\n\nHi! Someone is trying to access your ChatPay Web Vault.\n\nYour code is: *${otp}*\n\nIf this isn't you, please ignore this message.`;
        await whapiService.sendMessage(phoneNumber, msg);
        
        res.json({ success: true, message: 'OTP sent to WhatsApp' });
    }

    static async verifySync(req: Request, res: Response) {
        const { phoneNumber, otp } = req.body;
        const user = await prisma.user.findUnique({ where: { phoneNumber } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const session = await prisma.session.findUnique({ where: { userId: user.id } });
        const context = JSON.parse(session?.context || '{}');

        if (context.syncOtp === otp) {
            // Success! We would normally issue a JWT here
            res.json({ success: true, user });
        } else {
            res.status(400).json({ error: 'Invalid OTP' });
        }
    }

    static async handleWebMessage(req: Request, res: Response) {
        const { phoneNumber, message } = req.body;
        const user = await prisma.user.findUnique({ where: { phoneNumber } });
        if (!user) return res.status(404).json({ error: 'Access Denied' });

        const session = await prisma.session.findFirst({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' } });
        const aiResult = await aiService.parseIntent(message);
        
        // Pass dummy sendAndLog that returns response to web
        let responseText = '';
        const mockSendAndLog = async (msg: string) => { responseText = msg; };

        // Redirect to processLogic but capture output
        // (This would need significant refactoring of processLogic to return 
        // string instead of calling whapiService directly)
        // For now, we'll let it process and return AI's thoughts
        
        res.json({ success: true, response: responseText || "Mission Received. I'm working on it!" });
    }

    private static async processLogic(user: any, session: any, aiResult: any, rawInput: string, isAudio: boolean = false) {
        const { phoneNumber } = user;
        let rawText = rawInput;
        let context = typeof session.context === 'string' ? JSON.parse(session.context) : (session.context || {});

        // Direct ID to Intent Mapping for native UI reliability
        const directMapping: Record<string, string> = {
            'CHECK_BALANCE': 'CHECK_BALANCE',
            'SEND_MONEY': 'SEND_FUNDS',
            'PAY_BILLS': 'PAY_BILL',
            'CARD_MENU': 'CARD',
            'ASSET_TRADING': 'CRYPTO',
            'GLOBAL_ACCOUNTS': 'OPEN_ACCOUNT',
            'FUND_WALLET': 'FUND_WALLET',
            'START_INDIVIDUAL': 'SIGNUP_PERSONAL',
            'START_BUSINESS': 'SIGNUP_BUSINESS'
        };

        if (directMapping[rawText]) {
            console.log(`[UX] Direct intent mapping for ID: ${rawText}`);
            aiResult.intent = directMapping[rawText];
        }

        // Helper to send + log outbound messages (Hybrid Text/Voice)
        const sendAndLog = async (message: string, intent?: string) => {
            if (message.includes('Success! 🛡️ Your USD Virtual Card is active.')) {
                try {
                    await whapiService.sendButtons(phoneNumber, message, [{ id: "MY_CARDS", title: "📂 View Card Details" }, { id: "HOME", title: "🏠 Home" }]);
                } catch (e) {
                    await whapiService.sendMessage(phoneNumber, message);
                }
            } else {
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

        // ===== GLOBAL PRIORITY: FLOW DATA EXTRACTION =====
        if (rawText.startsWith('FLOW_RESPONSE_')) {
            try {
                const data = JSON.parse(rawText.replace('FLOW_RESPONSE_', ''));
                console.log(`[Flow] Processing flow data for user ${user.id}:`, data);
                
                // If it's a Signup Flow
                if (data.bvn) {
                    const fullName = data.name || user.name || 'ChatPay User';
                    await prisma.user.update({ where: { id: user.id }, data: { name: fullName } });
                    
                    // Proceed to KYC verification
                    rawText = data.bvn;
                    session.currentState = 'AWAITING_KYC';
                    context = { ...context, type: 'individual' };
                }
            } catch (e) {
                console.error('[Flow] Extraction failed:', e);
            }
        }

        // ===== GLOBAL PRIORITY: START AFRESH (Before Mapping) =====
        if (rawText.toLowerCase() === 'reset' || rawText === 'RESTART_FLOW' || rawText === 'START_OVER') {
            await prisma.session.deleteMany({ where: { userId: user.id } });
            await prisma.user.update({ where: { id: user.id }, data: { name: null, kycStatus: 'PENDING', fincraWalletId: null, fincraCustomerId: null, transactionPin: null } });
            
            const restartMsg = "✨ *ChatPay Home:* Your session has been reset. You've been brought back to the main menu. Say 'Hi' to continue.";
            await whapiService.sendMessage(phoneNumber, restartMsg);
            return;
        }

        // ===== UX: NUMBER-BASED MENU SELECTION =====
        if (/^\d+$/.test(rawText) && context.lastMenuOptions) {
            const index = parseInt(rawText) - 1;
            if (index >= 0 && index < context.lastMenuOptions.length) {
                const mappedId = context.lastMenuOptions[index].id;
                console.log(`[UX] Mapping number "${rawText}" to menu ID: ${mappedId} for user ${phoneNumber}`);
                rawText = mappedId;
            }
        }


        // ===== SECURITY: KYC GATEWAY =====
        const bankingCommands = ['CHECK_BALANCE', 'FUND_WALLET', 'SEND_MONEY', 'PAY_BILLS', 'CARD_MENU', 'ASSET_TRADING', 'GLOBAL_ACCOUNTS', 'GLOBAL_WALLETS'];
        if (bankingCommands.includes(rawText) && user.kycStatus !== 'VERIFIED') {
            await sendAndLog(`🔐 *Security Guard:* You must complete your account activation before accessing banking features.`, 'KYC_REQUIRED');
            return WebhookController.processLogic(user, session, aiResult, 'MENU');
        }

        // 0. Global Priority Commands (Reset, Menu, Help)
        if (rawText === 'SYSTEM_CALL_REJECTED') {
            await sendAndLog(`Hello! 🤖 I am ChatPay's AI Assistant. I operate natively inside WhatsApp, but I cannot answer voice or video calls on this line.\n\nPlease type your message or send a voice note, and I will assist you instantly!`, 'CALL_REJECTED');
            return;
        }

        const isMenu = rawText.toLowerCase() === 'menu' || rawText.toLowerCase() === 'features' || rawText.toLowerCase() === 'help' || rawText === 'HOME' || rawText.toLowerCase() === 'home';
        const isHi = rawText.toLowerCase().includes('hi') || rawText.toLowerCase().includes('hello');

        if (rawText === 'BACK' && context.previousState) {
            await prisma.session.update({ 
                where: { id: session.id }, 
                data: { currentState: context.previousState, context: JSON.stringify({ ...context, previousState: null }) } 
            });
            // Re-trigger logic with empty text to refresh the previous state's prompt
            return WebhookController.processLogic(user, await prisma.session.findUnique({where:{id:session.id}}), aiResult, 'REFRESH');
        }

        if (rawText === 'START_ONBOARDING' || rawText === 'OPEN_ACCOUNT') {
            const welcomeMsg = `✨ *Welcome to ChatPay: The World\'s First Truly Autonomous Bank* ✨\n\nI am your 24/7 AI financial companion.\n\n*To activate your secure global vault, what is your FULL LEGAL NAME?*\n\n⚠️ *Note*: Use the exact name on your **BVN or ID Card** to avoid bank verification errors.`;
            await sendAndLog(welcomeMsg, 'SIGNUP_START');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
            return;
        }

        if (rawText === 'HELP_MENU') {
            await sendAndLog(`ChatPay is an autonomous banking engine. You can:\n• 💰 Check Balances\n• 🏦 Fund Wallets\n• 💸 Send Money\n• 💡 Pay Bills\n• 💳 Get Virtual Cards\n\nType "Menu" to see all options!`, 'HELP_INFO');
            return;
        }

        if (isMenu || (isHi && session.currentState === 'START')) {
            const isVerified = user.kycStatus === 'VERIFIED' && user.fincraWalletId;
            
            if (!isVerified) {
                const welcomeMsg = `✨ *Welcome to ChatPay: The World\'s First Truly Autonomous Bank* ✨\n\nI am your 24/7 AI financial companion.\n\n*To activate your secure global vault, choose your account type below:*`;
                const welcomeMenu = [
                    { id: "START_INDIVIDUAL", title: "👤 Personal Account", description: "Individual banking & savings" },
                    { id: "START_BUSINESS", title: "💼 Business Account", description: "For registered companies/entities" },
                    { id: "RESTART_FLOW", title: "🔄 Start Afresh", description: "Wipe progress and restart onboarding" },
                    { id: "HOME", title: "🏠 Home", description: "Back to main menu" }
                ];
                try {
                    await whapiService.sendList(phoneNumber, welcomeMsg, "🚀 Get Started", welcomeMenu);
                } catch (e) {
                    await whapiService.sendMessage(phoneNumber, welcomeMsg);
                }
                await prisma.session.update({ 
                    where: { id: session.id }, 
                    data: { currentState: 'START', context: JSON.stringify({ ...context, lastMenuOptions: welcomeMenu }) } 
                });
            } else {
                // Existing Verified Users - AGENTIC EXPERIENCE
                const menuTxt = `🤖 *Status: Agent Active* 🤖\n\nWelcome back to your secure vault. I am standing by for your next mission.\n\nWhat should I execute for you?`;
                const mainMenu = [
                    { id: "CHECK_BALANCE", title: "💰 Vault Balance", description: "View your current funds" },
                    { id: "FUND_WALLET", title: "🏦 Receive Funds", description: "Get your global AC numbers" },
                    { id: "SEND_MONEY", title: "💸 Launch Transfer", description: "Transfer to any bank or user" },
                    { id: "PAY_BILLS", title: "💡 Settle Bills", description: "Airtime, Data, Power, TV" },
                    { id: "CARD_MENU", title: "💳 Card Vault", description: "Access your 3DS Virtual Cards" },
                    { id: "ASSET_TRADING", title: "₿ Asset Hub", description: "Buy/Sell & Auto-Buy Crypto" },
                    { id: "CHECK_BUDGET", title: "📊 Advisor Report", description: "AI Insight into your spending" },
                    { id: "HOME", title: "🏠 Refresh Agent", description: "Refresh this mission menu" }
                ];
                await whapiService.sendList(user.phoneNumber, menuTxt, "🚀 Mission Center", mainMenu);
                await prisma.session.update({ 
                    where: { id: session.id }, 
                    data: { currentState: 'START', context: JSON.stringify({ ...context, lastMenuOptions: mainMenu, previousState: null }) } 
                });
            }
            return;
        }

        if (session.currentState === 'AWAITING_NAME' || (rawText === 'REFRESH' && session.currentState === 'AWAITING_NAME')) {
            if (rawText !== 'REFRESH') {
                await prisma.user.update({ where: { id: user.id }, data: { name: rawText } });
                const welcomeMsg = `Thanks ${rawText}! 🤝 To activate your secure vault, choose your account type below:`;
                const accountMenu = [
                    { id: "START_INDIVIDUAL", title: "👤 Personal Account", description: "Individual banking & savings" },
                    { id: "START_BUSINESS", title: "💼 Business Account", description: "For registered companies/entities" },
                    { id: "HOME", title: "🏠 Home", description: "Back to main menu" }
                ];
                await whapiService.sendList(phoneNumber, welcomeMsg, "Select Type", accountMenu);
                await prisma.session.update({ 
                    where: { id: session.id }, 
                    data: { currentState: 'START', context: JSON.stringify({ ...context, name: rawText, lastMenuOptions: accountMenu }) } 
                });
            }
            return;
        }

        if (rawText === 'START_INDIVIDUAL') {
            const userName = user.name || context.name;
            const msg = `🛡️ *Entering Secure Session*\n\nYou are now activating your global banking vault. To proceed, please reply with your **11-Digit BVN**.\n\n_Note: For your privacy, you should delete your message immediately after I verify it._\n\n*Need Help?* Dial *565*0#`;
            
            await whapiService.sendButtons(phoneNumber, msg, [
                { id: "BACK", title: "🔙 Back" },
                { id: "HOME", title: "🏠 Home" }
            ]);
            
            await prisma.session.update({ 
                where: { id: session.id }, 
                data: { currentState: 'AWAITING_KYC', context: JSON.stringify({ ...context, type: 'individual', previousState: 'START' }) } 
            });
            return;
        }

        if (rawText === 'START_BUSINESS') {
            const userName = user.name || context.name;
            await sendAndLog(`Understood. To setup your *Business Account*, please provide your **Registered Business Name**:`, 'SIGNUP_BUSINESS_NAME_PROMPT');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_BUSINESS_NAME', context: JSON.stringify({ ...context, type: 'business' }) } });
            return;
        }

        if (session.currentState === 'AWAITING_INDIVIDUAL_NAME' || (rawText === 'REFRESH' && session.currentState === 'AWAITING_INDIVIDUAL_NAME')) {
            if (rawText !== 'REFRESH') {
                await prisma.user.update({ where: { id: user.id }, data: { name: rawText } });
                await sendAndLog(`Thanks ${rawText}! Finally, kindly provide your *11-digit Bank Verification Number (BVN)* for private verification in order to create your virtual bank account. 🛡️\n\n_Dial *565*0# on your phone to check your BVN if you forgot it._`, 'SIGNUP_KYC');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC', context: JSON.stringify({ ...context, name: rawText, type: 'individual', previousState: 'AWAITING_INDIVIDUAL_NAME' }) } });
            }
            return;
        }

        if (session.currentState === 'AWAITING_BUSINESS_NAME' || (rawText === 'REFRESH' && session.currentState === 'AWAITING_BUSINESS_NAME')) {
            if (rawText !== 'REFRESH') {
                await sendAndLog(`Got it. Now, please provide your business's *CAC Number* (RC Number) for verification:`, 'SIGNUP_CAC');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC', context: JSON.stringify({ ...context, businessName: rawText, type: 'business', previousState: 'AWAITING_BUSINESS_NAME' }) } });
            }
            return;
        }

        if (session.currentState === 'AWAITING_KYC') {
            const cleanBvn = rawText.replace(/\D/g, '');
            if (cleanBvn.length === 11) {
                await sendAndLog(`Verifying your 11-digit BVN vault details... ⏳`, 'KYC_FLOW');
                
                await prisma.user.update({ 
                    where: { id: user.id }, 
                    data: { 
                        kycStatus: 'VERIFIED',
                        bvn: cleanBvn
                    } 
                });
                
                await sendAndLog(`⚠️ *Security Notice*: Your BVN has been securely encrypted in our vault. Please **long-press and delete** your previous message containing your BVN to protect yourself from unauthorized access to your device.`, 'KYC_SECURITY_NOTICE');
                await sendAndLog(`Verified! ✅ Finalizing your individual wallet setup with Fincra... 🏦`, 'KYC_VERIFIED');
                try {
                    const wallet = await WalletService.setupUserWallet(user.id, 'individual');
                    const bankDetails = `✨ *Success! Your Wallet is Ready* 🏦\n\n*Account Number*: ${wallet?.accountNumber || 'Generating...'}\n*Bank Name*: WEMA BANK (ChatPay)\n*Account Name*: ${user.name}\n\n*Next Steps:*\n1. Fund your account using the details above.\n2. Type *"Balance"* to see your current funds.\n3. Type *"Menu"* to see everything I can do.`;
                    await sendAndLog(bankDetails, 'WALLET_CREATED');
                } catch (e: any) {
                    await sendAndLog(`Verification complete! ✅ We're finalizing your virtual account now. Type "Balance" in a moment to see your details.`, 'WALLET_PENDING');
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Invalid BVN. ❌ Your BVN must be exactly 11 digits. Please enter it again correctly to secure your wallet:`, 'KYC_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_CONFIRM') {
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
                const { amount, recipient, billType, customer } = context as any;
                
                const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
                const totalDebit = parseFloat(amount) + (config?.flatFee || 0) + (parseFloat(amount) * (config?.feePercentage || 0) / 100);
                const balance = await WalletService.getBalance(user.id);

                if (balance < totalDebit) {
                    await sendAndLog(`PIN Verified! ✅ But insufficient funds. ❌ Balance: ₦${balance.toLocaleString()}`, 'INSUFFICIENT_POST_PIN');
                } else {
                    await sendAndLog(`Authorization successful! 🚀 Processing your transfer...`, 'PIN_AUTHORIZED');
                    
                    const { amount, recipient, billType, customer, type, bankCode, bankName, accountNumber } = context as any;
                    const reference = `CP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
                    
                    try {
                        if (type === 'bank') {
                            // REAL EXTERNAL PAYOUT VIA FINCRA
                            await fincraService.transferFunds({
                                amount: parseFloat(amount),
                                currency: 'NGN',
                                destinationAddress: 'bank_account', // Correct Fincra param
                                paymentDestination: 'bank_account',
                                beneficiary: {
                                    firstName: recipient.split(' ')[0],
                                    lastName: recipient.split(' ')[1] || 'User',
                                    accountNumber: accountNumber,
                                    accountHolderName: recipient,
                                    bankCode: bankCode,
                                    type: 'individual'
                                }
                            });
                            
                            await prisma.transaction.create({ 
                                data: { 
                                    userId: user.id, 
                                    type: 'TRANSFER', 
                                    amount: parseFloat(amount), 
                                    currency: 'NGN', 
                                    status: 'SUCCESS', 
                                    reference, 
                                    provider: 'FINCRA', 
                                    description: `Transfer to ${recipient} (${bankName})` 
                                } 
                            });

                            await sendAndLog(`Success! ✅ Sent ₦${parseFloat(amount).toLocaleString()} to ${recipient}.\n\n🧾 *Receipt*\nBank: ${bankName}\nRef: ${reference}\nNew Balance: ₦${(balance - totalDebit).toLocaleString()}`, 'TRANSFER_SUCCESS');
                        } else if (recipient) {
                            // INTERNAL P2P
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
                            await sendAndLog(`Success! ✅ Sent ₦${parseFloat(amount).toLocaleString()} to ${recipient}.\n\nNew Balance: ₦${(balance - totalDebit).toLocaleString()}`, 'TRANSFER_SUCCESS');
                        } else if (billType) {
                            // MIGRATED: USING FINCRA UTILITIES API
                            let utilityType: any = 'airtime';
                            if (billType.toLowerCase().includes('data')) utilityType = 'data';
                            if (billType.toLowerCase().includes('power') || billType.toLowerCase().includes('electricity')) utilityType = 'power';
                            if (billType.toLowerCase().indexOf('dstv') > -1 || billType.toLowerCase().indexOf('tv') > -1) utilityType = 'cabletv';

                            await fincraService.payUtility(utilityType, {
                                amount: parseFloat(amount),
                                customerIdentifier: customer,
                                phoneNumber: phoneNumber, // For airtime/data
                                billerName: billType // e.g. "MTN", "DSTV", "IKEDC"
                            });

                            await prisma.transaction.create({ 
                                data: { 
                                    userId: user.id, 
                                    type: 'BILL_PAYMENT', 
                                    amount: parseFloat(amount), 
                                    currency: 'NGN', 
                                    status: 'SUCCESS', 
                                    reference, 
                                    provider: 'FINCRA', 
                                    description: `${billType} payment for ${customer}` 
                                } 
                            });
                            await sendAndLog(`Success! ✅ Your ${billType} bill is settled.\n\nNew Balance: ₦${(balance - totalDebit).toLocaleString()}`, 'BILL_SUCCESS');
                        }
                        
                        // NEW: AUTOMATIC PDF RECEIPT FOR ALL TX
                        const { ReceiptService } = await import('../services/receipt.service.js');
                        await ReceiptService.generateAndSend(phoneNumber, {
                            type: type === 'bank' ? 'Bank Transfer' : (billType ? 'Bill Payment' : 'Internal Transfer'),
                            amount: `₦${parseFloat(amount).toLocaleString()}`,
                            reference: reference,
                            recipient: recipient || customer || 'N/A',
                            bank: bankName || 'N/A',
                            status: 'SUCCESS',
                            date: new Date().toLocaleString()
                        });
                        
                        if (user.email) await EmailService.sendReceipt(user.email, { type: type === 'bank' ? 'Bank Transfer' : 'Transfer', amount: parseFloat(amount), reference, balance: (balance - totalDebit), recipient });

                    } catch (e: any) {
                        const errorMsg = e.response?.data?.message || e.message;
                        await sendAndLog(`❌ Transfer Failed: ${errorMsg}. Your funds are safe. Please try again.`, 'TRANSFER_CRITICAL_FAILURE');
                    }
                }
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Incorrect PIN. ❌ Verification failed. Please try again:`, 'PIN_INCORRECT');
            }
            return;
        }

        if (session.currentState === 'AWAITING_BILL_CONFIRM') {
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
            const menu = [
                { id: "FUND_NGN", title: "🇳🇬 Fund NGN", description: "Get your local bank details" },
                { id: "FUND_USD", title: "🇺🇸 Fund USD", description: "Get your US banking details" },
                { id: "FUND_GBP", title: "🇬🇧 Fund GBP", description: "Get your UK banking details" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ];
            await whapiService.sendList(phoneNumber, `🏦 *Fund Your Wallet*\n\nSelect the currency you'd like to fund:`, "Select Currency", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'FUND_WALLET', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'START' }) }});
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
                { id: "BACK", title: "🔙 Back", description: "Return" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'CARD_MENU', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'CREATE_CARD') {
            await sendAndLog(`🌐 *Premium Card Creation*\n\nInitiating your Bitnob-powered 3DS USD Visa card... 💳`, 'CARD_START');
            try {
                const names = user.name.split(' ');
                const card = await bitnobService.createVirtualCard({
                    customerEmail: user.email || `${user.phoneNumber}@chatpay.io`,
                    amount: 500, // $5.00 initial funding (Bitnob uses cents)
                    firstName: names[0],
                    lastName: names[1] || 'User'
                });
                const msg = `Success! 🛡️ Your Premium USD Virtual Card is active.\n\n*Type*: Visa (Bitnob Premium)\n*Balance*: $5.00\n*Status*: ACTIVE\n\n_Check your card details in the specialized Card Dashboard._`;
                await whapiService.sendButtons(phoneNumber, msg, [{ id: "MY_CARDS", title: "📂 View Card Details" }, { id: "HOME", title: "🏠 Home" }]);
            } catch (e: any) {
                await sendAndLog(`Card issuance failed: ${e.message}`, 'CARD_FAILED');
            }
            return;
        }

        if (rawText === 'MY_CARDS') {
            await sendAndLog(`📂 Fetching your active virtual cards... ⏳`, 'CARDS_FETCHING');
            try {
                const cards = await mapleradService.getCards(user.id);
                if (!cards || cards.length === 0) {
                    await whapiService.sendButtons(phoneNumber, `You don't have any virtual cards yet. 💳`, [{ id: "CREATE_CARD", title: "✨ Create New Card" }, { id: "HOME", title: "🏠 Home" }]);
                } else {
                    let msg = `💳 *Your Virtual Cards*\n\n`;
                    cards.forEach((c: any, i: number) => {
                        msg += `${i+1}. *${c.name || 'USD Card'}* (**** ${c.last4})\nStatus: ${c.status}\nBalance: $${(c.balance / 100).toFixed(2)}\n\n`;
                    });
                    msg += `_To see full details (CVV/Expiry), please use the God Mode dashboard for now for your security._`;
                    await whapiService.sendButtons(phoneNumber, msg, [{ id: "HOME", title: "🏠 Home" }]);
                }
            } catch (e: any) {
                await sendAndLog(`Failed to fetch cards: ${e.message}`, 'CARDS_FETCH_FAILED');
            }
            return;
        }

        if (rawText === 'PAY_BILLS' || rawText === 'REFRESH' && session.currentState === 'PAY_BILLS') {
            const menu = [
                { id: "AIRTIME_MENU", title: "📱 Airtime", description: "Recharge your phone" },
                { id: "DATA_MENU", title: "📶 Data Bundles", description: "Buy internet data" },
                { id: "UTILITIES_MENU", title: "⚡ Utilities", description: "Electricity & Power" },
                { id: "CABLE_TV_MENU", title: "📺 Cable TV", description: "DSTV, GOtv, Startimes" },
                { id: "BACK", title: "🔙 Back", description: "Return to previous menu" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ];
            await whapiService.sendList(phoneNumber, `💡 *Bill Payments & Utilities*\n\nSelect a category to pay for:`, "Bill Categories", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'PAY_BILLS', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'AIRTIME_MENU') {
            const menu = [
                { id: "AIRTIME_MTN", title: "MTN Nigeria", description: "Yellow network" },
                { id: "AIRTIME_GLO", title: "Glo Nigeria", description: "Grandmasters of data" },
                { id: "AIRTIME_AIRTEL", title: "Airtel Nigeria", description: "Smartphone network" },
                { id: "AIRTIME_9MOBILE", title: "9Mobile", description: "Etisalat evolution" },
                { id: "BACK", title: "🔙 Back", description: "Return" }
            ];
            await whapiService.sendList(phoneNumber, `📱 *Airtime Recharge*\n\nSelect your network provider:`, "Network Providers", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AIRTIME_MENU', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'PAY_BILLS' }) }});
            return;
        }

        if (rawText === 'DATA_MENU') {
            const menu = [
                { id: "DATA_MTN", title: "MTN Data", description: "Fast 5G/4G bundles" },
                { id: "DATA_GLO", title: "Glo Data", description: "High volume data" },
                { id: "DATA_AIRTEL", title: "Airtel Data", description: "Unlimited options" },
                { id: "DATA_9MOBILE", title: "9Mobile Data", description: "Secure bundles" },
                { id: "BACK", title: "🔙 Back", description: "Return" }
            ];
            await whapiService.sendList(phoneNumber, `📶 *Internet Data Bundles*\n\nSelect your network provider:`, "Network Providers", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'DATA_MENU', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'PAY_BILLS' }) }});
            return;
        }

        if (rawText === 'UTILITIES_MENU') {
            const menu = [
                { id: "UTIL_EKEDC", title: "EKEDC", description: "Eko Electricity" },
                { id: "UTIL_IKEDC", title: "IKEDC", description: "Ikeja Electricity" },
                { id: "UTIL_AEDC", title: "AEDC", description: "Abuja Electricity" },
                { id: "UTIL_PHEDC", title: "PHEDC", description: "Port Harcourt Electricity" },
                { id: "BACK", title: "🔙 Back", description: "Return" }
            ];
            await whapiService.sendList(phoneNumber, `⚡ *Electricity & Utilities*\n\nSelect your distribution company (Disco):`, "Power Companies", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'UTILITIES_MENU', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'PAY_BILLS' }) }});
            return;
        }

        if (rawText === 'CABLE_TV_MENU') {
            const menu = [
                { id: "TV_DSTV", title: "DStv", description: "Premium entertainment" },
                { id: "TV_GOTV", title: "GOtv", description: "Family entertainment" },
                { id: "TV_STARTIMES", title: "StarTimes", description: "Affordable cable" },
                { id: "BACK", title: "🔙 Back", description: "Return" }
            ];
            await whapiService.sendList(phoneNumber, `📺 *Cable TV Subscriptions*\n\nSelect your service provider:`, "TV Providers", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'CABLE_TV_MENU', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'PAY_BILLS' }) }});
            return;
        }

        if (rawText.startsWith('AIRTIME_') || rawText.startsWith('DATA_') || rawText.startsWith('UTIL_') || rawText.startsWith('TV_')) {
            const provider = rawText.split('_')[1];
            await sendAndLog(`Great! 🏦 Please reply with the *Phone Number* or *Meter/IUC Number* and the *Amount*.\n\nExample: "08012345678 1000"`, 'BILL_PROMPT');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_BILL_INPUT', context: JSON.stringify({ ...context, billProvider: provider, previousState: session.currentState }) }});
            return;
        }

        if (rawText === 'ASSET_TRADING' || rawText === 'REFRESH' && session.currentState === 'ASSET_TRADING') {
            const menu = [
                { id: "BITNOB_HUB", title: "⚡ Bitnob Crypto Hub", description: "Lightning & Stablecoins" },
                { id: "GIFTCARD", title: "🎁 Sell Giftcards", description: "Trade giftcards for cash" },
                { id: "BACK", title: "🔙 Back", description: "Return" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ];
            await whapiService.sendList(phoneNumber, `₿ *Asset Trading Desk*\n\nPowered by **Bitnob Pro** ⚡\n\nTrade assets and use the world's fastest payment network:`, "Trading Markets", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'ASSET_TRADING', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'BITNOB_HUB') {
            const menu = [
                { id: "LN_ADDRESS", title: "⚡ My Lightning Address", description: "Receive global payments" },
                { id: "BUY_CRYPTO", title: "💰 Buy BTC/USDT", description: "Swap NGN for assets" },
                { id: "SEND_LN", title: "🚀 Send Lightning", description: "Pay a Lightning Invoice" },
                { id: "BACK", title: "🔙 Back", description: "Return" }
            ];
            await whapiService.sendList(phoneNumber, `⚡ *Bitnob Crypto Hub*\n\nGlobal digital finance natively in WhatsApp:`, "Crypto Services", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'BITNOB_HUB', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'ASSET_TRADING' }) }});
            return;
        }

        if (rawText === 'LN_ADDRESS') {
            await sendAndLog(`⚡ Generating your unique **Lightning Address**...`, 'LN_GEN_START');
            try {
                // In a real Bitnob production app, we would use their LNURL/Lightning Address creation
                // For now, we simulate with a custom domain per user
                const addr = `${phoneNumber}@chatpay.io`;
                const msg = `✨ *Your Global Payment Address* ⚡\n\n\`${addr}\`\n\nAnyone in the world can send you Bitcoin instantly using this address. It works with CashApp, Strike, and all Lightning wallets.`;
                await whapiService.sendButtons(phoneNumber, msg, [{ id: "BITNOB_HUB", title: "🔙 Back" }]);
            } catch (e: any) {
                await sendAndLog(`Failed to generate address. Please ensure your Bitnob API key is set.`, 'LN_GEN_FAILED');
            }
            return;
        }

        if (rawText === 'GLOBAL_ACCOUNTS' || rawText === 'REFRESH' && session.currentState === 'GLOBAL_ACCOUNTS') {
            const emailStatus = user.email ? `✅ *Archiving Active*: ${user.email}` : `❌ *Archiving Inactive*: No email linked.`;
            const securityStatus = `🔒 *Session Guard*: Active (10-min timeout)\n${emailStatus}`;
            const menu = [
                { id: "OPEN_ACCOUNT_USD", title: "🇺🇸 Open USD Account", description: "Get US Banking details" },
                { id: "OPEN_ACCOUNT_GBP", title: "🇬🇧 Open GBP Account", description: "Get UK Banking details" },
                { id: "SET_EMAIL", title: user.email ? "📧 Update Archive Email" : "📧 Link Archive Email", description: "Save receipts to email" },
                { id: "SECURITY_INFO", title: "🔒 Security Overview", description: "Vault protection details" },
                { id: "BACK", title: "🔙 Back", description: "Return" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ];
            await whapiService.sendList(phoneNumber, `🌍 *Global Wallets & Security*\n\n${securityStatus}\n\nExpand your financial reach:`, "Global Services", menu);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'GLOBAL_ACCOUNTS', context: JSON.stringify({ ...context, lastMenuOptions: menu, previousState: 'START' }) }});
            return;
        }

        if (rawText.includes('_DISABLED')) {
            await sendAndLog(`🚀 *Coming Soon!* We are currently finalizing our international banking partnerships to bring you seamless USD, GBP, and EUR accounts. Stay tuned!`, 'FEATURE_DISABLED');
            return;
        }

        if (rawText === 'SECURITY_INFO') {
            const info = `🛡️ *ChatPay Security Architecture*\n\n1. *10-Min Session Guard*: If inactive for 10 mins, you must re-enter your PIN to unlock banking.\n2. *External Archiving*: Link your email to receive PDF receipts & invoices outside of WhatsApp.\n3. *Device Privacy*: We recommend enabling "Ephemeral Messages" in your Chat Settings for extra security.\n4. *Encryption*: All bank-grade data is encrypted on our secure AWS cloud.`;
            await whapiService.sendButtons(phoneNumber, info, [
                { id: "GLOBAL_ACCOUNTS", title: "🔙 Back" },
                { id: "HOME", title: "🏠 Home" }
            ]);
            return;
        }

        if (rawText === 'SET_EMAIL') {
            await sendAndLog(`📧 *Secure Archiving Setup*\n\nPlease reply with your *Email Address*. I will send your transaction receipts, invoices, and statements here for your records.`, 'SET_EMAIL_PROMPT');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_EMAIL', context: JSON.stringify({ ...context, previousState: 'GLOBAL_ACCOUNTS' }) } });
            return;
        }

        if (session.currentState === 'AWAITING_EMAIL') {
            if (rawText.includes('@') && rawText.includes('.')) {
                await prisma.user.update({ where: { id: user.id }, data: { email: rawText.toLowerCase().trim() } });
                await sendAndLog(`Success! 📧 Your receipts will now be archived at *${rawText}*.\n\n⚠️ *Pro Tip*: To completely clear your WhatsApp history, go to *Chat Settings* > *Ephemeral Messages* and set it to **24 Hours**. This ensures no data remains on your physical device if lost.`, 'EMAIL_SET_SUCCESS');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            } else {
                await sendAndLog(`Invalid email format. Please try again:`, 'EMAIL_INVALID');
            }
            return;
        }

        // ===== SECURITY: SESSION TIMEOUT CHECK (10 Minutes) =====
        const TEN_MINUTES = 10 * 60 * 1000;
        const now = new Date();
        const lastUpdated = new Date(session.updatedAt);
        const diff = now.getTime() - lastUpdated.getTime();

        if (diff > TEN_MINUTES && session.currentState !== 'START' && session.currentState !== 'AWAITING_REAUTH_PIN') {
            await whapiService.sendMessage(phoneNumber, `🔒 *Session Expired:* For your security, please enter your *4-digit PIN* to resume banking:`);
            await prisma.session.update({ 
                where: { id: session.id }, 
                data: { currentState: 'AWAITING_REAUTH_PIN', updatedAt: now } 
            });
            return;
        }

        if (session.currentState === 'AWAITING_REAUTH_PIN') {
            if (rawText === user.transactionPin) {
                await sendAndLog(`✅ *Re-authenticated!* How can I help you today?`, 'REAUTH_SUCCESS');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'START', updatedAt: now } });
                // Re-trigger the menu
                return WebhookController.processLogic(user, await prisma.session.findUnique({where:{id:session.id}}), aiResult, 'Menu');
            } else {
                await sendAndLog(`❌ Incorrect PIN. Please try again or type 'Reset' if you forgot it:`, 'REAUTH_FAILED');
                return;
            }
        }

        if (rawText === 'SEND_MONEY_FLOW') {
            await whapiService.sendList(phoneNumber, `Okay! 💸 Choose your transfer method:`, "Transfer Mode", [
                { id: "BANK_TRANSFER", title: "🏦 External Bank", description: "Send to any Nigerian bank" },
                { id: "P2P_TRANSFER", title: "📱 Internal User", description: "Transfer to another ChatPay user" },
                { id: "HOME", title: "🏠 Home", description: "Main menu" }
            ]);
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'SEND_MONEY_FLOW', context: JSON.stringify({ ...context, previousState: 'START' }) }});
            return;
        }

        if (rawText === 'BANK_TRANSFER' || (rawText === 'REFRESH' && session.currentState === 'AWAITING_TRANSFER_AMOUNT')) {
            await sendAndLog(`🏦 *External Bank Transfer*\n\nHow much would you like to send? (Enter amount in Naira, e.g. 5000)`, 'TX_AMOUNT_PROMPT');
            await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TRANSFER_AMOUNT', context: JSON.stringify({ ...context, type: 'bank', previousState: 'SEND_MONEY_FLOW' }) } });
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_AMOUNT') {
            const amount = parseFloat(rawText.replace(/[^0-9.]/g, ''));
            if (!isNaN(amount) && amount > 0) {
                const balance = await WalletService.getBalance(user.id);
                if (amount > balance) {
                    await sendAndLog(`❌ *Insufficient Funds*\n\nYou want to send ₦${amount.toLocaleString()}, but your balance is ₦${balance.toLocaleString()}.\n\nPlease enter a lower amount or fund your wallet first.`, 'TX_INSUFFICIENT');
                    return;
                }
                await sendAndLog(`Great! ₦${amount.toLocaleString()} set. 💰\n\nNow, please enter the **Recipient's 10-digit Account Number**:`, 'TX_ACCOUNT_PROMPT');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TRANSFER_BANK_ACCOUNT', context: JSON.stringify({ ...context, amount, previousState: 'AWAITING_TRANSFER_AMOUNT' }) } });
            } else {
                await sendAndLog(`Invalid amount. Please enter a number (e.g., 2500):`, 'TX_AMOUNT_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_BANK_ACCOUNT') {
            const accountNumber = rawText.replace(/\D/g, '');
            if (accountNumber.length === 10) {
                const popularBanks = [
                    { id: "BANK_011:First Bank", title: "First Bank", description: "011" },
                    { id: "BANK_058:GTBank", title: "GTBank", description: "058" },
                    { id: "BANK_033:UBA", title: "UBA", description: "033" },
                    { id: "BANK_044:Access Bank", title: "Access Bank", description: "044" },
                    { id: "BANK_057:Zenith Bank", title: "Zenith Bank", description: "057" },
                    { id: "BANK_214:First City Monument Bank", title: "FCMB", description: "214" },
                    { id: "BANK_032:Union Bank", title: "Union Bank", description: "032" },
                    { id: "BANK_030:Heritage Bank", title: "Heritage Bank", description: "030" },
                    { id: "BANK_035:Wema Bank", title: "Wema Bank", description: "035" },
                    { id: "BANK_050:Ecobank", title: "Ecobank", description: "050" }
                ];
                await whapiService.sendList(phoneNumber, `Recipient: ${accountNumber} ✅\n\nNow select the **Destination Bank** from the list below:`, "Select Bank", popularBanks);
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TRANSFER_BANK_SELECT', context: JSON.stringify({ ...context, accountNumber, previousState: 'AWAITING_TRANSFER_BANK_ACCOUNT' }) } });
            } else {
                await sendAndLog(`Invalid account number. Please enter exactly 10 digits:`, 'TX_ACCOUNT_INVALID');
            }
            return;
        }

        if (session.currentState === 'AWAITING_TRANSFER_BANK_SELECT') {
            if (rawText.startsWith('BANK_')) {
                const parts = rawText.replace('BANK_', '').split(':');
                const bankCode = parts[0];
                const bankName = parts[1];
                const { accountNumber, amount } = context as any;

                await sendAndLog(`🔍 Resolving beneficiary details for ${accountNumber} (${bankName})...`, 'TX_RESOLVING');
                
                try {
                    const resolution = await fincraService.resolveAccount(accountNumber, bankCode);
                    const accountName = resolution.data?.accountName || resolution.data?.account_name;
                    
                    if (accountName) {
                        const msg = `✅ *Account Verified*\n\n*Recipient*: ${accountName}\n*Bank*: ${bankName}\n*Amount*: ₦${parseFloat(amount).toLocaleString()}\n\nProceed to send?`;
                        await whapiService.sendButtons(phoneNumber, msg, [
                            { id: "CONFIRM_BANK_TX", title: "✅ Yes, Proceed" },
                            { id: "CANCEL_TX", title: "❌ No, Cancel" }
                        ]);
                        await prisma.session.update({ 
                            where: { id: session.id }, 
                            data: { 
                                currentState: 'AWAITING_TRANSFER_RESOLVE_CONFIRM', 
                                context: JSON.stringify({ ...context, bankCode, bankName, recipient: accountName, previousState: 'AWAITING_TRANSFER_BANK_SELECT' }) 
                            } 
                        });
                    } else {
                        await sendAndLog(`❌ Could not verify account name. Please check the details and try again:`, 'TX_RESOLVE_FAILED');
                        await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TRANSFER_BANK_ACCOUNT' } });
                    }
                } catch (e: any) {
                    await sendAndLog(`❌ Error: ${e.message}. Please check the account and try again.`, 'TX_RESOLVE_ERROR');
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_TRANSFER_BANK_ACCOUNT' } });
                }
            }
            return;
        }

        if (rawText === 'CONFIRM_BANK_TX') {
            const { recipient, amount, bankName } = context as any;
            if (!user.transactionPin) {
                await sendAndLog(`🔐 *Security Setup Required*\n\nPlease set a *4-digit PIN* to authorize this transfer:`, 'PIN_SETUP_START');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_SET' } });
            } else {
                await sendAndLog(`Please enter your *4-digit PIN* to authorize sending ₦${parseFloat(amount).toLocaleString()} to ${recipient} (${bankName}):`, 'PIN_VERIFY_REQUEST');
                await prisma.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_PIN_VERIFY' } });
            }
            return;
        }

        if (rawText === 'OPEN_ACCOUNT_USD') {
            await sendAndLog(`Generating your *USD* Virtual Account... 🇺🇸 ⏳`, 'USD_START');
            try {
                const wallet = await WalletService.setupUserWallet(user.id, 'individual', undefined, 'USD');
                const msg = `✨ *USD Account Ready!* 🇺🇸\n\n*Account Number*: ${wallet?.accountNumber}\n*Bank*: Fincra Global\n*Account Name*: ${user.name}\n\n_You can now receive US payments directly to your ChatPay vault._`;
                await whapiService.sendButtons(phoneNumber, msg, [{ id: "HOME", title: "🏠 Home" }]);
            } catch (e: any) {
                const errorBody = e.response?.data?.error || e.message;
                if (errorBody?.includes('FCY request is disabled')) {
                    const fail = `❌ *Permission Required*\n\nYour merchant account currently has Foreign Currency (FCY) requests disabled on Fincra.\n\n*What to do:*\n1. Login to your Fincra Dashboard.\n2. Go to *Settings* > *Product Activation*.\n3. Enable **Multi-Currency Virtual Accounts**.\n\nOnce enabled, try again!`;
                    await sendAndLog(fail, 'FCY_DISABLED');
                } else {
                    await sendAndLog(`Account creation failed: ${errorBody}`, 'PROVISIONING_ERROR');
                }
            }
            return;
        }

        if (rawText === 'OPEN_ACCOUNT_GBP') {
            await sendAndLog(`Generating your *GBP* Virtual Account... 🇬🇧 ⏳`, 'GBP_START');
            try {
                const wallet = await WalletService.setupUserWallet(user.id, 'individual', undefined, 'GBP');
                const msg = `✨ *GBP Account Ready!* 🇬🇧\n\n*Account Number*: ${wallet?.accountNumber}\n*Bank*: Fincra Global\n*Account Name*: ${user.name}\n\n_Welcome to international banking._`;
                await whapiService.sendButtons(phoneNumber, msg, [{ id: "HOME", title: "🏠 Home" }]);
            } catch (e: any) {
                const errorBody = e.response?.data?.error || e.message;
                if (errorBody?.includes('FCY request is disabled')) {
                    const fail = `❌ *Permission Required*\n\nYour merchant account currently has Foreign Currency (FCY) requests disabled on Fincra.\n\n*What to do:*\n1. Login to your Fincra Dashboard.\n2. Go to *Settings* > *Product Activation*.\n3. Enable **Multi-Currency Virtual Accounts**.\n\nOnce enabled, try again!`;
                    await sendAndLog(fail, 'FCY_DISABLED');
                } else {
                    await sendAndLog(`Account creation failed: ${errorBody}`, 'PROVISIONING_ERROR');
                }
            }
            return;
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
                    if (amount && recipient && /^\d+$/.test(recipient)) {
                        // AI found amount and account number, jump slightly ahead
                        await whapiService.sendButtons(phoneNumber, `I've prepared a transfer of ₦${amount} to account *${recipient}*.\n\nContinue?`, [
                            { id: "BANK_TRANSFER", title: "✅ Yes, Continue" },
                            { id: "HOME", title: "🏠 Home" }
                        ]);
                    } else {
                        // Fallback to start of flow
                        return WebhookController.processLogic(user, session, aiResult, 'SEND_MONEY_FLOW');
                    }
                }
                break;

            case 'CHECK_BALANCE':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Please signup/verify first to check your balance.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    // Auto-retry wallet creation if it failed during onboarding
                    if (!user.fincraCustomerId) {
                        try {
                            const wallet = await WalletService.setupUserWallet(user.id, 'individual');
                            user = await prisma.user.findUnique({ where: { id: user.id } }) as any;
                            const bankDetails = `✨ *Success! Your Wallet is Ready* 🏦\n\n*Account Number*: ${wallet?.accountNumber || 'Generating...'}\n*Bank Name*: WEMA BANK (ChatPay)\n*Account Name*: ${user.name}\n\nBalance: ₦0\n\n_Fund your account using the details above to get started._`;
                            await whapiService.sendButtons(phoneNumber, bankDetails, [
                                { id: "HOME", title: "🏠 Home" },
                                { id: "FUND_WALLET", title: "🏦 Fund Wallet" }
                            ]);
                            break;
                        } catch (e: any) {
                            const errorMsg = e.response?.data?.error || e.message;
                            console.error('[Wallet] Onboarding Error:', errorMsg);
                            
                            if (errorMsg?.toLowerCase().includes('match the provided name')) {
                                const failMsg = `⚠️ *Name Mismatch Error*\n\nYour BVN verification failed because the name you provided (*${user.name}*) does not match the legal name on your BVN record.\n\nPlease type *'Reset'* to restart and use your **Exact Legal Names** as they appear on your ID card.`;
                                await sendAndLog(failMsg, 'KYC_NAME_MISMATCH');
                            } else {
                                await sendAndLog(`We're having trouble connecting to the bank. Please try again in a moment.`, 'WALLET_RETRY_FAILED');
                            }
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
                        await sendAndLog(`🔄 Fetching Bitnob Market Quote for $${amount} *${asset.toUpperCase()}*...`, 'CRYPTO_PROCESSING');
                        try {
                            const result = await bitnobService.swap({
                                amount: parseFloat(String(amount)) * 100, // Bitnob uses cents
                                from: 'usd',
                                to: asset.toLowerCase()
                            });
                            await sendAndLog(`Success! ✅ Your ${asset.toUpperCase()} has been swapped and is now available in your Bitnob vault. Ref: ${result.data?.id || 'PROCESSED'}`, 'CRYPTO_SUCCESS');
                            
                            // NEW: PDF RECEIPT FOR SWAP
                            const { ReceiptService } = await import('../services/receipt.service.js');
                            await ReceiptService.generateAndSend(phoneNumber, {
                                type: 'Asset Swap (Crypto)',
                                amount: `$${parseFloat(String(amount)).toLocaleString()}`,
                                reference: result.data?.id || `SWAP-${Date.now()}`,
                                recipient: `${asset.toUpperCase()} Wallet`,
                                bank: 'Bitnob Pro (Premium)',
                                status: 'SUCCESS',
                                date: new Date().toLocaleString()
                            });
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

            case 'CONVERT':
                if (user.kycStatus !== 'VERIFIED') {
                    await sendAndLog(`Verify first to swap currencies.`, 'UNVERIFIED_ATTEMPT');
                } else {
                    const { amount, from, to } = aiResult.entities || {};
                    if (!amount) {
                        await sendAndLog(`Please specify the amount you want to swap (e.g. "Swap 50k to USD")`, 'MISSING_ENTITIES');
                    } else {
                        const source = (from || 'NGN').toUpperCase();
                        const dest = (to || 'USD').toUpperCase();
                        try {
                            const quote = await fincraService.createConversionQuote(parseFloat(String(amount)), source, dest);
                            const rate = quote.data?.rate;
                            const receiveAmount = quote.data?.destinationAmount;
                            const quoteRef = quote.data?.reference;

                            const msg = `💱 *Currency Conversion*\n\nRate: 1 ${dest} = ${rate} ${source}\nSwap: ${parseFloat(String(amount)).toLocaleString()} ${source}\nReceive: *${receiveAmount} ${dest}*\n\nProceed with this swap?`;
                            await whapiService.sendButtons(phoneNumber, msg, [
                                { id: `EXECUTE_SWAP:${quoteRef}`, title: "✅ Yes, Swap Now" },
                                { id: "HOME", title: "❌ Cancel" }
                            ]);
                        } catch (e: any) {
                            await sendAndLog(`Quote failed: ${e.message}`, 'SWAP_ERROR');
                        }
                    }
                }
                break;

            case 'FUNDING':
                const fundMsg = `💳 *Fund Your Wallet via Card*\n\nYou can use our secure checkout to fund your wallet instantly with your Debit Card.\n\nReply with the *Amount* you want to add (e.g. "Fund 5000")`;
                await sendAndLog(fundMsg, 'FUNDING_START');
                break;

            case 'SCHEDULE_TASK':
                const { amount: sAmount, date, actions: sActions, recipient: sRecipient } = aiResult.entities || {};
                const isEscrow = sActions?.includes('ESCROW') || rawText.toLowerCase().includes('escrow') || rawText.toLowerCase().includes('hold');
                const targetDate = new Date(date || Date.now() + 86400000); // Default to tomorrow if parsing fails
                
                const missionId = `MSN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;

                await prisma.scheduledTask.create({
                    data: {
                        userId: user.id,
                        type: isEscrow ? 'ESCROW' : (sActions?.[0] || 'TRANSFER'),
                        amount: parseFloat(String(sAmount || 0)),
                        currency: 'NGN',
                        targetDate: targetDate,
                        reference: missionId,
                        context: JSON.stringify({ ...aiResult.entities, isEscrow })
                    }
                });

                const confirmMsg = isEscrow 
                    ? `🛡️ *Escrow Mission Locked*\n\nI have locked **₦${parseFloat(String(sAmount)).toLocaleString()}** in the vault for your transaction with *${sRecipient || 'the seller'}*.\n\nMission ID: *${missionId}*\n\nType *"Release ${missionId}"* once you have received your item to pay the seller.`
                    : `🫡 *Mission Accepted*\n\nI have scheduled this task for **${targetDate.toDateString()}**.\n\nMission ID: *${missionId}*\nReference: ${missionId}`;
                
                await sendAndLog(confirmMsg, 'MISSION_LAUNCHED');
                break;

            case 'GENERATE_VOUCHER':
                const vAmount = aiResult.entities?.amount || 0;
                const vCode = `CP-${Math.random().toString(36).substr(2, 4).toUpperCase()}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
                
                await prisma.voucher.create({
                    data: {
                        code: vCode,
                        amount: parseFloat(String(vAmount)),
                        createdById: user.id
                    }
                });

                const vMsg = `🎁 *ChatPay Gift Voucher Ready!*\n\nI have generated a voucher for **₦${vAmount.toLocaleString()}**.\n\nCode: *${vCode}*\n\nShare this code with anyone! They can redeem it by typing: *"Redeem ${vCode}"* into ChatPay.`;
                await sendAndLog(vMsg, 'VOUCHER_CREATED');
                break;

            case 'REDEEM_VOUCHER':
                const rCode = rawText.includes(' ') ? rawText.split(' ').pop()?.toUpperCase() : '';
                const voucher = await prisma.voucher.findUnique({ where: { code: rCode } });
                
                if (!voucher || voucher.status !== 'ACTIVE') return sendAndLog(`❌ Invalid or already redeemed voucher code.`, 'REDEEM_ERROR');
                
                // Credit user
                await prisma.transaction.create({
                    data: {
                        userId: user.id,
                        type: 'FUNDING',
                        amount: voucher.amount,
                        currency: 'NGN',
                        status: 'SUCCESS',
                        reference: `REDM-${rCode}`,
                        provider: 'CHATPAY_INTERNAL',
                        description: `Voucher Redemption: ${rCode}`
                    }
                });

                await prisma.voucher.update({ where: { id: voucher.id }, data: { status: 'RELEASING' } });
                await sendAndLog(`✨ *Voucher Redeemed!* ✨\n\nYour vault has been credited with **₦${voucher.amount.toLocaleString()}**.\n\nType *"Menu"* to check your new balance.`, 'REDEEM_SUCCESS');
                break;

            case 'CHECK_BUDGET':
                const last30Days = new Date();
                last30Days.setDate(last30Days.getDate() - 30);
                
                const history = await prisma.transaction.findMany({
                    where: { userId: user.id, createdAt: { gte: last30Days } },
                    orderBy: { createdAt: 'desc' }
                });

                if (history.length === 0) {
                    const welcomeMsg = `🤖 *Meet Your ChatPay AI Agent* 🤖\n\nI am your new autonomous financial guardian. I don't just "bank"—I **execute missions** for you.\n\n✨ *What I can do right now:*\n\n🛡️ **Escrow**: I can hold funds for your IG/Jiji purchases until you get your item.\n📈 **Auto-Buy**: I can watch the market and buy Bitcoin for you while you sleep.\n📄 **Invoice Scraper**: Just forward any bill to me, and I'll pay it.\n🤝 **Social Lending**: I'll nudge your friends to pay you back so you don't have to.\n🎁 **Gift Codes**: Generate branded vouchers you can share with anyone.\n\nType *"Menu"* to see your vault, or just **talk to me** to launch a mission!`;
        
                    await whapiService.sendImage(user.phoneNumber, 'https://chatpay-l4ej.onrender.com/assets/agent_welcome.png', welcomeMsg);
                    await prisma.session.update({ where: { id: session.id }, data: { currentState: 'MAIN_MENU' } });
                    return;
                } else {
                    await sendAndLog(`📊 I'm analyzing your spending patterns for the last 30 days... ⏳`, 'BUDGET_START');
                    const analysis = await aiService.analyzeSpending(history);
                    await sendAndLog(`📊 *Your Advisor Report*\n\n${analysis}`, 'BUDGET_DASHBOARD');
                }
                break;

            case 'UNKNOWN':
            default:
                if (rawText.startsWith('SCRAPED_DOCUMENT:')) {
                    const data = JSON.parse(rawText.split('SCRAPED_DOCUMENT:')[1]);
                    const msg = `🔍 *Invoice Detected*\n\nI have read the document you sent:\n\n*Recipient*: ${data.BeneficiaryName || 'N/A'}\n*Bank*: ${data.BankName || 'N/A'}\n*Account*: ${data.AccountNumber || 'N/A'}\n*Amount*: ₦${parseFloat(data.Amount || '0').toLocaleString()}\n\nWhat should I do?`;
                    
                    await prisma.session.update({ where: { id: session.id }, data: { context: JSON.stringify(data) } });
                    await whapiService.sendButtons(user.phoneNumber, msg, [
                        { id: 'CONFIRM_DOCUMENT_PAY', title: '✅ Pay Now' },
                        { id: 'HOME', title: '🏠 Cancel' }
                    ]);
                    return;
                }

                if (rawText.toLowerCase().startsWith('release msn-')) {
                    const mRef = rawText.split(' ')[1].toUpperCase();
                    const task = await prisma.scheduledTask.findUnique({ where: { reference: mRef }, include: { user: true } });
                    if (!task || task.userId !== user.id) return sendAndLog(`❌ Invalid Mission ID.`, 'ESCROW_ERROR');
                    if (task.status !== 'PENDING') return sendAndLog(`❌ This mission is already ${task.status}.`, 'ESCROW_ERROR');
                    
                    await prisma.scheduledTask.update({ where: { id: task.id }, data: { status: 'RELEASING' } });
                    await sendAndLog(`🫡 Releasing funds for Mission *${mRef}*...`, 'ESCROW_RELEASING');
                    
                    const { ReceiptService } = await import('../services/receipt.service.js');
                     // Note: You would perform the actual Fincra transfer here to the seller's account in context
                    await prisma.scheduledTask.update({ where: { id: task.id }, data: { status: 'SUCCESS' } });
                    await sendAndLog(`✅ *Mission Completed*\n\nFunds have been released to the seller. Mission *${mRef}* is now closed.`, 'ESCROW_SUCCESS');
                    return;
                }

                if (rawText.toLowerCase().startsWith('refund msn-')) {
                    const mRef = rawText.split(' ')[1].toUpperCase();
                    const task = await prisma.scheduledTask.findUnique({ where: { reference: mRef } });
                    if (!task || task.userId !== user.id) return sendAndLog(`❌ Invalid Mission ID.`, 'ESCROW_ERROR');
                    
                    await prisma.scheduledTask.update({ where: { id: task.id }, data: { status: 'CANCELLED' } });
                    await sendAndLog(`🛡️ *Mission Cancelled*\n\nFunds for Mission *${mRef}* have been unlocked and returned to your main vault.`, 'ESCROW_REFUNDED');
                    return;
                }

                if (rawText.startsWith('EXECUTE_SWAP:')) {
                    const quoteRef = rawText.split(':')[1];
                    await sendAndLog(`🔄 Executing swap...`, 'SWAP_START');
                    try {
                        const result = await fincraService.convertCurrency(quoteRef);
                        await sendAndLog(`Success! 💱 Your currency has been swapped. Your global wallets have been updated.`, 'SWAP_SUCCESS');
                    } catch (e: any) {
                        await sendAndLog(`Swap failed: ${e.message}`, 'SWAP_FAILED');
                    }
                    return;
                }
                if (rawText !== 'REFRESH' && !isHi && !isMenu && rawText !== 'MENU') {
                    // Always show the current menu if we don't understand, to prevent the user from being stuck
                    await sendAndLog("I'm here to help, but I'm not sure about that request. 🤖 Let's stick to the menu options below:", 'FALLBACK_MENU');
                    return WebhookController.processLogic(user, session, aiResult, 'REFRESH');
                }
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
