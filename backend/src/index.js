require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');

const db = require('./database/db');
const seed = require('./database/seed');
const { syncCBSLReports } = require('./services/cbslService');

// Route Handlers
const authRoutes = require('./routes/auth');
const marketsRoutes = require('./routes/markets');
const distributorsRoutes = require('./routes/distributors');
const connectionsRoutes = require('./routes/connections');
const deliveriesRoutes = require('./routes/deliveries');
const feedbackRoutes = require('./routes/feedback');
const paymentsRoutes = require('./routes/payments');
const reliabilityRoutes = require('./routes/reliability');
const cbslRoutes = require('./routes/cbsl');
const voiceRoutes = require('./routes/voice');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Uploads statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Serve Frontend production build if available
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'MarketMate AgriTech API',
    version: '1.0.0',
    dbType: db.getDbType(),
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/markets', marketsRoutes);
app.use('/api/distributors', distributorsRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/deliveries', deliveriesRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/reliability', reliabilityRoutes);
app.use('/api/cbsl', cbslRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/admin', adminRoutes);

// Fallback for single-page application routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) next();
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[MarketMate Error]:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

// Start Server and Initialize Background Jobs
async function startServer() {
  try {
    console.log('[MarketMate] Initializing database...');
    await db.initDatabase();
    await seed();

    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` MarketMate Backend Server is running on port ${PORT}`);
      console.log(` Health check: http://localhost:${PORT}/api/health`);
      console.log(` Database: ${db.getDbType().toUpperCase()}`);
      console.log(`====================================================`);
    });

    // Schedule CBSL price report checks every 2 hours (between 08:00 - 18:00)
    cron.schedule('0 8-18/2 * * *', async () => {
      console.log('[Cron Job] Executing scheduled CBSL price report check...');
      try {
        await syncCBSLReports(false);
      } catch (err) {
        console.error('[Cron Job Error]:', err.message);
      }
    });

  } catch (err) {
    console.error('[Server Startup Fatal Error]:', err);
    process.exit(1);
  }
}

startServer();
