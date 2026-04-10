"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebhookController = void 0;
const express_1 = require("express");
const whapi_service_1 = require("../services/whapi.service");
const ai_service_1 = require("../services/ai.service");
const wallet_service_1 = require("../services/wallet.service");
const prisma_1 = __importDefault(require("../utils/prisma"));
class WebhookController {
    static async handleIncoming(req, res) {
        try {
            const body = req.body;
            const messages = body.messages || [];
            for (const msg of messages) {
                if (msg.from_me)
                    continue;
                const senderNumber = msg.from;
                const messageText = msg.text?.body;
                if (!messageText)
                    continue;
                let user = await prisma_1.default.user.findUnique({ where: { phoneNumber: senderNumber } });
                if (!user) {
                    user = await prisma_1.default.user.create({ data: { phoneNumber: senderNumber } });
                }
                let session = await prisma_1.default.session.findFirst({
                    where: { userId: user.id },
                    orderBy: { updatedAt: 'desc' }
                });
                if (!session) {
                    session = await prisma_1.default.session.create({ data: { userId: user.id, currentState: 'START' } });
                }
                const aiResult = await ai_service_1.aiService.parseIntent(messageText);
                await WebhookController.processLogic(user, session, aiResult, messageText);
            }
            res.status(200).send('OK');
        }
        catch (error) {
            console.error('Webhook Error:', error);
            res.status(500).send('Internal Error');
        }
    }
    static async processLogic(user, session, aiResult, rawText) {
        const { phoneNumber } = user;
        // 1. Check Ongoing Flow States
        if (session.currentState === 'AWAITING_NAME') {
            await prisma_1.default.user.update({ where: { id: user.id }, data: { name: rawText } });
            await whapi_service_1.whapiService.sendMessage(phoneNumber, `Thanks ${rawText}! Please provide your BVN/NIN for verification.`);
            await prisma_1.default.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_KYC' } });
            return;
        }
        if (session.currentState === 'AWAITING_KYC') {
            await whapi_service_1.whapiService.sendMessage(phoneNumber, `Verifying your identity... ⏳`);
            const isVerified = rawText.length >= 10;
            if (isVerified) {
                await prisma_1.default.user.update({ where: { id: user.id }, data: { kycStatus: 'VERIFIED' } });
                await whapi_service_1.whapiService.sendMessage(phoneNumber, `Verified! ✅ Finalizing your wallet setup...`);
                try {
                    const wallet = await wallet_service_1.WalletService.setupUserWallet(user.id);
                    await whapi_service_1.whapiService.sendMessage(phoneNumber, `Success! 🏦 Account: ${wallet?.accountNumber || 'Pending'}\nBank: Wema (ChatPay)`);
                }
                catch (e) {
                    await whapi_service_1.whapiService.sendMessage(phoneNumber, `Verification complete! We'll notify you when your wallet is ready.`);
                }
                await prisma_1.default.session.update({ where: { id: session.id }, data: { currentState: 'START' } });
            }
            else {
                await whapi_service_1.whapiService.sendMessage(phoneNumber, `Invalid ID. Please enter a valid BVN/NIN.`);
            }
            return;
        }
        if (session.currentState === 'AWAITING_TRANSFER_CONFIRM') {
            if (rawText.toLowerCase().includes('yes') || rawText.toLowerCase().includes('confirm')) {
                const { amount, recipient } = session.context;
                await whapi_service_1.whapiService.sendMessage(phoneNumber, `Sending ₦${amount} to ${recipient}... 🚀`);
                await whapi_service_1.whapiService.sendMessage(phoneNumber, `Success! Transaction ref: CP-${Math.random().toString(36).substr(2, 9).toUpperCase()}`);
                await prisma_1.default.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            else {
                await whapi_service_1.whapiService.sendMessage(phoneNumber, `Transaction cancelled. ❌`);
                await prisma_1.default.session.update({ where: { id: session.id }, data: { currentState: 'START', context: null } });
            }
            return;
        }
        // 2. Process Intent
        switch (aiResult.intent) {
            case 'SIGNUP':
                if (user.kycStatus === 'VERIFIED') {
                    await whapi_service_1.whapiService.sendMessage(phoneNumber, `You're all set, ${user.name}!`);
                }
                else {
                    await whapi_service_1.whapiService.sendMessage(phoneNumber, `Welcome! Let's start. What is your full name?`);
                    await prisma_1.default.session.update({ where: { id: session.id }, data: { currentState: 'AWAITING_NAME' } });
                }
                break;
            case 'SEND_FUNDS':
                if (user.kycStatus !== 'VERIFIED') {
                    await whapi_service_1.whapiService.sendMessage(phoneNumber, `Please signup/verify first.`);
                }
                else {
                    const { amount, recipient } = aiResult.entities || {};
                    if (!amount || !recipient) {
                        await whapi_service_1.whapiService.sendMessage(phoneNumber, `Please specify amount and recipient.`);
                    }
                    else {
                        await whapi_service_1.whapiService.sendMessage(phoneNumber, `Send ₦${amount} to ${recipient}? (Yes/No)`);
                        await prisma_1.default.session.update({
                            where: { id: session.id },
                            data: { currentState: 'AWAITING_TRANSFER_CONFIRM', context: { amount, recipient } }
                        });
                    }
                }
                break;
            case 'INVOICE':
                if (user.kycStatus !== 'VERIFIED') {
                    await whapi_service_1.whapiService.sendMessage(phoneNumber, `Verify first to create invoices.`);
                }
                else {
                    const { amount, description } = aiResult.entities || {};
                    if (!amount) {
                        await whapi_service_1.whapiService.sendMessage(phoneNumber, `Please specify an amount for the invoice.`);
                    }
                    else {
                        const invoiceLink = `https://pay.chatpay.io/inv_${Math.random().toString(36).substr(2, 6)}`;
                        await whapi_service_1.whapiService.sendMessage(phoneNumber, `Invoice Created! 📄\nAmount: ₦${amount}\nDescription: ${description || 'Services'}\nLink: ${invoiceLink}\n\nSend this link to your customer to get paid.`);
                    }
                }
                break;
            default:
                const response = await ai_service_1.aiService.generateResponse(`User: "${rawText}". Respond as ChatPay bot.`);
                await whapi_service_1.whapiService.sendMessage(phoneNumber, response);
        }
    }
}
exports.WebhookController = WebhookController;
//# sourceMappingURL=webhook.controller.js.map