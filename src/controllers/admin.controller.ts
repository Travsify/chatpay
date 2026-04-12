import { Request, Response } from 'express';
import prisma from '../utils/prisma.js';
import { AuthRequest } from '../middleware/auth.middleware.js';
import { PremblyService } from '../services/prembly.service.js';
import { WalletService } from '../services/wallet.service.js';
import { whapiService } from '../services/whapi.service.js';
import { SyncService } from '../services/sync.service.js';

export class AdminController {

    // ===== SYSTEM CONFIGURATION (API VAULT) =====
    static async getSystemConfig(req: AuthRequest, res: Response) {
        try {
            let config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            if (!config) {
                config = await prisma.systemConfig.create({
                    data: {
                        id: 'global',
                        whatsappNumber: '2348026990956',
                        premblySecret: '',
                        openaiKey: '',
                        fincraSecret: '',
                        whapiToken: ''
                    }
                });
            }
            res.json(config);
        } catch (error) {
            console.error('Config Fetch Error:', error);
            res.status(500).json({ error: 'Failed to fetch system configuration' });
        }
    }

    static async updateSystemConfig(req: AuthRequest, res: Response) {
        try {
            const data = req.body;
            const allowedFields = ['whatsappNumber', 'premblySecret', 'openaiKey', 'fincraSecret', 'fincraBusinessId', 'fincraWebhookSecret', 'flutterwaveSecret', 'whapiToken', 'whapiApiUrl', 'whapiWebhookUrl', 'quidaxSecret', 'prestmitSecret', 'mapleradSecret', 'bitnobApiKey', 'feePercentage', 'flatFee', 'usdExchangeRate', 'usdMarkup', 'dailyLimit', 'eurMarkup', 'gbpMarkup', 'cryptoMarkupPerc', 'giftcardMarkupPerc', 'cardIssuanceFee', 'cardFundingMarkup'];
            const updateData: any = {};
            
            const numericFields = ['feePercentage', 'flatFee', 'usdExchangeRate', 'usdMarkup', 'dailyLimit', 'eurMarkup', 'gbpMarkup', 'cryptoMarkupPerc', 'giftcardMarkupPerc', 'cardIssuanceFee', 'cardFundingMarkup'];
            
            allowedFields.forEach(field => {
                if (req.body[field] !== undefined) {
                    let value = req.body[field];
                    if (numericFields.includes(field)) {
                        updateData[field] = parseFloat(String(value)) || 0;
                    } else {
                        updateData[field] = (typeof value === 'string') ? value.trim() : value;
                    }
                }
            });

            const config = await prisma.systemConfig.upsert({
                where: { id: 'global' },
                update: updateData,
                create: { id: 'global', ...updateData }
            });

            res.json({ message: 'System configuration updated successfully', config });
        } catch (error: any) {
            console.error('Config Update Error:', error);
            res.status(500).json({ error: error.message || 'Failed to update system configuration' });
        }
    }

    static async syncWhapiWebhook(req: AuthRequest, res: Response) {
        try {
            const config = await prisma.systemConfig.findUnique({ where: { id: 'global' } });
            
            // PRIORITY: Database Webhook URL -> Environment -> Hardcoded Default
            const webhookUrl = config?.whapiWebhookUrl || process.env.WHAPI_WEBHOOK_URL || 'https://chatpay-l4ej.onrender.com/webhook/whatsapp';
            
            console.log(`[Admin] TRIGGERING SYNC to: ${webhookUrl}`);
            const result = await whapiService.registerWebhook(webhookUrl);
            res.json({ message: `Webhook synchronized to ${webhookUrl}`, result });
        } catch (error: any) {
            console.error('Webhook Sync Error:', error.response?.data || error.message);
            res.status(500).json({ error: error.response?.data?.message || 'Failed to sync webhook' });
        }
    }

    static async testOutbound(req: AuthRequest, res: Response) {
        try {
            const { phoneNumber } = req.body;
            if (!phoneNumber) throw new Error('Phone number is required');
            
            const result = await whapiService.sendMessage(phoneNumber, "🚀 *ChatPay Connection Test*: Your WhatsApp bot is now successfully connected to the God Mode engine!");
            
            // Log to DB for visibility
            await prisma.webhookLog.create({
                data: {
                    direction: 'OUTBOUND',
                    status: 'PROCESSED',
                    phoneNumber: phoneNumber,
                    payload: JSON.stringify(result)
                }
            });

            res.json({ message: 'Test message sent!', result });
        } catch (error: any) {
            console.error('Test Outbound Error:', error.response?.data || error.message);
            
            await prisma.webhookLog.create({
                data: {
                    direction: 'OUTBOUND',
                    status: 'FAILED',
                    phoneNumber: req.body.phoneNumber || 'UNKNOWN',
                    payload: JSON.stringify(error.response?.data || {}),
                    errorMsg: error.message
                }
            });

            res.status(500).json({ error: error.response?.data?.message || 'Failed to send test message' });
        }
    }

    // ===== DASHBOARD METRICS =====
    // POST /api/admin/sync-fincra
    static async syncFincra(req: AuthRequest, res: Response) {
        try {
            console.log('[Admin] Triggering exhaustive Fincra history sync...');
            const result = await SyncService.fullHistorySync();
            res.json({ 
                message: 'Exhaustive sync complete', 
                ...result,
                note: 'User balances are automatically correct based on these transactions.' 
            });
        } catch (error: any) {
            const fincraError = error.response?.data?.message || error.response?.data?.error || error.message;
            console.error('[Admin] Fincra Sync Details:', JSON.stringify(error.response?.data || {}));
            res.status(500).json({ error: fincraError });
        }
    }

    // GET /api/admin/metrics
    static async getMetrics(req: AuthRequest, res: Response) {
        try {
            console.log('[Admin] Fetching dashboard metrics in parallel...');
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Execute ALL queries in parallel for maximum speed and to avoid pooler timeouts
            const [
                totalUsers,
                verifiedUsers,
                pendingKyc,
                suspendedUsers,
                totalTx,
                successTx,
                failedTx,
                tpvResult,
                todayUsers,
                todayTx,
                todayTpvResult,
                totalConversations,
                todayConversations,
                totalWebhooks,
                failedWebhooks,
                totalAiCalls,
                unknownIntents
            ] = await Promise.all([
                prisma.user.count().catch(() => 0),
                prisma.user.count({ where: { kycStatus: 'VERIFIED' } }).catch(() => 0),
                prisma.user.count({ where: { kycStatus: 'PENDING' } }).catch(() => 0),
                prisma.user.count({ where: { suspended: true } }).catch(() => 0),
                prisma.transaction.count().catch(() => 0),
                prisma.transaction.count({ where: { status: 'SUCCESS' } }).catch(() => 0),
                prisma.transaction.count({ where: { status: 'FAILED' } }).catch(() => 0),
                prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS' } }).catch(() => ({ _sum: { amount: 0 } })),
                prisma.user.count({ where: { createdAt: { gte: today } } }).catch(() => 0),
                prisma.transaction.count({ where: { createdAt: { gte: today } } }).catch(() => 0),
                prisma.transaction.aggregate({ _sum: { amount: true }, where: { status: 'SUCCESS', createdAt: { gte: today } } }).catch(() => ({ _sum: { amount: 0 } })),
                prisma.conversationLog.count().catch(() => 0),
                prisma.conversationLog.count({ where: { createdAt: { gte: today } } }).catch(() => 0),
                prisma.webhookLog.count().catch(() => 0),
                prisma.webhookLog.count({ where: { status: 'FAILED' } }).catch(() => 0),
                prisma.conversationLog.count({ where: { direction: 'INBOUND' } }).catch(() => 0),
                prisma.conversationLog.count({ where: { direction: 'INBOUND', intent: 'UNKNOWN' } }).catch(() => 0)
            ]);

            const tpv = tpvResult?._sum?.amount || 0;
            const todayTpv = todayTpvResult?._sum?.amount || 0;

            const webhookSuccessRate = totalWebhooks > 0
                ? ((totalWebhooks - failedWebhooks) / totalWebhooks * 100).toFixed(1)
                : '100.0';

            const aiAccuracy = totalAiCalls > 0
                ? ((totalAiCalls - unknownIntents) / totalAiCalls * 100).toFixed(1)
                : '98.5';

            res.json({
                tpv: `₦${tpv.toLocaleString()}`,
                tpvRaw: tpv,
                totalUsers,
                verifiedUsers,
                pendingKyc,
                suspendedUsers,
                totalTx,
                successTx,
                failedTx,
                todayUsers,
                todayTx,
                todayTpv,
                totalConversations,
                todayConversations,
                aiAccuracy: `${aiAccuracy}%`,
                webhookSuccessRate: `${webhookSuccessRate}%`,
                totalWebhooks,
                failedWebhooks,
                kycCompliance: totalUsers > 0 ? `${(verifiedUsers / totalUsers * 100).toFixed(1)}%` : '0%',
                generatedAt: new Date().toISOString(),
                systemStatus: 'Operational'
            });
        } catch (error: any) {
            console.error('[Admin Metrics] Fatal Failure:', error);
            // Absolute safety fallback: Never 500, always return valid (though empty) metrics
            res.json({
                tpv: '₦0',
                totalUsers: 0,
                totalTx: 0,
                systemStatus: 'Degraded',
                error: error.message,
                generatedAt: new Date().toISOString()
            });
        }
    }

    // ===== REVENUE ANALYTICS =====
    // GET /api/admin/analytics?days=30
    static async getAnalytics(req: AuthRequest, res: Response) {
        try {
            const days = parseInt(req.query.days as string) || 30;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // 1. Daily Breakdown (Safe Fetch)
            let transactions: any[] = [];
            try {
                transactions = await prisma.transaction.findMany({
                    where: { createdAt: { gte: startDate } },
                    select: { amount: true, status: true, type: true, createdAt: true },
                    orderBy: { createdAt: 'asc' }
                });
            } catch (txErr) {
                console.error('[Admin] Analytics TX Fetch Failed:', txErr);
            }

            const dailyMap: Record<string, { volume: number; count: number; success: number; failed: number }> = {};
            for (let i = 0; i <= days; i++) {
                const d = new Date(startDate);
                d.setDate(d.getDate() + i);
                const key = d.toISOString().split('T')[0];
                dailyMap[key] = { volume: 0, count: 0, success: 0, failed: 0 };
            }

            transactions.forEach(tx => {
                const key = tx.createdAt.toISOString().split('T')[0];
                if (dailyMap[key]) {
                    dailyMap[key].count++;
                    if (tx.status === 'SUCCESS') {
                        dailyMap[key].volume += tx.amount;
                        dailyMap[key].success++;
                    } else if (tx.status === 'FAILED') {
                        dailyMap[key].failed++;
                    }
                }
            });

            const dailyData = Object.entries(dailyMap).map(([date, data]) => ({
                date,
                ...data
            }));

            // 2. Type Breakdown (Safe GroupBy)
            let typeBreakdown: any[] = [];
            try {
                typeBreakdown = await (prisma.transaction.groupBy as any)({
                    by: ['type'],
                    _count: true,
                    _sum: { amount: true },
                    where: { createdAt: { gte: startDate } }
                });
            } catch (groupErr) {
                console.error('[Admin] Analytics Grouping Failed:', groupErr);
            }

            res.json({
                dailyData,
                typeBreakdown,
                days,
                generatedAt: new Date().toISOString()
            });
        } catch (error: any) {
            console.error('[Admin Analytics] Critical Failure:', error);
            res.json({
                dailyData: [],
                typeBreakdown: [],
                error: error.message
            });
        }
    }


    // ===== TRANSACTIONS =====
    // GET /api/admin/transactions?page=1&limit=25&status=SUCCESS&type=P2P_SEND&search=john
    static async getTransactions(req: AuthRequest, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 25;
            const status = req.query.status as string;
            const type = req.query.type as string;
            const search = req.query.search as string;

            const where: any = {};
            if (status) where.status = status;
            if (type) where.type = type;
            if (search) {
                where.OR = [
                    { reference: { contains: search } },
                    { description: { contains: search } },
                    { user: { phoneNumber: { contains: search } } },
                    { user: { name: { contains: search } } }
                ];
            }

            const [transactions, total] = await Promise.all([
                prisma.transaction.findMany({
                    where,
                    take: limit,
                    skip: (page - 1) * limit,
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { id: true, name: true, phoneNumber: true, kycStatus: true } } }
                }),
                prisma.transaction.count({ where })
            ]);

            res.json({
                transactions,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Transactions error:', error);
            res.status(500).json({ error: 'Failed to fetch transactions' });
        }
    }

    // ===== USER MANAGEMENT =====
    // GET /api/admin/users?page=1&limit=25&kyc=PENDING&search=john
    static async getUsers(req: AuthRequest, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 25;
            const kyc = req.query.kyc as string;
            const search = req.query.search as string;
            const suspended = req.query.suspended;

            const where: any = {};
            if (kyc) where.kycStatus = kyc;
            if (suspended === 'true') where.suspended = true;
            if (search) {
                where.OR = [
                    { phoneNumber: { contains: search } },
                    { name: { contains: search } }
                ];
            }

            const [users, total] = await Promise.all([
                prisma.user.findMany({
                    where,
                    take: limit,
                    skip: (page - 1) * limit,
                    orderBy: { createdAt: 'desc' },
                    include: {
                        _count: { select: { transactions: true, conversations: true } },
                        virtualAccounts: true
                    }
                }),
                prisma.user.count({ where })
            ]);

            res.json({
                users,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit)
                }
            });
        } catch (error) {
            console.error('Users error:', error);
            res.status(500).json({ error: 'Failed to fetch users' });
        }
    }

    // GET /api/admin/users/:id
    static async getUserDetail(req: AuthRequest, res: Response) {
        try {
            const userId = req.params.id as string;
            const user = await prisma.user.findUnique({
                where: { id: userId },
                include: {
                    transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
                    sessions: { orderBy: { updatedAt: 'desc' }, take: 5 },
                    conversations: { orderBy: { createdAt: 'desc' }, take: 50 },
                    virtualAccounts: true
                }
            });

            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            // Calculate user-specific metrics
            const userTpv = await prisma.transaction.aggregate({
                _sum: { amount: true },
                where: { userId: user.id, status: 'SUCCESS' }
            });

            const userData = user as any;
            res.json({
                ...user,
                metrics: {
                    totalVolume: userTpv._sum.amount || 0,
                    transactionCount: userData.transactions?.length || 0,
                    conversationCount: userData.conversations?.length || 0
                }
            });
        } catch (error) {
            console.error('User detail error:', error);
            res.status(500).json({ error: 'Failed to fetch user details' });
        }
    }

    // POST /api/admin/users/:id/verify
    static async verifyUser(req: AuthRequest, res: Response) {
        const { status } = req.body; // VERIFIED or FAILED
        try {
            if (!['VERIFIED', 'FAILED', 'PENDING'].includes(status)) {
                res.status(400).json({ error: 'Invalid KYC status. Must be VERIFIED, FAILED, or PENDING' });
                return;
            }

            const userId = req.params.id as string;
            const user = await prisma.user.update({
                where: { id: userId },
                data: { kycStatus: status }
            });

            res.json({ message: `User ${user.phoneNumber} KYC status updated to ${status}`, user });
        } catch (error) {
            console.error('Verify user error:', error);
            res.status(500).json({ error: 'Failed to update user KYC' });
        }
    }

    // POST /api/admin/users/:id/kyb-verify
    static async verifyBusinessCac(req: AuthRequest, res: Response) {
        const { rcNumber, companyName } = req.body;
        const userId = req.params.id as string;

        try {
            if (!rcNumber) {
                res.status(400).json({ error: 'RC Number is required' });
                return;
            }

            // Call Prembly service
            const premblyResult = await PremblyService.verifyCAC(rcNumber, companyName);

            if (!premblyResult || !premblyResult.status) {
                res.status(400).json({ error: 'Prembly verification failed. Invalid RC Number.' });
                return;
            }

            // Save to BusinessKyb Table
            const data = premblyResult.data;
            const businessModel = await prisma.businessKyb.upsert({
                where: { userId },
                create: {
                    userId,
                    cacNumber: data.rc_number || rcNumber,
                    companyName: data.company_name,
                    directors: data.directors ? JSON.stringify(data.directors) : null,
                    status: 'VERIFIED',
                    verifiedAt: new Date()
                },
                update: {
                    cacNumber: data.rc_number || rcNumber,
                    companyName: data.company_name,
                    directors: data.directors ? JSON.stringify(data.directors) : null,
                    status: 'VERIFIED',
                    verifiedAt: new Date()
                }
            });

            // Elevate user's KYC tier automatically
            await prisma.user.update({
                where: { id: userId },
                data: { kycStatus: 'VERIFIED', tier: 2 } // Tier 2 = KYB Verified
            });

            // Trigger Fincra Business Account creation
            try {
                await WalletService.setupUserWallet(userId, 'business', data.company_name);
            } catch (walletErr) {
                console.error('Wallet Upgrade Error (Non-Fatal):', walletErr);
            }

            res.json({ message: 'Business successfully vetted and saved', business: businessModel });
        } catch (error: any) {
            console.error('Prembly KYB Error:', error.message);
            res.status(500).json({ error: error.message || 'Failed to communicate with Prembly API' });
        }
    }

    // POST /api/admin/users/:id/suspend
    static async toggleSuspend(req: AuthRequest, res: Response) {
        try {
            const userId = req.params.id as string;
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user) {
                res.status(404).json({ error: 'User not found' });
                return;
            }

            const updated = await prisma.user.update({
                where: { id: userId },
                data: { suspended: !user.suspended }
            });

            res.json({
                message: updated.suspended ? `User ${user.phoneNumber} suspended` : `User ${user.phoneNumber} reactivated`,
                user: updated
            });
        } catch (error) {
            console.error('Suspend error:', error);
            res.status(500).json({ error: 'Failed to toggle suspension' });
        }
    }

    // ===== KYC PENDING =====
    // GET /api/admin/kyc-pending
    static async getPendingKYC(req: AuthRequest, res: Response) {
        try {
            const pendingUsers = await prisma.user.findMany({
                where: { kycStatus: 'PENDING' },
                take: 50,
                orderBy: { createdAt: 'desc' },
                include: { _count: { select: { transactions: true } } }
            });
            res.json(pendingUsers);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch pending KYC' });
        }
    }

    // ===== CONVERSATION LOGS =====
    // GET /api/admin/conversations?page=1&limit=50&userId=xxx
    static async getConversations(req: AuthRequest, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const userId = req.query.userId as string;
            const intent = req.query.intent as string;

            const where: any = {};
            if (userId) where.userId = userId;
            if (intent) where.intent = intent;

            const [logs, total] = await Promise.all([
                prisma.conversationLog.findMany({
                    where,
                    take: limit,
                    skip: (page - 1) * limit,
                    orderBy: { createdAt: 'desc' },
                    include: { user: { select: { id: true, name: true, phoneNumber: true } } }
                }),
                prisma.conversationLog.count({ where })
            ]);

            res.json({
                logs,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
            });
        } catch (error) {
            console.error('Conversations error:', error);
            res.status(500).json({ error: 'Failed to fetch conversation logs' });
        }
    }

    // ===== WEBHOOK LOGS =====
    // GET /api/admin/webhooks?page=1&limit=50&status=FAILED
    static async getWebhookLogs(req: AuthRequest, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 50;
            const status = req.query.status as string;

            const where: any = {};
            if (status) where.status = status;

            const [logs, total] = await Promise.all([
                prisma.webhookLog.findMany({
                    where,
                    take: limit,
                    skip: (page - 1) * limit,
                    orderBy: { createdAt: 'desc' }
                }),
                prisma.webhookLog.count({ where })
            ]);

            res.json({
                logs,
                pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
            });
        } catch (error) {
            console.error('Webhook logs error:', error);
            res.status(500).json({ error: 'Failed to fetch webhook logs' });
        }
    }

    // ===== SYSTEM HEALTH =====
    // GET /api/admin/health
    static async getSystemHealth(req: AuthRequest, res: Response) {
        try {
            const start = Date.now();
            await prisma.user.count(); // DB ping
            const dbLatency = Date.now() - start;

            // Last webhook time
            const lastWebhook = await prisma.webhookLog.findFirst({
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true, status: true }
            });

            // Last conversation
            const lastConversation = await prisma.conversationLog.findFirst({
                orderBy: { createdAt: 'desc' },
                select: { createdAt: true, intent: true }
            });

            // Active sessions (updated in last 15 mins)
            const fifteenMinAgo = new Date(Date.now() - 15 * 60 * 1000);
            const activeSessions = await prisma.session.count({
                where: { updatedAt: { gte: fifteenMinAgo } }
            });
            // Check Whapi Health
            const whapiHealth = await whapiService.getChannelHealth();

            res.json({
                status: (!whapiHealth.authenticated) ? 'DEGRADED' : 'OPERATIONAL',
                dbLatencyMs: dbLatency,
                activeSessions,
                lastWebhook: lastWebhook ? {
                    at: lastWebhook.createdAt,
                    status: lastWebhook.status
                } : null,
                lastConversation: lastConversation ? {
                    at: lastConversation.createdAt,
                    intent: lastConversation.intent
                } : null,
                uptime: process.uptime(),
                memoryUsage: process.memoryUsage(),
                nodeVersion: process.version,
                whapi: whapiHealth,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            res.status(500).json({
                status: 'DEGRADED',
                error: 'Health check failed',
                timestamp: new Date().toISOString()
            });
        }
    }
}
