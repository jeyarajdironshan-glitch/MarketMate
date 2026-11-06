const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database/db');
const { authenticate, authorize } = require('../middleware/auth');

// Setup upload folder for product quality evidence photos
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const unique = `${Date.now()}-${Math.round(Math.random() * 1E6)}${ext}`;
    cb(null, unique);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed.'));
  }
});

/**
 * POST /api/feedback
 * Distributor submits product quality feedback connected to delivery
 */
router.post('/', authenticate, authorize('distributor'), upload.single('photo'), async (req, res) => {
  try {
    const { delivery_id, quality_status, comments, image_url_input } = req.body;
    const distributor = req.distributor;

    if (!delivery_id || !quality_status) {
      return res.status(400).json({ success: false, message: 'Delivery ID and quality status are required.' });
    }

    if (!['Good', 'Average', 'Poor'].includes(quality_status)) {
      return res.status(400).json({ success: false, message: 'Quality status must be Good, Average, or Poor.' });
    }

    // Determine photo URL
    let imageUrl = image_url_input || '';
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }

    // Default fallback image if none provided
    if (!imageUrl) {
      if (quality_status === 'Good') {
        imageUrl = 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800';
      } else if (quality_status === 'Average') {
        imageUrl = 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800';
      } else {
        imageUrl = 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=800';
      }
    }

    // Verify delivery belongs to this distributor
    const delivery = await db.get(
      'SELECT * FROM Deliveries WHERE delivery_id = ? AND distributor_id = ?',
      [delivery_id, distributor.distributor_id]
    );

    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Delivery not found or unauthorized.' });
    }

    // Check if feedback already exists
    const existing = await db.get('SELECT feedback_id FROM ProductFeedback WHERE delivery_id = ?', [delivery_id]);
    let feedbackId;

    if (existing) {
      await db.run(`
        UPDATE ProductFeedback
        SET quality_status = ?, comments = ?, image_url = ?, created_at = CURRENT_TIMESTAMP
        WHERE feedback_id = ?
      `, [quality_status, comments || '', imageUrl, existing.feedback_id]);
      feedbackId = existing.feedback_id;
    } else {
      const result = await db.run(`
        INSERT INTO ProductFeedback (delivery_id, distributor_id, quality_status, comments, image_url)
        VALUES (?, ?, ?, ?, ?)
      `, [delivery_id, distributor.distributor_id, quality_status, comments || '', imageUrl]);
      feedbackId = result.insertId;
    }

    // Add activity record to Reliability History
    const activityMap = {
      'Good': 'quality_rated_good',
      'Average': 'quality_rated_average',
      'Poor': 'quality_rated_poor'
    };
    await db.run(`
      INSERT INTO ReliabilityHistory (user_id, related_delivery_id, activity_type, description, verified_status)
      VALUES (?, ?, ?, ?, 1)
    `, [req.user.user_id, delivery_id, activityMap[quality_status], `Assessed batch quality as ${quality_status} for ${delivery.product_name}. Notes: ${comments || 'None'}`]);

    // Notify supplier
    const supplier = await db.get('SELECT user_id FROM Suppliers WHERE supplier_id = ?', [delivery.supplier_id]);
    if (supplier) {
      await db.run(`
        INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
        VALUES (?, 'Product Quality Feedback Received', ?, 'delivery_update', 0)
      `, [supplier.user_id, `Distributor reviewed quality of ${delivery.product_name} as "${quality_status}". Photo evidence and notes added.`]);
    }

    res.status(201).json({
      success: true,
      message: 'Product quality feedback and photographic evidence submitted successfully.',
      feedbackId,
      imageUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
