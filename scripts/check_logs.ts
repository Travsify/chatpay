import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkLogs() {
    console.log('--- LATEST WEBHOOK LOGS ---');
    const logs = await prisma.webhookLog.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' }
    });
    
    if (logs.length === 0) {
        console.log('No webhooks received yet.');
    } else {
        logs.forEach(log => {
            console.log(`[${log.createdAt.toISOString()}] ${log.direction} | Status: ${log.status} | Phone: ${log.phoneNumber}`);
            if (log.errorMsg) console.log(`   ERROR: ${log.errorMsg}`);
            console.log(`   Payload: ${log.payload.substring(0, 100)}...`);
            console.log('---');
        });
    }

    console.log('\n--- LATEST CONVERSATION LOGS ---');
    const convos = await prisma.conversationLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { user: true }
    });

    convos.forEach(c => {
        console.log(`[${c.createdAt.toISOString()}] ${c.direction} | ${c.user.phoneNumber}: ${c.message}`);
    });

    process.exit(0);
}

checkLogs().catch(err => {
    console.error(err);
    process.exit(1);
});
