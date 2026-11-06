const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate } = require('../middleware/auth');

/**
 * GET /api/reliability/summary/:userId?
 * Dynamic verified reliability score and platform audit history
 */
router.get('/summary/:userId?', authenticate, async (req, res) => {
  try {
    const targetUserId = req.params.userId ? Number(req.params.userId) : req.user.user_id;

    // Check user role
    const user = await db.get('SELECT user_id, full_name, role, created_at FROM Users WHERE user_id = ?', [targetUserId]);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    let summary = {};
    let auditLog = [];

    if (user.role === 'supplier') {
      const supplier = await db.get('SELECT * FROM Suppliers WHERE user_id = ?', [targetUserId]);
      if (!supplier) return res.status(404).json({ success: false, message: 'Supplier profile not found.' });

      // Calculate Supplier Metrics from verified records
      const deliveryStats = await db.get(`
        SELECT 
          COUNT(*) as total_deliveries,
          SUM(CASE WHEN delivery_status IN ('settled', 'paid') THEN 1 ELSE 0 END) as completed_deliveries,
          SUM(CASE WHEN delivery_status = 'disputed' THEN 1 ELSE 0 END) as disputed_deliveries,
          SUM(quantity_sent) as total_quantity_sent,
          SUM(accepted_quantity) as total_quantity_accepted,
          SUM(damaged_quantity) as total_quantity_damaged
        FROM Deliveries
        WHERE supplier_id = ?
      `, [supplier.supplier_id]);

      // Calculate quality feedback distribution
      const qualityStats = await db.get(`
        SELECT 
          SUM(CASE WHEN pf.quality_status = 'Good' THEN 1 ELSE 0 END) as good_count,
          SUM(CASE WHEN pf.quality_status = 'Average' THEN 1 ELSE 0 END) as average_count,
          SUM(CASE WHEN pf.quality_status = 'Poor' THEN 1 ELSE 0 END) as poor_count
        FROM ProductFeedback pf
        JOIN Deliveries d ON pf.delivery_id = d.delivery_id
        WHERE d.supplier_id = ?
      `, [supplier.supplier_id]);

      const totalDeliveries = Number(deliveryStats.total_deliveries) || 0;
      const completed = Number(deliveryStats.completed_deliveries) || 0;
      const disputed = Number(deliveryStats.disputed_deliveries) || 0;
      const totalSent = Number(deliveryStats.total_quantity_sent) || 0;
      const totalAccepted = Number(deliveryStats.total_quantity_accepted) || 0;
      
      const acceptanceRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : '100.0';
      const completionRate = totalDeliveries > 0 ? ((completed / totalDeliveries) * 100).toFixed(1) : '100.0';

      summary = {
        role: 'supplier',
        businessName: supplier.business_name,
        totalDeliveries,
        completedDeliveries: completed,
        disputedDeliveries: disputed,
        acceptanceRate: Number(acceptanceRate),
        completionRate: Number(completionRate),
        qualityFeedback: {
          good: Number(qualityStats.good_count) || 0,
          average: Number(qualityStats.average_count) || 0,
          poor: Number(qualityStats.poor_count) || 0
        },
        trustLevel: disputed === 0 && completed >= 1 ? 'High (Verified)' : (disputed > 2 ? 'Needs Attention' : 'Good Standing')
      };

      // Retrieve verified audit log
      auditLog = await db.query(`
        SELECT rh.*, d.product_name, d.delivery_date
        FROM ReliabilityHistory rh
        LEFT JOIN Deliveries d ON rh.related_delivery_id = d.delivery_id
        WHERE rh.user_id = ?
        ORDER BY rh.created_at DESC
        LIMIT 20
      `, [targetUserId]);

    } else if (user.role === 'distributor') {
      const distributor = await db.get('SELECT * FROM Distributors WHERE user_id = ?', [targetUserId]);
      if (!distributor) return res.status(404).json({ success: false, message: 'Distributor profile not found.' });

      // Calculate Distributor Metrics from verified records
      const deliveryStats = await db.get(`
        SELECT 
          COUNT(*) as total_deliveries_received,
          SUM(CASE WHEN delivery_status IN ('settled', 'paid') THEN 1 ELSE 0 END) as completed_settlements,
          SUM(CASE WHEN delivery_status = 'pending_review' THEN 1 ELSE 0 END) as pending_settlements,
          SUM(CASE WHEN delivery_status = 'disputed' THEN 1 ELSE 0 END) as disputed_settlements
        FROM Deliveries
        WHERE distributor_id = ?
      `, [distributor.distributor_id]);

      // Calculate Payment promptness
      const paymentStats = await db.get(`
        SELECT 
          COUNT(*) as total_payments,
          SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
          SUM(CASE WHEN payment_status = 'pending' THEN 1 ELSE 0 END) as pending_payments,
          SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed_payments
        FROM Payments
        WHERE distributor_id = ?
      `, [distributor.distributor_id]);

      const totalReceived = Number(deliveryStats.total_deliveries_received) || 0;
      const completedSettlements = Number(deliveryStats.completed_settlements) || 0;
      const disputedSettlements = Number(deliveryStats.disputed_settlements) || 0;
      const completedPayments = Number(paymentStats.completed_payments) || 0;
      const pendingPayments = Number(paymentStats.pending_payments) || 0;

      const settlementRate = totalReceived > 0 ? ((completedSettlements / totalReceived) * 100).toFixed(1) : '100.0';

      summary = {
        role: 'distributor',
        businessName: distributor.business_name,
        stallNumber: distributor.stall_number,
        totalDeliveriesReceived: totalReceived,
        completedSettlements,
        pendingSettlements: Number(deliveryStats.pending_settlements) || 0,
        disputedSettlements,
        settlementRate: Number(settlementRate),
        payments: {
          completed: completedPayments,
          pending: pendingPayments,
          failed: Number(paymentStats.failed_payments) || 0
        },
        trustLevel: disputedSettlements === 0 && completedSettlements >= 1 ? 'High (Verified)' : (disputedSettlements > 2 ? 'Disputed History' : 'Good Standing')
      };

      auditLog = await db.query(`
        SELECT rh.*, d.product_name, d.delivery_date
        FROM ReliabilityHistory rh
        LEFT JOIN Deliveries d ON rh.related_delivery_id = d.delivery_id
        WHERE rh.user_id = ?
        ORDER BY rh.created_at DESC
        LIMIT 20
      `, [targetUserId]);
    }

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        fullName: user.full_name,
        role: user.role,
        memberSince: user.created_at
      },
      summary,
      auditLog
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
