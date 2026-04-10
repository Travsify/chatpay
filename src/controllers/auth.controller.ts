import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../utils/prisma';
import { generateToken, AuthRequest } from '../middleware/auth.middleware';

export class AuthController {

    // POST /api/auth/login
    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                res.status(400).json({ error: 'Email and password are required' });
                return;
            }

            const admin = await prisma.adminUser.findUnique({ where: { email } });
            if (!admin) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            const isValid = await bcrypt.compare(password, admin.passwordHash);
            if (!isValid) {
                res.status(401).json({ error: 'Invalid credentials' });
                return;
            }

            // Update last login
            await prisma.adminUser.update({
                where: { id: admin.id },
                data: { lastLoginAt: new Date() }
            });

            const token = generateToken({
                id: admin.id,
                email: admin.email,
                role: admin.role
            });

            res.json({
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                }
            });
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/auth/register (only SUPER_ADMIN can create new admins)
    static async register(req: AuthRequest, res: Response) {
        try {
            const { email, password, name, role } = req.body;

            if (!email || !password || !name) {
                res.status(400).json({ error: 'Email, password, and name are required' });
                return;
            }

            const existing = await prisma.adminUser.findUnique({ where: { email } });
            if (existing) {
                res.status(409).json({ error: 'Admin with this email already exists' });
                return;
            }

            const passwordHash = await bcrypt.hash(password, 12);

            const admin = await prisma.adminUser.create({
                data: {
                    email,
                    passwordHash,
                    name,
                    role: role || 'OPERATOR'
                }
            });

            res.status(201).json({
                message: 'Admin created successfully',
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                }
            });
        } catch (error) {
            console.error('Register error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // GET /api/auth/me
    static async getProfile(req: AuthRequest, res: Response) {
        try {
            const admin = await prisma.adminUser.findUnique({
                where: { id: req.admin!.id },
                select: { id: true, email: true, name: true, role: true, lastLoginAt: true, createdAt: true }
            });

            if (!admin) {
                res.status(404).json({ error: 'Admin not found' });
                return;
            }

            res.json(admin);
        } catch (error) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/auth/setup — First-time bootstrap (creates initial super admin)
    static async setupFirstAdmin(req: Request, res: Response) {
        try {
            const existingCount = await prisma.adminUser.count();
            if (existingCount > 0) {
                res.status(403).json({ error: 'Setup already completed. Use login instead.' });
                return;
            }

            const { email, password, name } = req.body;
            if (!email || !password || !name) {
                res.status(400).json({ error: 'Email, password, and name are required' });
                return;
            }

            const passwordHash = await bcrypt.hash(password, 12);
            const admin = await prisma.adminUser.create({
                data: {
                    email,
                    passwordHash,
                    name,
                    role: 'SUPER_ADMIN'
                }
            });

            const token = generateToken({
                id: admin.id,
                email: admin.email,
                role: admin.role
            });

            res.status(201).json({
                message: 'Super Admin created. Welcome to God Mode.',
                token,
                admin: {
                    id: admin.id,
                    email: admin.email,
                    name: admin.name,
                    role: admin.role
                }
            });
        } catch (error) {
            console.error('Setup error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

    // POST /api/auth/update-password
    static async updatePassword(req: AuthRequest, res: Response) {
        try {
            const { currentPassword, newPassword } = req.body;

            if (!currentPassword || !newPassword) {
                res.status(400).json({ error: 'Current and new passwords are required' });
                return;
            }

            const admin = await prisma.adminUser.findUnique({ where: { id: req.admin!.id } });
            if (!admin) {
                res.status(404).json({ error: 'Admin not found' });
                return;
            }

            const isValid = await bcrypt.compare(currentPassword, admin.passwordHash);
            if (!isValid) {
                res.status(401).json({ error: 'Incorrect current password' });
                return;
            }

            const newPasswordHash = await bcrypt.hash(newPassword, 12);
            await prisma.adminUser.update({
                where: { id: admin.id },
                data: { passwordHash: newPasswordHash }
            });

            res.json({ message: 'Password updated successfully' });
        } catch (error) {
            console.error('Update password error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
