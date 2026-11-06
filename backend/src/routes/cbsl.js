const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const {
  getLatestPrices,
  syncCBSLReports,
  updatePriceRecord,
  getSyncState,
  CBSL_OFFICIAL_CATALOG
} = require('../services/cbslService');

/**
 * GET /api/cbsl/latest
 * Get latest CBSL vegetable and fruit price reports
 */
router.get('/latest', async (req, res) => {
  try {
    const { market } = req.query;
    const data = await getLatestPrices(market);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/cbsl/history
 * Historical price trends for charts
 */
router.get('/history', async (req, res) => {
  try {
    const { product, market } = req.query;
    const productName = product || 'Tomato';
    const marketName = market || 'Dambulla';

    const history = await db.query(`
      SELECT vp.price, vp.created_at, cr.report_date, vp.market_name
      FROM VegetablePrices vp
      JOIN CBSLPriceReports cr ON vp.report_id = cr.report_id
      WHERE vp.product_name = ? AND vp.market_name LIKE ?
      ORDER BY cr.report_date ASC
      LIMIT 14
    `, [productName, `%${marketName}%`]);

    res.json({
      success: true,
      product: productName,
      market: marketName,
      history
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/cbsl/sync
 * Trigger manual or scheduled CBSL price report check
 */
router.post('/sync', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await syncCBSLReports(true);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/cbsl/status
 * Get synchronization state and official publication metadata
 */
router.get('/status', async (req, res) => {
  try {
    const latestReport = await db.get('SELECT * FROM CBSLPriceReports ORDER BY report_date DESC LIMIT 1');
    const state = getSyncState();
    res.json({
      success: true,
      syncState: {
        ...state,
        activeReportDate: latestReport ? latestReport.report_date : '2026-11-05',
        sourceName: 'Central Bank of Sri Lanka (CBSL)',
        officialSourceUrl: latestReport ? latestReport.source_url : 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report'
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/cbsl/admin/reports
 * Admin view all CBSL price reports and extraction status
 */
router.get('/admin/reports', authenticate, authorize('admin'), async (req, res) => {
  try {
    const reports = await db.query(`
      SELECT cr.*, 
             (SELECT COUNT(*) FROM VegetablePrices vp WHERE vp.report_id = cr.report_id) as total_prices_extracted
      FROM CBSLPriceReports cr
      ORDER BY cr.report_date DESC
    `);
    res.json({ success: true, reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/cbsl/admin/update-price/:priceId
 * Admin corrects or edits an extracted price before publishing
 */
router.put('/admin/update-price/:priceId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await updatePriceRecord(req.params.priceId, req.body);
    res.json({ success: true, message: 'Price record verified and updated.', ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/cbsl/alerts
 * Supplier price alerts feed
 */
router.get('/alerts', authenticate, authorize('supplier'), async (req, res) => {
  try {
    const alerts = await db.query(`
      SELECT pa.*, cr.report_date, vp.market_name
      FROM PriceAlerts pa
      JOIN VegetablePrices vp ON pa.price_id = vp.price_id
      JOIN CBSLPriceReports cr ON vp.report_id = cr.report_id
      WHERE pa.supplier_id = ?
      ORDER BY pa.created_at DESC
    `, [req.supplier.supplier_id]);

    res.json({ success: true, alerts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/cbsl/alerts/:id/read
 * Mark alert as read
 */
router.put('/alerts/:id/read', authenticate, authorize('supplier'), async (req, res) => {
  try {
    await db.run('UPDATE PriceAlerts SET is_read = 1 WHERE alert_id = ? AND supplier_id = ?', [req.params.id, req.supplier.supplier_id]);
    res.json({ success: true, message: 'Alert marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
