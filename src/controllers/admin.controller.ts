import { Request, Response } from 'express';
import prisma from '../utils/prisma';

export class AdminController {
    
    static async getMetrics(req: Request, res: Response) {
        try {
            // Mocking metrics for now, but wired to models
            const totalUsers = await prisma.user.count();
            const totalTx = await prisma.transaction.count();
            
            res.json({
                tpv: '₦4,250,000',
                totalUsers,
                totalTx,
                kycCompliance: '88%',
                aiAccuracy: '98.5%'
            });
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch metrics' });
        }
    }

    static async getTransactions(req: Request, res: Response) {
        try {
            const transactions = await prisma.transaction.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            });
            res.json(transactions);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch transactions' });
        }
    }

    static async getPendingKYC(req: Request, res: Response) {
        try {
            const pendingUsers = await prisma.user.findMany({
                where: { kycStatus: 'PENDING' },
                take: 20
            });
            res.json(pendingUsers);
        } catch (error) {
            res.status(500).json({ error: 'Failed to fetch pending KYC' });
        }
    }

    static async verifyUser(req: Request, res: Response) {
        const { userId, status } = req.body;
        try {
            const user = await prisma.user.update({
                where: { id: userId },
                data: { kycStatus: status }
            });
            res.json({ message: `User ${userId} updated to ${status}`, user });
        } catch (error) {
            res.status(500).json({ error: 'Failed to update user kyc' });
        }
    }
}
