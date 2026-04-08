require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { getDb } = require('./database');
const { startMlccScheduler } = require('./scheduler/mlccScheduler');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toLocaleTimeString('en-US', { timeZone: 'America/Detroit' })}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  const db = getDb();
  const productCount = db.prepare('SELECT COUNT(*) as c FROM products').get().c;
  const saleCount    = db.prepare('SELECT COUNT(*) as c FROM sales').get().c;
  res.json({
    status: 'ok',
    store:  db.prepare("SELECT value FROM settings WHERE key='store_name'").get()?.value || 'Pick-N-Go',
    uptime: process.uptime(),
    products: productCount,
    sales:    saleCount,
    timestamp: new Date().toISOString(),
  });
});

// Routes
app.use('/api/products',   require('./routes/products'));
app.use('/api/sales',      require('./routes/sales'));
app.use('/api/promotions', require('./routes/promotions'));
app.use('/api/settings',   require('./routes/settings'));
app.use('/api/mlcc',       require('./routes/mlcc'));

// Serve frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: 'Internal server error', detail: err.message });
});

// Start
app.listen(PORT, () => {
  console.log(`\n🎉 Pick-N-Go POS Backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   API:    http://localhost:${PORT}/api\n`);
  getDb(); // warm up DB + run seed on first launch
  startMlccScheduler();
});

module.exports = app;
