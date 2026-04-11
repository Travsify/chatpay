import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function setToken() {
    const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImExZDI2YWYyYmY4MjVmYjI5MzVjNWI3OTY3ZDA3YmYwZTMxZWIxYjcifQ.eyJwYXJ0bmVyIjp0cnVlLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vd2hhcGktYTcyMWYiLCJhdWQiOiJ3aGFwaS1hNzIxZiIsImF1dGhfdGltZSI6MTc3NTMyOTE4NCwidXNlcl9pZCI6IjJXakhmM2NIUGRWRVZESVI1VU9tSXgxelNvSTMiLCJzdWIiOiIyV2pIZjNjSFBkVkVWRElSNVVPbUl4MXpTb0kzIiwiaWF0IjoxNzc1MzI5MTg0LCJleHAiOjE4MzU4MDkxODQsImVtYWlsIjoidG9uZXJvY29vbDFAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsidG9uZXJvY29vbDFAZ21haWwuY29tIl19LCJzaWduX2luX3Byb3ZpZGVyIjoicGFzc3dvcmQifX0.OWrB1KfD73sBjRYgE7V-HufKZnvy7aKISRBWFwlK-ilIU4CNejye2q7ckZ0OB4p0jLEow8evUXxVWvdJ9x5kX0Mw_TgzOmbWbUw4-kK_Bt7QUckKhGUMmgh1_e6Cw4_qsD0lj955fDwnQgIVz3wwV3exBSaBbaZJggESlFmkg9f-SP175nYAHCc87eOlm8t3xzN99q6UiUMD1G2RRQpEWDW8f0acZKwomxY_rX1glUI4E6ihg9SpZx7eAtFJ1HvgA0l7uH47k5S6Nl4uwoTq5zhbT1F1MLSu-6iY1xRVa1HnvU3_ffJ7uSP14ht-gsQ-6ZlCXgqSLaLMynPg0pYl4g';
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
