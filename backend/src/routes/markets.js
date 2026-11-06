const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

/**
 * GET /api/markets
 * List all wholesale markets with active distributors count and status
 */
router.get('/', async (req, res) => {
  try {
    const markets = await db.query(`
      SELECT m.*, 
        (SELECT COUNT(*) FROM Distributors d WHERE d.market_id = m.market_id) as distributor_count,
        (SELECT COUNT(*) FROM MarketAnnouncements a WHERE a.market_id = m.market_id) as active_announcements_count
      FROM Markets m
      ORDER BY m.market_id ASC
    `);

    res.json({ success: true, markets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/markets/:id
 * Get single market details with distributors and announcements
 */
router.get('/:id', async (req, res) => {
  try {
    const market = await db.get('SELECT * FROM Markets WHERE market_id = ?', [req.params.id]);
    if (!market) {
      return res.status(404).json({ success: false, message: 'Market not found.' });
    }

    const announcements = await db.query(
      'SELECT * FROM MarketAnnouncements WHERE market_id = ? ORDER BY start_date DESC',
      [req.params.id]
    );

    // List distributors in this market (public view without phone number)
    const distributors = await db.query(`
      SELECT d.distributor_id, d.business_name, d.stall_number, d.business_description, d.verification_status,
             u.full_name as owner_name,
             (SELECT COUNT(*) FROM Deliveries del WHERE del.distributor_id = d.distributor_id AND del.delivery_status IN ('settled', 'paid')) as completed_deliveries
      FROM Distributors d
      JOIN Users u ON d.user_id = u.user_id
      WHERE d.market_id = ?
    `, [req.params.id]);

    res.json({
      success: true,
      market: {
        ...market,
        announcements,
        distributors
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/markets/:id/status
 * Admin update market status and operating hours
 */
router.put('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { current_status, opening_time, closing_time, description } = req.body;

    const validStatuses = ['open', 'closed', 'special_hours', 'temporarily_closed'];
    if (current_status && !validStatuses.includes(current_status)) {
      return res.status(400).json({ success: false, message: 'Invalid market status.' });
    }

    await db.run(`
      UPDATE Markets
      SET current_status = COALESCE(?, current_status),
          opening_time = COALESCE(?, opening_time),
          closing_time = COALESCE(?, closing_time),
          description = COALESCE(?, description)
      WHERE market_id = ?
    `, [current_status, opening_time, closing_time, description, req.params.id]);

    // If status changed to closed or special hours, broadcast notification to users
    if (current_status && current_status !== 'open') {
      const market = await db.get('SELECT market_name FROM Markets WHERE market_id = ?', [req.params.id]);
      const users = await db.query('SELECT user_id FROM Users');
      for (const u of users) {
        await db.run(`
          INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
          VALUES (?, ?, ?, 'market_announcement', 0)
        `, [u.user_id, `Market Status Update: ${market.market_name}`, `The operating status for ${market.market_name} is now ${current_status}. Opening hours: ${opening_time || 'Standard'}.`]);
      }
    }

    res.json({ success: true, message: 'Market operational status updated successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/markets/:id/announcements
 * Admin publishes market announcement
 */
router.post('/:id/announcements', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { title, description, announcement_type, start_date, end_date } = req.body;

    if (!title || !description || !start_date || !end_date) {
      return res.status(400).json({ success: false, message: 'Missing announcement parameters.' });
    }

    const result = await db.run(`
      INSERT INTO MarketAnnouncements (market_id, title, description, announcement_type, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [req.params.id, title, description, announcement_type || 'notice', start_date, end_date]);

    // Send notifications to all active suppliers and distributors
    const users = await db.query('SELECT user_id FROM Users WHERE role IN ("supplier", "distributor")');
    for (const u of users) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, ?, ?, 'market_announcement', 0)
      `, [u.user_id, `Announcement: ${title}`, description]);
    }

    res.status(201).json({ success: true, message: 'Market announcement published.', announcement_id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/markets/announcements/all
 * List all active announcements across all wholesale markets
 */
router.get('/announcements/all', async (req, res) => {
  try {
    const announcements = await db.query(`
      SELECT a.*, m.market_name, m.location
      FROM MarketAnnouncements a
      JOIN Markets m ON a.market_id = m.market_id
      ORDER BY a.start_date DESC
    `);
    res.json({ success: true, announcements });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
