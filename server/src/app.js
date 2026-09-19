import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import memberRoutes from './routes/members.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Allow the deployed client origin(s). Set CLIENT_ORIGIN to a comma-separated
// list of allowed origins in production (e.g. https://novapjm.netlify.app).
// If unset, all origins are allowed (convenient for local dev).
const allowedOrigins = (process.env.CLIENT_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
  })
);
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api', taskRoutes); // /api/projects/:id/tasks and /api/tasks/:id
app.use('/api', memberRoutes); // /api/projects/:id/members ...

// 404 for unknown API routes
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// --- Serve the built client (single-service deployment) ---
// If the client has been built into ../../client/dist, serve it and fall back
// to index.html for client-side routes. This lets the API and web app run as
// one service on a single URL (no CORS, no separate VITE_API_URL needed).
const clientDist = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // SPA fallback: any non-API GET returns index.html so React Router works.
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`[server] serving client build from ${clientDist}`);
}

// Central error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  // Malformed ObjectId in the URL/body -> treat as "not found".
  if (err.name === 'CastError') {
    return res.status(404).json({ error: 'Resource not found' });
  }
  // Mongoose schema validation failures.
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  // Duplicate key (e.g. email already registered).
  if (err.code === 11000) {
    return res.status(409).json({ error: 'Duplicate value' });
  }
  console.error('[error]', err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
