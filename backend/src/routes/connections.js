const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /api/connections/my-connection
 * Get the currently logged in supplier's active distributor or logged in distributor's connected suppliers
 */
router.get('/my-connection', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'supplier') {
      const supplier = req.supplier;
      if (!supplier) {
        return res.status(404).json({ success: false, message: 'Supplier profile not found.' });
      }

      // Check for active connection
      const activeConnection = await db.get(`
        SELECT dc.*, d.business_name as distributor_name, d.stall_number, d.business_description,
               m.market_id, m.market_name, m.location as market_location, m.opening_time, m.closing_time, m.current_status as market_status,
               u.full_name as contact_person, u.phone_number, u.email
        FROM DistributorConnections dc
        JOIN Distributors d ON dc.distributor_id = d.distributor_id
        JOIN Markets m ON d.market_id = m.market_id
        JOIN Users u ON d.user_id = u.user_id
        WHERE dc.supplier_id = ? AND dc.connection_status = 'active'
      `, [supplier.supplier_id]);

      // Check for any pending or in-progress request
      const activeRequest = await db.get(`
        SELECT dr.*, d.business_name as proposed_distributor_name, d.stall_number,
               m.market_name,
               CASE 
                 WHEN dr.request_status IN ('contact_details_shared', 'discussion_in_progress', 'awaiting_supplier_confirmation', 'awaiting_distributor_confirmation', 'awaiting_admin_verification', 'approved_and_connected') 
                 THEN u.phone_number 
                 ELSE 'Hidden until admin facilitates contact sharing' 
               END as distributor_phone,
               CASE 
                 WHEN dr.request_status IN ('contact_details_shared', 'discussion_in_progress', 'awaiting_supplier_confirmation', 'awaiting_distributor_confirmation', 'awaiting_admin_verification', 'approved_and_connected') 
                 THEN u.email 
                 ELSE 'Hidden' 
               END as distributor_email
        FROM DistributorRequests dr
        JOIN Distributors d ON dr.distributor_id = d.distributor_id
        JOIN Markets m ON d.market_id = m.market_id
        JOIN Users u ON d.user_id = u.user_id
        WHERE dr.supplier_id = ? AND dr.request_status NOT IN ('rejected', 'cancelled')
        ORDER BY dr.created_at DESC
        LIMIT 1
      `, [supplier.supplier_id]);

      return res.json({
        success: true,
        hasActiveConnection: !!activeConnection,
        activeConnection: activeConnection || null,
        activeRequest: activeRequest || null
      });
    }

    if (req.user.role === 'distributor') {
      const distributor = req.distributor;
      if (!distributor) {
        return res.status(404).json({ success: false, message: 'Distributor profile not found.' });
      }

      // Get connected suppliers
      const connectedSuppliers = await db.query(`
        SELECT dc.*, s.supplier_id, s.business_name as farm_name, s.farm_location, s.primary_crop_types,
               u.full_name as supplier_name, u.phone_number, u.email,
               (SELECT COUNT(*) FROM Deliveries del WHERE del.supplier_id = s.supplier_id AND del.distributor_id = dc.distributor_id) as total_deliveries,
               (SELECT COUNT(*) FROM Deliveries del WHERE del.supplier_id = s.supplier_id AND del.distributor_id = dc.distributor_id AND del.delivery_status = 'pending_review') as pending_deliveries
        FROM DistributorConnections dc
        JOIN Suppliers s ON dc.supplier_id = s.supplier_id
        JOIN Users u ON s.user_id = u.user_id
        WHERE dc.distributor_id = ? AND dc.connection_status = 'active'
        ORDER BY dc.start_date DESC
      `, [distributor.distributor_id]);

      // Get incoming connection requests for this distributor
      const incomingRequests = await db.query(`
        SELECT dr.*, s.business_name as farm_name, s.farm_location, s.primary_crop_types,
               u.full_name as supplier_name,
               CASE 
                 WHEN dr.request_status IN ('contact_details_shared', 'discussion_in_progress', 'awaiting_supplier_confirmation', 'awaiting_distributor_confirmation', 'awaiting_admin_verification', 'approved_and_connected') 
                 THEN u.phone_number 
                 ELSE 'Hidden until admin facilitates contact sharing' 
               END as supplier_phone,
               CASE 
                 WHEN dr.request_status IN ('contact_details_shared', 'discussion_in_progress', 'awaiting_supplier_confirmation', 'awaiting_distributor_confirmation', 'awaiting_admin_verification', 'approved_and_connected') 
                 THEN u.email 
                 ELSE 'Hidden' 
               END as supplier_email
        FROM DistributorRequests dr
        JOIN Suppliers s ON dr.supplier_id = s.supplier_id
        JOIN Users u ON s.user_id = u.user_id
        WHERE dr.distributor_id = ? AND dr.request_status NOT IN ('rejected', 'cancelled')
        ORDER BY dr.created_at DESC
      `, [distributor.distributor_id]);

      return res.json({
        success: true,
        connectedSuppliers,
        incomingRequests
      });
    }

    res.status(400).json({ success: false, message: 'Invalid role for connection inquiry.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/connections/request
 * Supplier initiates a connection request with a chosen distributor
 */
router.post('/request', authenticate, authorize('supplier'), async (req, res) => {
  try {
    const { distributor_id, notes } = req.body;
    const supplier = req.supplier;

    if (!distributor_id) {
      return res.status(400).json({ success: false, message: 'Please select a distributor.' });
    }

    // Rule: Supplier cannot have multiple active connections
    const existingActive = await db.get(
      'SELECT * FROM DistributorConnections WHERE supplier_id = ? AND connection_status = "active"',
      [supplier.supplier_id]
    );

    if (existingActive) {
      return res.status(400).json({
        success: false,
        message: 'You already have an active distributor connection. Please use the "Change Distributor" request workflow instead.'
      });
    }

    // Check if supplier already has a pending connection request
    const existingRequest = await db.get(
      'SELECT * FROM DistributorRequests WHERE supplier_id = ? AND request_status NOT IN ("approved_and_connected", "rejected", "cancelled")',
      [supplier.supplier_id]
    );

    if (existingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have an ongoing connection request under review.'
      });
    }

    // Verify distributor exists
    const distributor = await db.get('SELECT * FROM Distributors WHERE distributor_id = ?', [distributor_id]);
    if (!distributor) {
      return res.status(404).json({ success: false, message: 'Selected distributor not found.' });
    }

    // Create Connection Request with initial status 'pending_admin_review'
    const result = await db.run(`
      INSERT INTO DistributorRequests (supplier_id, distributor_id, request_type, request_status, admin_notes)
      VALUES (?, ?, 'initial', 'pending_admin_review', ?)
    `, [supplier.supplier_id, distributor_id, notes || 'Initial supplier connection request submitted.']);

    // Notify Administrator
    const admins = await db.query('SELECT user_id FROM Users WHERE role = "admin"');
    for (const a of admins) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, 'New Connection Request', ?, 'connection_update', 0)
      `, [a.user_id, `Supplier ${supplier.business_name} has requested connection with distributor ${distributor.business_name}. Review required.`]);
    }

    res.status(201).json({
      success: true,
      message: 'Connection request submitted to administration for review.',
      requestId: result.insertId,
      status: 'pending_admin_review'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/connections/change-request
 * Supplier requests to change their active distributor
 */
router.post('/change-request', authenticate, authorize('supplier'), async (req, res) => {
  try {
    const { proposed_distributor_id, reason } = req.body;
    const supplier = req.supplier;

    if (!proposed_distributor_id) {
      return res.status(400).json({ success: false, message: 'Please select the proposed new distributor.' });
    }

    const currentConnection = await db.get(
      'SELECT * FROM DistributorConnections WHERE supplier_id = ? AND connection_status = "active"',
      [supplier.supplier_id]
    );

    if (!currentConnection) {
      return res.status(400).json({
        success: false,
        message: 'You do not have an active distributor to change from. Please submit a standard connection request.'
      });
    }

    if (currentConnection.distributor_id === Number(proposed_distributor_id)) {
      return res.status(400).json({
        success: false,
        message: 'Proposed distributor is identical to your current connected distributor.'
      });
    }

    // Create change request
    const result = await db.run(`
      INSERT INTO DistributorRequests (supplier_id, distributor_id, request_type, request_status, admin_notes)
      VALUES (?, ?, 'change', 'pending_admin_review', ?)
    `, [supplier.supplier_id, proposed_distributor_id, `Change Request Reason: ${reason || 'Supplier requested distributor migration.'}`]);

    // Notify Admin
    const admins = await db.query('SELECT user_id FROM Users WHERE role = "admin"');
    for (const a of admins) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, 'Distributor Change Request', ?, 'connection_update', 0)
      `, [a.user_id, `Supplier ${supplier.business_name} requested to migrate distributors. Admin review required.`]);
    }

    res.status(201).json({
      success: true,
      message: 'Distributor change request submitted for administrative review.',
      requestId: result.insertId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/connections/admin/share-contact/:requestId
 * Admin reviews request and facilitates contact sharing between parties
 */
router.put('/admin/share-contact/:requestId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { admin_notes } = req.body;
    const request = await db.get('SELECT * FROM DistributorRequests WHERE request_id = ?', [req.params.requestId]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    await db.run(`
      UPDATE DistributorRequests
      SET request_status = 'contact_details_shared',
          admin_notes = COALESCE(?, admin_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [admin_notes || 'Contact details shared with mutual consent by Administrator. Parties may now communicate.', req.params.requestId]);

    // Notify supplier and distributor
    const supp = await db.get('SELECT user_id FROM Suppliers WHERE supplier_id = ?', [request.supplier_id]);
    const dist = await db.get('SELECT user_id FROM Distributors WHERE distributor_id = ?', [request.distributor_id]);

    await db.run(`
      INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
      VALUES (?, 'Contact Details Shared', 'Administrator has shared contact details. You may now call the distributor to discuss commercial terms.', 'connection_update', 0)
    `, [supp.user_id]);

    await db.run(`
      INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
      VALUES (?, 'New Supplier Contact Facilitated', 'Administrator has shared supplier contact details for discussion.', 'connection_update', 0)
    `, [dist.user_id]);

    res.json({ success: true, message: 'Contact details shared with both parties. Discussion in progress.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/connections/confirm-supplier/:requestId
 * Supplier confirms agreement after commercial discussion
 */
router.put('/confirm-supplier/:requestId', authenticate, authorize('supplier'), async (req, res) => {
  try {
    const request = await db.get('SELECT * FROM DistributorRequests WHERE request_id = ?', [req.params.requestId]);
    if (!request || request.supplier_id !== req.supplier.supplier_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized or invalid request.' });
    }

    const nextStatus = request.distributor_confirmed === 1 ? 'awaiting_admin_verification' : 'awaiting_distributor_confirmation';

    await db.run(`
      UPDATE DistributorRequests
      SET supplier_confirmed = 1,
          request_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [nextStatus, req.params.requestId]);

    res.json({
      success: true,
      message: 'Agreement confirmed by supplier.',
      status: nextStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/connections/confirm-distributor/:requestId
 * Distributor confirms agreement after commercial discussion
 */
router.put('/confirm-distributor/:requestId', authenticate, authorize('distributor'), async (req, res) => {
  try {
    const request = await db.get('SELECT * FROM DistributorRequests WHERE request_id = ?', [req.params.requestId]);
    if (!request || request.distributor_id !== req.distributor.distributor_id) {
      return res.status(403).json({ success: false, message: 'Unauthorized or invalid request.' });
    }

    const nextStatus = request.supplier_confirmed === 1 ? 'awaiting_admin_verification' : 'awaiting_supplier_confirmation';

    await db.run(`
      UPDATE DistributorRequests
      SET distributor_confirmed = 1,
          request_status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [nextStatus, req.params.requestId]);

    res.json({
      success: true,
      message: 'Agreement confirmed by distributor.',
      status: nextStatus
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/connections/admin/verify-and-activate/:requestId
 * Admin verifies mutual confirmations and activates official connection
 * Enforces rule: Exactly one active distributor per supplier!
 */
router.put('/admin/verify-and-activate/:requestId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const request = await db.get('SELECT * FROM DistributorRequests WHERE request_id = ?', [req.params.requestId]);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    if (request.supplier_confirmed !== 1 || request.distributor_confirmed !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Both supplier and distributor must confirm agreement before activation.'
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    // Rule: Close any existing active connection for this supplier
    await db.run(`
      UPDATE DistributorConnections
      SET connection_status = 'terminated', end_date = ?
      WHERE supplier_id = ? AND connection_status = 'active'
    `, [today, request.supplier_id]);

    // Create new active connection
    const connResult = await db.run(`
      INSERT INTO DistributorConnections (supplier_id, distributor_id, connection_status, start_date, activated_by, request_id)
      VALUES (?, ?, 'active', ?, ?, ?)
    `, [request.supplier_id, request.distributor_id, today, req.user.user_id, request.request_id]);

    // Update request status to 'approved_and_connected'
    await db.run(`
      UPDATE DistributorRequests
      SET request_status = 'approved_and_connected', updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [request.request_id]);

    // Notify both parties
    const supp = await db.get('SELECT user_id FROM Suppliers WHERE supplier_id = ?', [request.supplier_id]);
    const dist = await db.get('SELECT user_id FROM Distributors WHERE distributor_id = ?', [request.distributor_id]);

    await db.run(`
      INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
      VALUES (?, 'Official Connection Activated!', 'Your partnership is now officially activated by MarketMate Administrator. You can now manage deliveries and settlements.', 'connection_update', 0)
    `, [supp.user_id]);

    await db.run(`
      INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
      VALUES (?, 'Official Supplier Connected!', 'Connection officially activated by Administrator. You may now record incoming deliveries.', 'connection_update', 0)
    `, [dist.user_id]);

    res.json({
      success: true,
      message: 'Connection verified and activated successfully. Supplier now has one active distributor.',
      connectionId: connResult.insertId
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/connections/admin/reject/:requestId
 * Admin rejects connection request
 */
router.put('/admin/reject/:requestId', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    await db.run(`
      UPDATE DistributorRequests
      SET request_status = 'rejected', admin_notes = ?, updated_at = CURRENT_TIMESTAMP
      WHERE request_id = ?
    `, [reason || 'Request rejected by Administrator.', req.params.requestId]);

    res.json({ success: true, message: 'Request rejected.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/connections/admin/all-requests
 * Admin view all connection requests with workflow tracking
 */
router.get('/admin/all-requests', authenticate, authorize('admin'), async (req, res) => {
  try {
    const requests = await db.query(`
      SELECT dr.*,
             s.business_name as supplier_name, su.full_name as supplier_contact, su.phone_number as supplier_phone,
             d.business_name as distributor_name, du.full_name as distributor_contact, du.phone_number as distributor_phone,
             m.market_name
      FROM DistributorRequests dr
      JOIN Suppliers s ON dr.supplier_id = s.supplier_id
      JOIN Users su ON s.user_id = su.user_id
      JOIN Distributors d ON dr.distributor_id = d.distributor_id
      JOIN Users du ON d.user_id = du.user_id
      JOIN Markets m ON d.market_id = m.market_id
      ORDER BY dr.created_at DESC
    `);
    res.json({ success: true, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
