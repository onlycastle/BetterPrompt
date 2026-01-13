/**
 * Express API Server
 *
 * Wraps the search-agent module with REST API endpoints
 * for the Knowledge Base Web UI.
 */

import express from 'express';
import cors from 'cors';
import { knowledgeRoutes } from './routes/knowledge.js';
import { learnRoutes } from './routes/learn.js';
import { influencerRoutes } from './routes/influencers.js';
import { reportRoutes } from './routes/reports.js';
import { enterpriseRoutes } from './routes/enterprise.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/learn', learnRoutes);
app.use('/api/influencers', influencerRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/enterprise', enterpriseRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error('API Error:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: err.message,
    });
  }
);

export { app };

export function startServer(port: number = 3001): void {
  app.listen(port, () => {
    console.log(`🚀 API Server running at http://localhost:${port}`);
    console.log(`   Health: http://localhost:${port}/api/health`);
    console.log(`   Knowledge: http://localhost:${port}/api/knowledge`);
    console.log(`   Learn: http://localhost:${port}/api/learn`);
    console.log(`   Influencers: http://localhost:${port}/api/influencers`);
    console.log(`   Reports: http://localhost:${port}/api/reports`);
    console.log(`   Enterprise: http://localhost:${port}/api/enterprise`);
  });
}
