import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';
import { WebhookController } from './controllers/webhook.controller.js';
import { AdminController } from './controllers/admin.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { authMiddleware, requireRole } from './middleware/auth.middleware.js';

dotenv.config();

const app = express();
app.use(cors());
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// ===== PUBLIC ROUTES =====

// Health check
app.get('/api/status', (req, res) => {
    res.json({ 
        message: 'ChatPay API — Operational',
        version: '3.0.0',
        timestamp: new Date().toISOString()
    });
});

// Front-end Public API Config
app.get('/api/config/public', async (req, res) => {
    try {
        const { PrismaClient } = await import('@prisma/client');
        const prisma = new PrismaClient();
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        res.json({ whatsappNumber: config?.whatsappNumber || '2348000000000' });
    } catch (e) {
        res.json({ whatsappNumber: '2348000000000' });
    }
});

// WhatsApp webhook (Whapi.cloud)
app.post('/webhook/whatsapp', WebhookController.handleIncoming);

// ===== AUTH ROUTES =====
app.post('/api/auth/setup', AuthController.setupFirstAdmin);  // One-time bootstrap
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', authMiddleware, AuthController.getProfile);
app.post('/api/auth/register', authMiddleware, requireRole('SUPER_ADMIN'), AuthController.register);
app.post('/api/auth/update-password', authMiddleware, AuthController.updatePassword);

// ===== ADMIN ROUTES (Protected — God Mode) =====
// Dashboard & Metrics
app.get('/api/admin/metrics', authMiddleware, AdminController.getMetrics);
app.get('/api/admin/analytics', authMiddleware, AdminController.getAnalytics);
app.get('/api/admin/health', authMiddleware, AdminController.getSystemHealth);

// System Configuration (API Vault)
app.get('/api/admin/config', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.getSystemConfig);
app.post('/api/admin/config', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.updateSystemConfig);

// Transactions
app.get('/api/admin/transactions', authMiddleware, AdminController.getTransactions);

// Users
app.get('/api/admin/users', authMiddleware, AdminController.getUsers);
app.get('/api/admin/users/:id', authMiddleware, AdminController.getUserDetail);
app.post('/api/admin/users/:id/verify', authMiddleware, requireRole('SUPER_ADMIN', 'OPERATOR'), AdminController.verifyUser);
app.post('/api/admin/users/:id/kyb-verify', authMiddleware, requireRole('SUPER_ADMIN', 'OPERATOR'), AdminController.verifyBusinessCac);
app.post('/api/admin/users/:id/suspend', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.toggleSuspend);

// KYC
app.get('/api/admin/kyc-pending', authMiddleware, AdminController.getPendingKYC);

// Conversations & Webhooks
app.get('/api/admin/conversations', authMiddleware, AdminController.getConversations);
app.get('/api/admin/webhooks', authMiddleware, AdminController.getWebhookLogs);

// ===== SERVE FRONTEND =====
const frontendPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendPath));

app.use((req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT as number, '0.0.0.0', () => {
    console.log(`\n🏦 ChatPay Server v3.0 — God Mode Active`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Admin: /api/auth/setup (first-time)`);
    console.log(`   API:   /api/status\n`);
});
