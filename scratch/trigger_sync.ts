
import { whapiService } from '../src/services/whapi.service';
import dotenv from 'dotenv';
dotenv.config();

const webhookUrl = 'https://chatpay-l4ej.onrender.com/webhook/whatsapp';

async function run() {
    console.log("\n🚀 TRIGGERING AUTOMATIC WHAPI SYNC...");
    try {
        const result = await whapiService.registerWebhook(webhookUrl);
        console.log("✅ SYNC SUCCESSFUL!");
        console.log("Details:", JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error("❌ SYNC FAILED.");
        if (error.response) {
            console.error("Status:", error.response.status);
            console.error("Data:", JSON.stringify(error.response.data, null, 2));
        } else {
            console.error("Error:", error.message);
        }
    }
    process.exit();
}

run();
