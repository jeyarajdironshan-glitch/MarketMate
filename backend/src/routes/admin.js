const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /api/admin/overview
 * Platform High-Level Statistics
 */
router.get('/overview', authenticate, authorize('admin'), async (req, res) => {
  try {
    const suppliersCount = await db.get('SELECT COUNT(*) as count FROM Suppliers');
    const distributorsCount = await db.get('SELECT COUNT(*) as count FROM Distributors');
    const marketsCount = await db.get('SELECT COUNT(*) as count FROM Markets');
    const activeConnections = await db.get('SELECT COUNT(*) as count FROM DistributorConnections WHERE connection_status = "active"');
    const pendingRequests = await db.get('SELECT COUNT(*) as count FROM DistributorRequests WHERE request_status NOT IN ("approved_and_connected", "rejected", "cancelled")');
    const totalDeliveries = await db.get('SELECT COUNT(*) as count FROM Deliveries');
    const pendingSettlements = await db.get('SELECT COUNT(*) as count FROM Deliveries WHERE delivery_status = "pending_review"');
    const disputedSettlements = await db.get('SELECT COUNT(*) as count FROM Deliveries WHERE delivery_status = "disputed"');
    const paymentStats = await db.get(`
      SELECT 
        SUM(CASE WHEN payment_status = 'completed' THEN amount ELSE 0 END) as total_paid_amount,
        SUM(CASE WHEN payment_status = 'pending' THEN amount ELSE 0 END) as total_pending_amount
      FROM Payments
    `);

    res.json({
      success: true,
      stats: {
        totalSuppliers: suppliersCount.count,
        totalDistributors: distributorsCount.count,
        totalMarkets: marketsCount.count,
        activeConnections: activeConnections.count,
        pendingConnectionRequests: pendingRequests.count,
        totalDeliveries: totalDeliveries.count,
        pendingSettlements: pendingSettlements.count,
        disputedSettlements: disputedSettlements.count,
        totalPaidAmount: paymentStats.total_paid_amount || 0,
        totalPendingAmount: paymentStats.total_pending_amount || 0
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/users
 * Manage supplier and distributor accounts
 */
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.query;
    let sql = `
      SELECT u.user_id, u.full_name, u.email, u.phone_number, u.role, u.preferred_language, u.account_status, u.created_at,
             s.supplier_id, s.business_name as farm_name, s.farm_location, s.primary_crop_types,
             d.distributor_id, d.business_name as distributor_business, d.stall_number, m.market_name
      FROM Users u
      LEFT JOIN Suppliers s ON u.user_id = s.user_id
      LEFT JOIN Distributors d ON u.user_id = d.user_id
      LEFT JOIN Markets m ON d.market_id = m.market_id
    `;
    const params = [];

    if (role) {
      sql += ' WHERE u.role = ?';
      params.push(role);
    }

    sql += ' ORDER BY u.user_id ASC';

    const users = await db.query(sql, params);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/admin/users/:id/status
 * Update user account status (active, suspended, inactive)
 */
router.put('/users/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { account_status } = req.body;
    if (!['active', 'inactive', 'suspended'].includes(account_status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    await db.run('UPDATE Users SET account_status = ? WHERE user_id = ?', [account_status, req.params.id]);
    res.json({ success: true, message: `User status updated to ${account_status}.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/admin/notifications
 * List platform announcements and system notifications
 */
router.get('/notifications', authenticate, authorize('admin'), async (req, res) => {
  try {
    const notifications = await db.query(`
      SELECT n.*, u.full_name, u.role
      FROM Notifications n
      JOIN Users u ON n.user_id = u.user_id
      ORDER BY n.created_at DESC
      LIMIT 50
    `);
    res.json({ success: true, notifications });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
