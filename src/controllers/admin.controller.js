"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const express_1 = require("express");
const prisma_1 = __importDefault(require("../utils/prisma"));
class AdminController {
    static async getMetrics(req, res) {
        try {
            // Mocking metrics for now, but wired to models
            const totalUsers = await prisma_1.default.user.count();
            const totalTx = await prisma_1.default.transaction.count();
            res.json({
                tpv: '₦4,250,000',
                totalUsers,
                totalTx,
                kycCompliance: '88%',
                aiAccuracy: '98.5%'
            });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch metrics' });
        }
    }
    static async getTransactions(req, res) {
        try {
            const transactions = await prisma_1.default.transaction.findMany({
                take: 50,
                orderBy: { createdAt: 'desc' },
                include: { user: true }
            });
            res.json(transactions);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch transactions' });
        }
    }
    static async getPendingKYC(req, res) {
        try {
            const pendingUsers = await prisma_1.default.user.findMany({
                where: { kycStatus: 'PENDING' },
                take: 20
            });
            res.json(pendingUsers);
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to fetch pending KYC' });
        }
    }
    static async verifyUser(req, res) {
        const { userId, status } = req.body;
        try {
            const user = await prisma_1.default.user.update({
                where: { id: userId },
                data: { kycStatus: status }
            });
            res.json({ message: `User ${userId} updated to ${status}`, user });
        }
        catch (error) {
            res.status(500).json({ error: 'Failed to update user kyc' });
        }
    }
}
exports.AdminController = AdminController;
//# sourceMappingURL=admin.controller.js.map