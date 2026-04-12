import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import bodyParser from 'body-parser';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { WebhookController } from './controllers/webhook.controller.js';
import { FincraWebhookController } from './controllers/fincra.webhook.controller.js';
import { AdminController } from './controllers/admin.controller.js';
import { AuthController } from './controllers/auth.controller.js';
import { authMiddleware, requireRole } from './middleware/auth.middleware.js';
import prisma from './utils/prisma.js';
import { whapiService } from './services/whapi.service.js';
import { AgentExecutor } from './services/agent.executor.js';

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ===== STATIC FILES (Receipts) =====
app.use('/receipts', express.static(path.join(__dirname, '../public/receipts')));

// ===== PUBLIC ROUTES =====

// Health check JSON
app.get('/api/status', async (req, res) => {
    const p = path.join(__dirname, '../frontend/dist');
    let dbStatus = 'Unknown';
    try {
        await prisma.adminUser.count();
        dbStatus = 'Connected';
    } catch (e: any) {
        dbStatus = 'Error: ' + e.message;
    }
    res.json({ 
        message: 'ChatPay API — Operational',
        version: '3.18.0',
        timestamp: new Date().toISOString(),
        frontendExists: fs.existsSync(p),
        database: dbStatus
    });
});

app.get('/api/debug/ls', (req, res) => {
    try {
        const root = path.join(__dirname, '..');
        res.json({
            root: fs.readdirSync(root),
            frontend: fs.existsSync(path.join(root, 'frontend')) ? fs.readdirSync(path.join(root, 'frontend')) : 'MISSING'
        });
    } catch (e) {
        res.json({ error: e.message });
    }
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

// Fincra webhook (Deposits)
app.post('/webhook/fincra', FincraWebhookController.handleIncoming);

// ===== AUTH ROUTES =====
app.post('/api/auth/setup', AuthController.setupFirstAdmin);
app.post('/api/auth/login', AuthController.login);
app.get('/api/auth/me', authMiddleware, AuthController.getProfile);
app.post('/api/auth/register', authMiddleware, requireRole('SUPER_ADMIN'), AuthController.register);
app.post('/api/auth/update-password', authMiddleware, AuthController.updatePassword);

// ===== ADMIN ROUTES =====
app.get('/api/admin/metrics', authMiddleware, AdminController.getMetrics);
app.get('/api/admin/analytics', authMiddleware, AdminController.getAnalytics);
app.get('/api/admin/health', authMiddleware, AdminController.getSystemHealth);
app.get('/api/admin/config', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.getSystemConfig);
app.post('/api/admin/config', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.updateSystemConfig);
app.post('/api/admin/config/sync-webhook', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.syncWhapiWebhook);
app.post('/api/admin/config/test-outbound', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.testOutbound);
app.get('/api/admin/transactions', authMiddleware, AdminController.getTransactions);
app.get('/api/admin/users', authMiddleware, AdminController.getUsers);
app.get('/api/admin/users/:id', authMiddleware, AdminController.getUserDetail);
app.post('/api/admin/users/:id/verify', authMiddleware, requireRole('SUPER_ADMIN', 'OPERATOR'), AdminController.verifyUser);
app.post('/api/admin/users/:id/kyb-verify', authMiddleware, requireRole('SUPER_ADMIN', 'OPERATOR'), AdminController.verifyBusinessCac);
app.post('/api/admin/users/:id/suspend', authMiddleware, requireRole('SUPER_ADMIN'), AdminController.toggleSuspend);
app.get('/api/admin/kyc-pending', authMiddleware, AdminController.getPendingKYC);
app.get('/api/admin/conversations', authMiddleware, AdminController.getConversations);
app.get('/api/admin/webhooks', authMiddleware, AdminController.getWebhookLogs);

// ===== SERVE FRONTEND (Production) =====
// In dist/index.js, __dirname is the `dist` folder. The frontend dist is in `../frontend/dist`.
const frontendPath = path.join(__dirname, '../frontend/dist');

app.use(express.static(frontendPath));
app.use((req, res, next) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/webhook')) {
        res.sendFile(path.join(frontendPath, 'index.html'), (err) => {
            if (err) {
                console.error("sendFile error:", err);
                res.status(500).send("Error serving frontend: " + err.message + " Path: " + path.join(frontendPath, 'index.html'));
            }
        });
    } else {
        next();
    }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`\n🏦 ChatPay Server v3.18.0 — Global Autonomous Bank Active\n   Port: ${PORT}`);
    
    // Auto-sync webhook on start
    try {
        const renderUrl = process.env.RENDER_EXTERNAL_URL;
        if (renderUrl) {
            const webhookUrl = `${renderUrl}/webhook/whatsapp`;
            await whapiService.registerWebhook(webhookUrl);
            console.log(`   Webhook: AUTO-SYNCED to ${webhookUrl}`);
        }
    } catch (e) {
        console.error('   Webhook: Sync Failed on Startup');
    }

    // ===== START AGENT HEARTBEAT =====
    setInterval(() => {
        AgentExecutor.processMissions().catch(err => console.error('[Heartbeat Error]:', err));
    }, 60000); // Check every minute
});
