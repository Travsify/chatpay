import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: ['error', 'warn'],
  errorFormat: 'minimal',
});

// Configure connection management
// Prisma handles connection pooling via the URL, 
// but we can ensure internal client stability here.

export default prisma;
