import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'chatpay-god-mode-secret-2026';

export interface AuthRequest extends Request {
    admin?: {
        id: string;
        email: string;
        role: string;
    };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Authentication required', code: 'NO_TOKEN' });
        return;
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
        req.admin = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
        return;
    }
};

// Role-based authorization
export const requireRole = (...roles: string[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.admin) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!roles.includes(req.admin.role)) {
            res.status(403).json({ error: 'Insufficient permissions', required: roles });
            return;
        }
        next();
    };
};

export const generateToken = (payload: { id: string; email: string; role: string }) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};
