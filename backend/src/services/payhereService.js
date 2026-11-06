const crypto = require('crypto');
const db = require('../database/db');

// PayHere Sandbox Credentials (Official Sandbox)
const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || '1220000'; // Standard sandbox merchant ID
const PAYHERE_MERCHANT_SECRET = process.env.PAYHERE_MERCHANT_SECRET || 'marketmate_payhere_secret_key_sandbox_2026';
const PAYHERE_SANDBOX_URL = 'https://sandbox.payhere.lk/pay/checkout';

/**
 * Generate MD5 Hash for client-side PayHere checkout initiation
 * Hash format: strtoupper(md5(merchant_id + order_id + amountFormatted + currency + strtoupper(md5(merchant_secret))))
 */
function generateCheckoutHash(orderId, amount, currency = 'LKR') {
  const amountFormatted = Number(amount).toFixed(2);
  const secretHash = crypto.createHash('md5').update(PAYHERE_MERCHANT_SECRET).digest('hex').toUpperCase();
  const rawString = `${PAYHERE_MERCHANT_ID}${orderId}${amountFormatted}${currency}${secretHash}`;
  return crypto.createHash('md5').update(rawString).digest('hex').toUpperCase();
}

/**
 * Verify Server-Side Callback Notification (IPN Webhook)
 * Hash format: strtoupper(md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret))))
 */
function verifyPaymentNotification(data) {
  const {
    merchant_id,
    order_id,
    payhere_amount,
    payhere_currency,
    status_code,
    md5sig
  } = data;

  const secretHash = crypto.createHash('md5').update(PAYHERE_MERCHANT_SECRET).digest('hex').toUpperCase();
  const rawString = `${merchant_id}${order_id}${payhere_amount}${payhere_currency}${status_code}${secretHash}`;
  const localMd5 = crypto.createHash('md5').update(rawString).digest('hex').toUpperCase();

  return localMd5 === md5sig;
}

/**
 * Prepare checkout payload for a settled delivery
 */
async function prepareDeliveryPayment(deliveryId, distributorUserId) {
  const delivery = await db.get(`
    SELECT d.*, s.business_name as supplier_name, su.email as supplier_email, su.phone_number as supplier_phone,
           du.full_name as distributor_name, du.email as distributor_email, du.phone_number as distributor_phone
    FROM Deliveries d
    JOIN Suppliers s ON d.supplier_id = s.supplier_id
    JOIN Users su ON s.user_id = su.user_id
    JOIN Distributors dist ON d.distributor_id = dist.distributor_id
    JOIN Users du ON dist.user_id = du.user_id
    WHERE d.delivery_id = ?
  `, [deliveryId]);

  if (!delivery) {
    throw new Error('Delivery record not found.');
  }

  if (delivery.delivery_status === 'paid') {
    throw new Error('This delivery settlement has already been paid.');
  }

  // Generate unique order ID
  const timestamp = Date.now().toString().slice(-6);
  const orderId = `MM-DEL-${deliveryId}-${timestamp}`;
  const amount = Number(delivery.total_amount);
  const currency = 'LKR';
  const hash = generateCheckoutHash(orderId, amount, currency);

  // Create or update payment record as 'pending'
  const existingPayment = await db.get(
    'SELECT payment_id FROM Payments WHERE delivery_id = ? AND payment_status = "pending"',
    [deliveryId]
  );

  let paymentId;
  if (existingPayment) {
    await db.run(`
      UPDATE Payments 
      SET transaction_reference = ?, amount = ?, created_at = CURRENT_TIMESTAMP
      WHERE payment_id = ?
    `, [orderId, amount, existingPayment.payment_id]);
    paymentId = existingPayment.payment_id;
  } else {
    const res = await db.run(`
      INSERT INTO Payments (delivery_id, supplier_id, distributor_id, amount, payment_method, transaction_reference, payment_status)
      VALUES (?, ?, ?, ?, 'payhere_sandbox', ?, 'pending')
    `, [deliveryId, delivery.supplier_id, delivery.distributor_id, amount, orderId]);
    paymentId = res.insertId;
  }

  return {
    paymentId,
    orderId,
    amount: amount.toFixed(2),
    currency,
    hash,
    merchantId: PAYHERE_MERCHANT_ID,
    sandboxUrl: PAYHERE_SANDBOX_URL,
    items: `Settlement for ${delivery.product_name} (${delivery.accepted_quantity} kg)`,
    customer: {
      name: delivery.distributor_name,
      email: delivery.distributor_email,
      phone: delivery.distributor_phone
    },
    supplier: {
      name: delivery.supplier_name,
      email: delivery.supplier_email
    }
  };
}

/**
 * Process verified payment completion
 */
async function completePayment(orderId, payherePaymentId = null, method = 'payhere_sandbox') {
  const payment = await db.get(
    'SELECT * FROM Payments WHERE transaction_reference = ?',
    [orderId]
  );

  if (!payment) {
    throw new Error(`Payment with reference ${orderId} not found.`);
  }

  const paymentDate = new Date().toISOString();

  // 1. Update Payment status
  await db.run(`
    UPDATE Payments 
    SET payment_status = 'completed', payhere_payment_id = ?, payment_date = CURRENT_TIMESTAMP
    WHERE payment_id = ?
  `, [payherePaymentId || `SIM-${Date.now()}`, payment.payment_id]);

  // 2. Update Delivery status to 'paid'
  await db.run(`
    UPDATE Deliveries 
    SET delivery_status = 'paid'
    WHERE delivery_id = ?
  `, [payment.delivery_id]);

  // 3. Record in Reliability History for distributor (prompt payment verified)
  const distributor = await db.get('SELECT user_id FROM Distributors WHERE distributor_id = ?', [payment.distributor_id]);
  if (distributor) {
    await db.run(`
      INSERT INTO ReliabilityHistory (user_id, related_delivery_id, activity_type, description, verified_status)
      VALUES (?, ?, 'payment_completed', ?, 1)
    `, [distributor.user_id, payment.delivery_id, `Completed full settlement payment of Rs. ${payment.amount} via PayHere.`]);
  }

  // 4. Send notification to Supplier
  const supplier = await db.get('SELECT user_id FROM Suppliers WHERE supplier_id = ?', [payment.supplier_id]);
  if (supplier) {
    await db.run(`
      INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
      VALUES (?, 'Payment Received via PayHere', ?, 'payment_update', 0)
    `, [supplier.user_id, `Payment of Rs. ${payment.amount} for Delivery #${payment.delivery_id} has been processed successfully (Ref: ${orderId}).`]);
  }

  return {
    success: true,
    paymentId: payment.payment_id,
    deliveryId: payment.delivery_id,
    amount: payment.amount,
    status: 'completed'
  };
}

module.exports = {
  PAYHERE_MERCHANT_ID,
  PAYHERE_SANDBOX_URL,
  generateCheckoutHash,
  verifyPaymentNotification,
  prepareDeliveryPayment,
  completePayment
};
