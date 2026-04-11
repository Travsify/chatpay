import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cors from 'cors';
import { WebhookController } from './controllers/webhook.controller.js';
import { AdminController } from './controllers/admin.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { authMiddleware, requireRole } from './middleware/auth.middleware.js';
import prisma from './utils/prisma.js';
import { whapiService } from './services/whapi.service.js';

const app = express();
app.use(cors());

// Health Check
app.get('/', (req, res) => {
    res.send('<h1>ChatPay Server is Live 🚀</h1><p>Status: Healthy | Database: Connected</p>');
});

// Serve frontend in production
const frontendPath = path.join(process.cwd(), 'frontend', 'dist');
if (fs.existsSync(frontendPath)) {
    app.use(express.static(frontendPath));
    app.get('*', (req, res) => {
        if (!req.path.startsWith('/api') && !req.path.startsWith('/webhook')) {
            res.sendFile(path.join(frontendPath, 'index.html'));
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
    console.log(`[ChatPay] Server running on port ${PORT}`);
    
    // Auto-sync webhook on start
    try {
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) {
            const webhookUrl = `${renderUrl}/webhook/whatsapp`;
            await whapiService.registerWebhook(webhookUrl);
            console.log(`[ChatPay] Webhook Auto-Synced: ${webhookUrl}`);
        }
    } catch (e) {
        console.error('[ChatPay] Webhook Sync Failed on Start');
    }
});

app.use(bodyParser.json());

// ===== PUBLIC ROUTES =====

// Health check
app.get('/api/status', (req, res) => {
    res.json({ 
        message: 'ChatPay API — Operational',
        version: '3.1.0',
        timestamp: new Date().toISOString()
    });
});

// Load configuration
app.get('/api/config/public', async (req, res) => {
    try {
        const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
        res.json({ whatsappNumber: config?.whatsappNumber || '2348026990956' });
    } catch (e) {
        res.json({ whatsappNumber: '2348026990956' });
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
app.post('/api/admin/config/sync-webhook', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.syncWhapiWebhook);
app.post('/api/admin/config/test-outbound', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.testOutbound);

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
    console.log(`\n🏦 ChatPay Server v3.1 (ASCII-FIX) — God Mode Active        
   Port: ${PORT}`);
    console.log(`   Admin: /api/auth/setup (first-time)`);
    console.log(`   API:   /api/status\n`);
});
