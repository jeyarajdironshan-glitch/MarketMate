const { verifyToken } = require('../config/jwt');
const db = require('../database/db');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
    }

    // Retrieve user details from database
    const user = await db.get(
      'SELECT user_id, full_name, email, phone_number, role, preferred_language, account_status FROM Users WHERE user_id = ?',
      [decoded.user_id]
    );

    if (!user) {
      return res.status(401).json({ success: false, message: 'User account not found.' });
    }

    if (user.account_status !== 'active') {
      return res.status(403).json({ success: false, message: 'Your account is currently inactive or suspended.' });
    }

    // Attach role-specific IDs if supplier or distributor
    if (user.role === 'supplier') {
      const supplier = await db.get('SELECT * FROM Suppliers WHERE user_id = ?', [user.user_id]);
      req.supplier = supplier;
    } else if (user.role === 'distributor') {
      const distributor = await db.get('SELECT * FROM Distributors WHERE user_id = ?', [user.user_id]);
      req.distributor = distributor;
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('[Auth Middleware Error]:', err);
    res.status(500).json({ success: false, message: 'Internal authentication error.' });
  }
}

function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Access restricted to role(s): ${roles.join(', ')}.`
      });
    }
    next();
  };
}

module.exports = {
  authenticate,
  authorize
};
