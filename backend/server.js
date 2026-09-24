'use strict';

const path = require('node:path');
const express = require('express');

const authRoutes = require('./routes/auth');
const githubRoutes = require('./routes/github');
const favoritesRoutes = require('./routes/favorites');
const compareRoutes = require('./routes/compare');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Request log
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// Static frontend (same origin)
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Health
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/compare', compareRoutes);
app.use('/api', githubRoutes);

// JSON 404 for unknown /api/* routes
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error middleware
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  const status = err && Number.isInteger(err.status) ? err.status : 500;
  res.status(status).json({ error: err && err.message ? err.message : 'Internal server error' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`DevHub backend listening on :${PORT}`);
  });
}

module.exports = app;
