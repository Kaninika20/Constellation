import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import healthRoutes from './routes/health.routes.js';
import schemaRoutes from './routes/schema.routes.js';
import authRoutes from './routes/auth.routes.js';
import studentRoutes from './routes/student.routes.js';
import relationshipRoutes from './routes/relationship.routes.js';
import clubRoutes from './routes/club.routes.js';
import courseRoutes from './routes/course.routes.js';
import eventRoutes from './routes/event.routes.js';
import interestRoutes from './routes/interest.routes.js';
import fraudRoutes from './routes/fraud.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import recommendationRoutes from './routes/recommendation.routes.js';
import communityRoutes from './routes/community.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler, notFoundHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// API Routes
app.use('/api/health', healthRoutes);
app.use('/api/schema', schemaRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/relationships', relationshipRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/fraud', fraudRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/admin', adminRoutes);

// Root route welcoming message & API discovery
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Constellation API - Graph-Based College Social Network with Fraud Detection',
    version: '1.0.0',
    documentation: {
      health: '/api/health',
      schemaStatus: '/api/schema/status',
      auth: '/api/auth',
      students: '/api/students',
      relationships: '/api/relationships',
      clubs: '/api/clubs',
      courses: '/api/courses',
      events: '/api/events',
      fraud: '/api/fraud',
      analytics: '/api/analytics',
      recommendations: '/api/recommendations',
      communities: '/api/communities',
      admin: '/api/admin'
    }
  });
});

// Centralized 404 and Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
