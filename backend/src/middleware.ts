import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWTPayload, User } from './types';
import { Collections } from './database';

const SECRET_KEY = process.env.JWT_SECRET || 'strive-secret-key-2025';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function createAuthMiddleware(collections: Collections) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({ detail: 'Not authenticated' });
        return;
      }

      const token = authHeader.substring(7);
      
      const payload = jwt.verify(token, SECRET_KEY) as JWTPayload;
      const userId = payload.sub;

      if (!userId) {
        res.status(401).json({ detail: 'Invalid token' });
        return;
      }

      const user = await collections.users.findOne({ id: userId });
      
      if (!user) {
        res.status(401).json({ detail: 'User not found' });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        res.status(401).json({ detail: 'Token expired' });
        return;
      }
      res.status(401).json({ detail: 'Invalid token' });
    }
  };
}
