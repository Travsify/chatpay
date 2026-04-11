const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const logs = await prisma.webhookLog.findMany({
        where: { direction: 'INBOUND' },
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    
    console.log(JSON.stringify(logs, null, 2));
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
