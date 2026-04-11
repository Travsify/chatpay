import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setToken() {
    const token = 'dpbmczIIkfqHDHq509phi7CA8w3RDK5A';
    console.log('Setting Whapi token in DB...');
    
    await prisma.systemConfig.upsert({
        where: { id: 'global' },
        update: { whapiToken: token },
        create: { id: 'global', whapiToken: token }
    });

    console.log('✅ Token successfully forced into Database.');
    process.exit(0);
}

setToken().catch(err => {
    console.error(err);
    process.exit(1);
});
