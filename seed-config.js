const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  // Save token to DB
  const result = await p.systemConfig.upsert({
    where: { id: 'global' },
    create: {
      id: 'global',
      whapiToken: 'DC6bhz6a8djbAAt7uGEv2JtNxCpNGeZg',
      whapiApiUrl: 'https://gate.whapi.cloud',
      whapiWebhookUrl: 'https://chatpay-l4ej.onrender.com/webhook/whatsapp'
    },
    update: {
      whapiToken: 'DC6bhz6a8djbAAt7uGEv2JtNxCpNGeZg',
      whapiApiUrl: 'https://gate.whapi.cloud',
      whapiWebhookUrl: 'https://chatpay-l4ej.onrender.com/webhook/whatsapp'
    }
  });
  console.log('Token saved:', result.id);
  await p.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
