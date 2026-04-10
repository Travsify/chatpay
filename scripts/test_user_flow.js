"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const API_URL = 'http://localhost:3000/webhook/whatsapp';
const TEST_NUMBER = '2348123456789';
async function sendWebhook(text) {
    const payload = {
        messages: [
            {
                from: TEST_NUMBER,
                text: {
                    body: text
                },
                from_me: false
            }
        ]
    };
    console.log(`\n> Sending: "${text}"`);
    try {
        const res = await axios_1.default.post(API_URL, payload);
        console.log(`< Response: ${res.status} ${res.statusText}`);
    }
    catch (e) {
        console.error(`X Error: ${e.message}`);
    }
}
async function runTest() {
    console.log("=== STARTING CHATPAY USER FLOW TEST ===");
    // 1. Signup
    await sendWebhook("Hi, I want to sign up for ChatPay");
    // 2. Name
    await new Promise(r => setTimeout(r, 1000));
    await sendWebhook("John Doe");
    // 3. KYC
    await new Promise(r => setTimeout(r, 1000));
    await sendWebhook("1234567890");
    // 4. Intent for money
    await new Promise(r => setTimeout(r, 1000));
    await sendWebhook("Send 2500 to Peter");
    // 5. Confirm
    await new Promise(r => setTimeout(r, 1000));
    await sendWebhook("Confirm Yes");
    console.log("\n=== TEST FLOW COMPLETE ===");
    console.log("Check server logs for intent details and DB updates.");
}
runTest();
//# sourceMappingURL=test_user_flow.js.map