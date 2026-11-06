const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');
const {
  prepareDeliveryPayment,
  completePayment,
  verifyPaymentNotification,
  PAYHERE_SANDBOX_URL
} = require('../services/payhereService');

/**
 * POST /api/payments/initiate
 * Distributor initiates PayHere checkout for a settled delivery
 */
router.post('/initiate', authenticate, authorize('distributor'), async (req, res) => {
  try {
    const { delivery_id } = req.body;
    if (!delivery_id) {
      return res.status(400).json({ success: false, message: 'Delivery ID is required.' });
    }

    const payload = await prepareDeliveryPayment(delivery_id, req.user.user_id);
    res.json({
      success: true,
      message: 'PayHere checkout initialized.',
      paymentData: payload
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/payments/payhere-notify
 * PayHere IPN Webhook Server-to-Server Callback
 */
router.post('/payhere-notify', async (req, res) => {
  try {
    console.log('[PayHere IPN] Received notification callback:', req.body);
    const { order_id, payment_id, status_code } = req.body;

    // Verify cryptographic signature
    const isValid = verifyPaymentNotification(req.body);
    if (!isValid) {
      console.error('[PayHere IPN] Invalid MD5 signature verification failed.');
      return res.status(400).send('Invalid signature');
    }

    // Status 2 = Success, 0 = Pending, -1 = Canceled, -2 = Failed
    if (String(status_code) === '2') {
      await completePayment(order_id, payment_id, 'payhere_sandbox');
      console.log(`[PayHere IPN] Order ${order_id} verified and settled successfully.`);
      return res.status(200).send('OK');
    } else {
      console.warn(`[PayHere IPN] Payment for order ${order_id} failed or pending with status code: ${status_code}`);
      await db.run('UPDATE Payments SET payment_status = "failed" WHERE transaction_reference = ?', [order_id]);
      return res.status(200).send('OK');
    }
  } catch (err) {
    console.error('[PayHere IPN Error]:', err);
    res.status(500).send(err.message);
  }
});

/**
 * POST /api/payments/sandbox-confirm
 * Sandbox simulation endpoint for testing payments directly from UI
 */
router.post('/sandbox-confirm', authenticate, authorize('distributor'), async (req, res) => {
  try {
    const { order_id, payment_id } = req.body;
    if (!order_id) {
      return res.status(400).json({ success: false, message: 'Order reference is required.' });
    }

    const result = await completePayment(order_id, payment_id || `SANDBOX-${Date.now()}`, 'payhere_sandbox');
    res.json({
      success: true,
      message: 'PayHere sandbox payment confirmed and settlement updated successfully!',
      result
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/payments/history
 * List payment transactions
 */
router.get('/history', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT p.*, d.product_name, d.accepted_quantity, d.agreed_price, d.delivery_date,
             s.business_name as supplier_name, su.full_name as supplier_contact,
             dist.business_name as distributor_name, du.full_name as distributor_contact
      FROM Payments p
      JOIN Deliveries d ON p.delivery_id = d.delivery_id
      JOIN Suppliers s ON p.supplier_id = s.supplier_id
      JOIN Users su ON s.user_id = su.user_id
      JOIN Distributors dist ON p.distributor_id = dist.distributor_id
      JOIN Users du ON dist.user_id = du.user_id
    `;
    const params = [];

    if (req.user.role === 'supplier') {
      sql += ' WHERE p.supplier_id = ?';
      params.push(req.supplier.supplier_id);
    } else if (req.user.role === 'distributor') {
      sql += ' WHERE p.distributor_id = ?';
      params.push(req.distributor.distributor_id);
    }

    sql += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    const payments = await db.query(sql, params);

    // Compute summary metrics
    let totalPaid = 0;
    let totalPending = 0;
    for (const p of payments) {
      if (p.payment_status === 'completed') {
        totalPaid += Number(p.amount);
      } else if (p.payment_status === 'pending') {
        totalPending += Number(p.amount);
      }
    }

    res.json({
      success: true,
      summary: {
        totalPaid,
        totalPending,
        totalTransactions: payments.length
      },
      payments
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
