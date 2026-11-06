const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/distributors
 * Browse available distributors filtered by market
 * Privacy protection: Phone numbers are NOT included in public browsing
 */
router.get('/', async (req, res) => {
  try {
    const { market_id } = req.query;

    let sql = `
      SELECT d.distributor_id, d.business_name, d.stall_number, d.business_description, d.verification_status,
             m.market_id, m.market_name, m.location as market_location,
             u.full_name as owner_name,
             (SELECT COUNT(*) FROM DistributorConnections dc WHERE dc.distributor_id = d.distributor_id AND dc.connection_status = 'active') as active_suppliers_count,
             (SELECT COUNT(*) FROM Deliveries del WHERE del.distributor_id = d.distributor_id AND del.delivery_status IN ('settled', 'paid')) as completed_deliveries,
             (SELECT COUNT(*) FROM Deliveries del WHERE del.distributor_id = d.distributor_id AND del.delivery_status = 'disputed') as dispute_count
      FROM Distributors d
      JOIN Markets m ON d.market_id = m.market_id
      JOIN Users u ON d.user_id = u.user_id
      WHERE u.account_status = 'active'
    `;
    const params = [];

    if (market_id) {
      sql += ' AND d.market_id = ?';
      params.push(market_id);
    }

    sql += ' ORDER BY d.distributor_id ASC';

    const distributors = await db.query(sql, params);
    res.json({ success: true, distributors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/distributors/:id
 * View single distributor profile
 */
router.get('/:id', async (req, res) => {
  try {
    const distributor = await db.get(`
      SELECT d.distributor_id, d.business_name, d.stall_number, d.business_description, d.verification_status,
             m.market_id, m.market_name, m.location as market_location, m.opening_time, m.closing_time, m.current_status as market_status,
             u.full_name as owner_name
      FROM Distributors d
      JOIN Markets m ON d.market_id = m.market_id
      JOIN Users u ON d.user_id = u.user_id
      WHERE d.distributor_id = ?
    `, [req.params.id]);

    if (!distributor) {
      return res.status(404).json({ success: false, message: 'Distributor not found.' });
    }

    res.json({ success: true, distributor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
