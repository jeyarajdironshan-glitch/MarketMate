const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /api/deliveries
 * List deliveries for current user (Supplier, Distributor, or Admin)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    let sql = `
      SELECT d.*, 
             s.business_name as supplier_name, su.full_name as supplier_contact,
             dist.business_name as distributor_name, du.full_name as distributor_contact,
             m.market_name,
             dsc.supplier_confirmation, dsc.distributor_confirmation, dsc.settlement_status, dsc.dispute_reason,
             pf.quality_status, pf.image_url as feedback_image, pf.comments as feedback_comments,
             p.payment_status, p.transaction_reference, p.payment_date
      FROM Deliveries d
      JOIN Suppliers s ON d.supplier_id = s.supplier_id
      JOIN Users su ON s.user_id = su.user_id
      JOIN Distributors dist ON d.distributor_id = dist.distributor_id
      JOIN Users du ON dist.user_id = du.user_id
      JOIN Markets m ON dist.market_id = m.market_id
      LEFT JOIN DeliverySettlementConfirmations dsc ON d.delivery_id = dsc.delivery_id
      LEFT JOIN ProductFeedback pf ON d.delivery_id = pf.delivery_id
      LEFT JOIN Payments p ON d.delivery_id = p.delivery_id
    `;
    const params = [];

    if (req.user.role === 'supplier') {
      sql += ' WHERE d.supplier_id = ?';
      params.push(req.supplier.supplier_id);
    } else if (req.user.role === 'distributor') {
      sql += ' WHERE d.distributor_id = ?';
      params.push(req.distributor.distributor_id);
    }

    sql += ' ORDER BY d.delivery_date DESC, d.delivery_id DESC';

    const deliveries = await db.query(sql, params);
    res.json({ success: true, deliveries });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/deliveries/:id
 * Single Delivery Settlement Slip Details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const delivery = await db.get(`
      SELECT d.*, 
             s.business_name as supplier_name, su.full_name as supplier_contact, su.phone_number as supplier_phone,
             dist.business_name as distributor_name, dist.stall_number, du.full_name as distributor_contact, du.phone_number as distributor_phone,
             m.market_name, m.location as market_location,
             dsc.confirmation_id, dsc.supplier_confirmation, dsc.distributor_confirmation, dsc.supplier_confirmed_at, dsc.distributor_confirmed_at, dsc.settlement_status, dsc.dispute_reason,
             pf.quality_status, pf.image_url as feedback_image, pf.comments as feedback_comments,
             p.payment_id, p.payment_status, p.transaction_reference, p.payment_date
      FROM Deliveries d
      JOIN Suppliers s ON d.supplier_id = s.supplier_id
      JOIN Users su ON s.user_id = su.user_id
      JOIN Distributors dist ON d.distributor_id = dist.distributor_id
      JOIN Users du ON dist.user_id = du.user_id
      JOIN Markets m ON dist.market_id = m.market_id
      LEFT JOIN DeliverySettlementConfirmations dsc ON d.delivery_id = dsc.delivery_id
      LEFT JOIN ProductFeedback pf ON d.delivery_id = pf.delivery_id
      LEFT JOIN Payments p ON d.delivery_id = p.delivery_id
      WHERE d.delivery_id = ?
    `, [req.params.id]);

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery record not found.' });
    }

    // Role security check
    if (req.user.role === 'supplier' && delivery.supplier_id !== req.supplier.supplier_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }
    if (req.user.role === 'distributor' && delivery.distributor_id !== req.distributor.distributor_id) {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    res.json({ success: true, delivery });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/deliveries/create
 * Distributor records a new incoming delivery and generates Digital Settlement Slip
 */
router.post('/create', authenticate, authorize('distributor'), async (req, res) => {
  try {
    const {
      supplier_id,
      product_name,
      delivery_date,
      quantity_sent,
      quantity_received,
      damaged_quantity = 0,
      rejected_quantity = 0,
      agreed_price,
      notes
    } = req.body;

    const distributor = req.distributor;

    // 1. Mandatory Fields Validation
    if (!supplier_id || !product_name || !delivery_date || quantity_sent === undefined || quantity_received === undefined || agreed_price === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required delivery settlement fields.' });
    }

    const sent = Number(quantity_sent);
    const received = Number(quantity_received);
    const damaged = Number(damaged_quantity) || 0;
    const rejected = Number(rejected_quantity) || 0;
    const price = Number(agreed_price);

    // 2. Mathematical & Logical Validations (Prevent negative and incorrect calculations)
    if (sent <= 0 || received < 0 || damaged < 0 || rejected < 0 || price <= 0) {
      return res.status(400).json({ success: false, message: 'Quantities and agreed price must be valid positive values.' });
    }

    if ((damaged + rejected) > received) {
      return res.status(400).json({
        success: false,
        message: 'Damaged and rejected quantities combined cannot exceed the total quantity received.'
      });
    }

    // Calculate accepted quantity: Quantity Received - Damaged Quantity - Rejected Quantity
    const accepted = received - damaged - rejected;
    if (accepted < 0) {
      return res.status(400).json({ success: false, message: 'Calculated accepted quantity cannot be negative.' });
    }

    // Calculate total payable amount: Accepted Quantity * Agreed Price
    const totalAmount = Number((accepted * price).toFixed(2));

    // Verify active connection between this distributor and supplier
    const connection = await db.get(`
      SELECT connection_id FROM DistributorConnections 
      WHERE supplier_id = ? AND distributor_id = ? AND connection_status = 'active'
    `, [supplier_id, distributor.distributor_id]);

    if (!connection) {
      return res.status(400).json({
        success: false,
        message: 'You can only create delivery settlement slips for officially connected suppliers.'
      });
    }

    // Create Delivery Record
    const deliveryResult = await db.run(`
      INSERT INTO Deliveries (supplier_id, distributor_id, product_name, delivery_date, quantity_sent, quantity_received, damaged_quantity, rejected_quantity, accepted_quantity, agreed_price, total_amount, delivery_status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)
    `, [supplier_id, distributor.distributor_id, product_name.trim(), delivery_date, sent, received, damaged, rejected, accepted, price, totalAmount, notes || '']);

    const deliveryId = deliveryResult.insertId;

    // Create Mutual Settlement Confirmation record (Distributor marked confirmed, supplier pending)
    await db.run(`
      INSERT INTO DeliverySettlementConfirmations (delivery_id, supplier_confirmation, distributor_confirmation, distributor_confirmed_at, settlement_status)
      VALUES (?, 0, 1, CURRENT_TIMESTAMP, 'pending')
    `, [deliveryId]);

    // Send notification to supplier
    const supp = await db.get('SELECT user_id FROM Suppliers WHERE supplier_id = ?', [supplier_id]);
    if (supp) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, 'Digital Settlement Slip Generated', ?, 'delivery_update', 0)
      `, [supp.user_id, `Distributor created settlement slip for ${product_name} (${accepted} kg accepted @ Rs. ${price}/kg = Rs. ${totalAmount.toLocaleString()}). Please review and confirm.`]);
    }

    res.status(201).json({
      success: true,
      message: 'Digital delivery settlement slip created successfully. Awaiting supplier confirmation.',
      deliveryId,
      calculated: {
        accepted_quantity: accepted,
        total_amount: totalAmount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/deliveries/:id/confirm
 * Supplier mutually confirms the Digital Settlement Slip
 */
router.put('/:id/confirm', authenticate, authorize('supplier'), async (req, res) => {
  try {
    const delivery = await db.get('SELECT * FROM Deliveries WHERE delivery_id = ?', [req.params.id]);
    if (!delivery || delivery.supplier_id !== req.supplier.supplier_id) {
      return res.status(404).json({ success: false, message: 'Delivery record not found or access denied.' });
    }

    // Update confirmation record to mutually confirmed
    await db.run(`
      UPDATE DeliverySettlementConfirmations
      SET supplier_confirmation = 1,
          supplier_confirmed_at = CURRENT_TIMESTAMP,
          settlement_status = 'mutually_confirmed',
          dispute_reason = NULL
      WHERE delivery_id = ?
    `, [req.params.id]);

    // Update delivery status to 'settled'
    await db.run(`
      UPDATE Deliveries
      SET delivery_status = 'settled'
      WHERE delivery_id = ?
    `, [req.params.id]);

    // Record verified transaction in Reliability History
    await db.run(`
      INSERT INTO ReliabilityHistory (user_id, related_delivery_id, activity_type, description, verified_status)
      VALUES (?, ?, 'settlement_confirmed', ?, 1)
    `, [req.user.user_id, req.params.id, `Mutually confirmed delivery settlement slip for ${delivery.product_name} (${delivery.accepted_quantity} kg).`]);

    // Notify distributor
    const dist = await db.get('SELECT user_id FROM Distributors WHERE distributor_id = ?', [delivery.distributor_id]);
    if (dist) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, 'Settlement Slip Confirmed!', ?, 'settlement_update', 0)
      `, [dist.user_id, `Supplier confirmed settlement for Delivery #${delivery.delivery_id} (${delivery.product_name}). Total payable: Rs. ${delivery.total_amount}.`]);
    }

    res.json({
      success: true,
      message: 'Delivery settlement mutually confirmed! Ready for payment processing.',
      status: 'mutually_confirmed'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/deliveries/:id/dispute
 * Supplier disputes delivery slip calculations or damage claims
 */
router.put('/:id/dispute', authenticate, authorize('supplier'), async (req, res) => {
  try {
    const { dispute_reason } = req.body;
    if (!dispute_reason) {
      return res.status(400).json({ success: false, message: 'Please provide a clear dispute reason.' });
    }

    const delivery = await db.get('SELECT * FROM Deliveries WHERE delivery_id = ?', [req.params.id]);
    if (!delivery || delivery.supplier_id !== req.supplier.supplier_id) {
      return res.status(404).json({ success: false, message: 'Delivery record not found or access denied.' });
    }

    // Mark as disputed
    await db.run(`
      UPDATE DeliverySettlementConfirmations
      SET settlement_status = 'disputed',
          dispute_reason = ?
      WHERE delivery_id = ?
    `, [dispute_reason, req.params.id]);

    await db.run(`
      UPDATE Deliveries
      SET delivery_status = 'disputed'
      WHERE delivery_id = ?
    `, [req.params.id]);

    // Record in Reliability History
    await db.run(`
      INSERT INTO ReliabilityHistory (user_id, related_delivery_id, activity_type, description, verified_status)
      VALUES (?, ?, 'delivery_disputed', ?, 1)
    `, [req.user.user_id, req.params.id, `Dispute logged for delivery #${delivery.delivery_id}: ${dispute_reason}`]);

    // Notify distributor
    const dist = await db.get('SELECT user_id FROM Distributors WHERE distributor_id = ?', [delivery.distributor_id]);
    if (dist) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, 'Delivery Settlement Disputed', ?, 'delivery_update', 0)
      `, [dist.user_id, `Supplier has disputed settlement slip for Delivery #${delivery.delivery_id}: "${dispute_reason}". Please discuss and adjust.`]);
    }

    res.json({
      success: true,
      message: 'Settlement marked as disputed. Record held transparently until resolved.',
      status: 'disputed'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
