import { whapiService } from '../src/services/whapi.service';
import prisma from '../src/utils/prisma';
import dotenv from 'dotenv';
dotenv.config();

async function sync() {
    console.log('--- WHAPI WEBHOOK SYNC TOOL ---');
    
    // 1. Get current config from DB
    const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
    
    // 2. Determine target URL
    const targetUrl = config?.whapiWebhookUrl || 'https://chatpay-l4ej.onrender.com/webhook/whatsapp';
    
    console.log(`Target Webhook URL: ${targetUrl}`);
    
    try {
        console.log('Attempting to register webhook with Whapi...');
        const result = await whapiService.registerWebhook(targetUrl);
        console.log('✅ Webhook registered successfully!');
        console.log('Response:', JSON.stringify(result, null, 2));
    } catch (error: any) {
        console.error('❌ Failed to register webhook:');
        console.error(error.response?.data || error.message);
    }
    
    process.exit(0);
}

sync().catch(err => {
    console.error(err);
    process.exit(1);
});
