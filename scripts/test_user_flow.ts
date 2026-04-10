import axios from 'axios';

const API_URL = 'http://localhost:3000/webhook/whatsapp';
const TEST_NUMBER = '2348123456789';

async function sendWebhook(text: string) {
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
        const res = await axios.post(API_URL, payload);
        console.log(`< Response: ${res.status} ${res.statusText}`);
    } catch (e: any) {
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
