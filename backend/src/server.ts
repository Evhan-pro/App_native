import express, { Request, Response } from 'express';
import cors from 'cors';
import { createHash } from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import { connectToDatabase, closeDatabase, Collections } from './database';
import { createAuthMiddleware, AuthenticatedRequest } from './middleware';
import {
  UserCreate,
  UserLogin,
  UserUpdate,
  UserResponse,
  TokenResponse,
  ActivityCreate,
  Activity,
  GlobalStats,
} from './types';

// Load environment variables
dotenv.config();

const app = express();
const PORT = 8001;

// JWT Config
const SECRET_KEY = process.env.JWT_SECRET || 'strive-secret-key-2025';
const ACCESS_TOKEN_EXPIRE_DAYS = 30;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Helper functions
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function createAccessToken(userId: string): string {
  const now = Math.floor(Date.now() / 1000);
  const expire = now + ACCESS_TOKEN_EXPIRE_DAYS * 24 * 60 * 60;
  
  return jwt.sign(
    { sub: userId, exp: expire, iat: now },
    SECRET_KEY
  );
}

function toUserResponse(user: any): UserResponse {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    photo: user.photo || null,
    created_at: user.created_at,
  };
}

// Initialize server
async function startServer() {
  const collections = await connectToDatabase();
  const authMiddleware = createAuthMiddleware(collections);

  // ==================== AUTH ROUTES ====================

  // Register
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    try {
      const userData: UserCreate = req.body;

      // Check if email exists
      const existing = await collections.users.findOne({ 
        email: userData.email.toLowerCase() 
      });
      
      if (existing) {
        res.status(400).json({ detail: 'Email already registered' });
        return;
      }

      const userId = uuidv4();
      const userDoc = {
        id: userId,
        name: userData.name,
        email: userData.email.toLowerCase(),
        password_hash: hashPassword(userData.password),
        photo: null,
        created_at: new Date(),
      };

      await collections.users.insertOne(userDoc as any);

      const token = createAccessToken(userId);

      const response: TokenResponse = {
        access_token: token,
        token_type: 'bearer',
        user: toUserResponse(userDoc),
      };

      res.json(response);
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // Login
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const credentials: UserLogin = req.body;

      const user = await collections.users.findOne({ 
        email: credentials.email.toLowerCase() 
      });

      if (!user || user.password_hash !== hashPassword(credentials.password)) {
        res.status(401).json({ detail: 'Invalid email or password' });
        return;
      }

      const token = createAccessToken(user.id);

      const response: TokenResponse = {
        access_token: token,
        token_type: 'bearer',
        user: toUserResponse(user),
      };

      res.json(response);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // Get current user
  app.get('/api/auth/me', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    res.json(toUserResponse(req.user!));
  });

  // Update profile
  app.put('/api/auth/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const data: UserUpdate = req.body;
      const updateData: Record<string, any> = {};

      if (data.name) {
        updateData.name = data.name;
      }

      if (data.email) {
        // Check if email already used by another user
        const existing = await collections.users.findOne({
          email: data.email.toLowerCase(),
          id: { $ne: req.user!.id },
        });

        if (existing) {
          res.status(400).json({ detail: 'Email already in use' });
          return;
        }
        updateData.email = data.email.toLowerCase();
      }

      if (data.photo !== undefined) {
        updateData.photo = data.photo;
      }

      if (Object.keys(updateData).length > 0) {
        await collections.users.updateOne(
          { id: req.user!.id },
          { $set: updateData }
        );
      }

      const updatedUser = await collections.users.findOne({ id: req.user!.id });
      res.json(toUserResponse(updatedUser!));
    } catch (error) {
      console.error('Update profile error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // ==================== ACTIVITY ROUTES ====================

  // Create activity
  app.post('/api/activities', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const activityData: ActivityCreate = req.body;
      const activityId = uuidv4();

      const activityDoc: Activity = {
        id: activityId,
        user_id: req.user!.id,
        activity_type: activityData.activity_type,
        gps_points: activityData.gps_points,
        distance: activityData.distance,
        duration: activityData.duration,
        avg_speed: activityData.avg_speed,
        start_time: new Date(activityData.start_time),
        end_time: new Date(activityData.end_time),
        created_at: new Date(),
      };

      await collections.activities.insertOne(activityDoc as any);
      res.json(activityDoc);
    } catch (error) {
      console.error('Create activity error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // Get activities
  app.get('/api/activities', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const skip = parseInt(req.query.skip as string) || 0;

      const activities = await collections.activities
        .find({ user_id: req.user!.id })
        .sort({ start_time: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      res.json(activities);
    } catch (error) {
      console.error('Get activities error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // Get single activity
  app.get('/api/activities/:activityId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { activityId } = req.params;

      const activity = await collections.activities.findOne({
        id: activityId,
        user_id: req.user!.id,
      });

      if (!activity) {
        res.status(404).json({ detail: 'Activity not found' });
        return;
      }

      res.json(activity);
    } catch (error) {
      console.error('Get activity error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // Delete activity
  app.delete('/api/activities/:activityId', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { activityId } = req.params;

      const result = await collections.activities.deleteOne({
        id: activityId,
        user_id: req.user!.id,
      });

      if (result.deletedCount === 0) {
        res.status(404).json({ detail: 'Activity not found' });
        return;
      }

      res.json({ message: 'Activity deleted' });
    } catch (error) {
      console.error('Delete activity error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // Get stats
  app.get('/api/stats', authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const activities = await collections.activities
        .find({ user_id: req.user!.id })
        .toArray();

      if (activities.length === 0) {
        const emptyStats: GlobalStats = {
          total_activities: 0,
          total_distance: 0,
          total_duration: 0,
          avg_speed: 0,
        };
        res.json(emptyStats);
        return;
      }

      const totalDistance = activities.reduce((sum, act) => sum + act.distance, 0) / 1000;
      const totalDuration = activities.reduce((sum, act) => sum + act.duration, 0);
      const avgSpeed = totalDuration > 0 ? totalDistance / (totalDuration / 3600) : 0;

      const stats: GlobalStats = {
        total_activities: activities.length,
        total_distance: Math.round(totalDistance * 100) / 100,
        total_duration: totalDuration,
        avg_speed: Math.round(avgSpeed * 100) / 100,
      };

      res.json(stats);
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  });

  // ==================== HEALTH CHECK ====================

  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'healthy', timestamp: new Date() });
  });

  // Start server
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Strive API running on http://0.0.0.0:${PORT}`);
    console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down...');
    await closeDatabase();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down...');
    await closeDatabase();
    process.exit(0);
  });
}

// Start the server
startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
