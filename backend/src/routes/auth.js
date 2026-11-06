const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { generateToken } = require('../config/jwt');
const { authenticate } = require('../middleware/auth');

/**
 * POST /api/auth/register
 * User Registration with Role Profiles
 */
router.post('/register', async (req, res) => {
  try {
    const {
      full_name,
      email,
      phone_number,
      password,
      role,
      preferred_language,
      // Supplier specific fields
      preferred_market_id,
      farm_location,
      primary_crop_types,
      // Distributor specific fields
      market_id,
      business_name,
      stall_number,
      business_description
    } = req.body;

    if (!full_name || !email || !phone_number || !password || !role) {
      return res.status(400).json({ success: false, message: 'Missing required registration fields.' });
    }

    if (!['supplier', 'distributor', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role provided.' });
    }

    // Check if email already registered
    const existing = await db.get('SELECT user_id FROM Users WHERE email = ?', [email.toLowerCase().trim()]);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(password, 10);

    // Insert user
    const userResult = await db.run(`
      INSERT INTO Users (full_name, email, phone_number, password_hash, role, preferred_language, account_status)
      VALUES (?, ?, ?, ?, ?, ?, 'active')
    `, [full_name.trim(), email.toLowerCase().trim(), phone_number.trim(), password_hash, role, preferred_language || 'en']);

    const userId = userResult.insertId;

    // Create role-specific record
    let profile = null;
    if (role === 'supplier') {
      const suppResult = await db.run(`
        INSERT INTO Suppliers (user_id, preferred_market_id, business_name, farm_location, primary_crop_types, verification_status)
        VALUES (?, ?, ?, ?, ?, 'verified')
      `, [userId, preferred_market_id || null, business_name || `${full_name}'s Farm`, farm_location || '', primary_crop_types || '']);
      profile = { supplier_id: suppResult.insertId, preferred_market_id };
    } else if (role === 'distributor') {
      if (!market_id) {
        return res.status(400).json({ success: false, message: 'Distributors must select their wholesale market.' });
      }
      const distResult = await db.run(`
        INSERT INTO Distributors (user_id, market_id, business_name, stall_number, business_description, verification_status)
        VALUES (?, ?, ?, ?, ?, 'verified')
      `, [userId, market_id, business_name || `${full_name} Wholesale`, stall_number || '', business_description || '']);
      profile = { distributor_id: distResult.insertId, market_id };
    }

    // Issue JWT token
    const token = generateToken({ user_id: userId, email, role });

    res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: {
        user_id: userId,
        full_name,
        email,
        phone_number,
        role,
        preferred_language: preferred_language || 'en',
        profile
      }
    });
  } catch (err) {
    console.error('[Register Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to complete registration: ' + err.message });
  }
});

/**
 * POST /api/auth/login
 * User Authentication
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    const user = await db.get(
      'SELECT * FROM Users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is inactive or suspended.' });
    }

    // Load role profile
    let profile = null;
    if (user.role === 'supplier') {
      profile = await db.get('SELECT * FROM Suppliers WHERE user_id = ?', [user.user_id]);
    } else if (user.role === 'distributor') {
      profile = await db.get(`
        SELECT d.*, m.market_name 
        FROM Distributors d 
        JOIN Markets m ON d.market_id = m.market_id 
        WHERE d.user_id = ?
      `, [user.user_id]);
    }

    const token = generateToken({ user_id: user.user_id, email: user.email, role: user.role });

    res.json({
      success: true,
      message: 'Login successful.',
      token,
      user: {
        user_id: user.user_id,
        full_name: user.full_name,
        email: user.email,
        phone_number: user.phone_number,
        role: user.role,
        preferred_language: user.preferred_language,
        profile
      }
    });
  } catch (err) {
    console.error('[Login Error]:', err);
    res.status(500).json({ success: false, message: 'Failed to process login.' });
  }
});

/**
 * GET /api/auth/me
 * Current authenticated user profile
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: {
      ...req.user,
      supplier: req.supplier || null,
      distributor: req.distributor || null
    }
  });
});

/**
 * PUT /api/auth/language
 * Update user's preferred language
 */
router.put('/language', authenticate, async (req, res) => {
  try {
    const { language } = req.body;
    if (!['en', 'si', 'ta'].includes(language)) {
      return res.status(400).json({ success: false, message: 'Supported languages are en, si, ta.' });
    }

    await db.run('UPDATE Users SET preferred_language = ? WHERE user_id = ?', [language, req.user.user_id]);
    res.json({ success: true, message: 'Language preference updated.', language });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
