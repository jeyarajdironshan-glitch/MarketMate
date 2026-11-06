const bcrypt = require('bcryptjs');
const db = require('./db');

async function seed() {
  console.log('[Seed] Initializing database and creating tables...');
  await db.initDatabase();

  const isSqlite = db.getDbType() === 'sqlite';

  // DDL definitions adapted for SQLite & MySQL
  const createTablesSql = `
    CREATE TABLE IF NOT EXISTS Users (
      user_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      full_name VARCHAR(150) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      phone_number VARCHAR(30) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(20) NOT NULL,
      preferred_language VARCHAR(5) DEFAULT 'en',
      account_status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Markets (
      market_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      market_name VARCHAR(150) NOT NULL,
      location VARCHAR(200) NOT NULL,
      opening_time VARCHAR(20) NOT NULL DEFAULT '04:00 AM',
      closing_time VARCHAR(20) NOT NULL DEFAULT '06:00 PM',
      current_status VARCHAR(30) DEFAULT 'open',
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Distributors (
      distributor_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      user_id INTEGER NOT NULL UNIQUE,
      market_id INTEGER NOT NULL,
      business_name VARCHAR(200) NOT NULL,
      stall_number VARCHAR(50),
      business_description TEXT,
      verification_status VARCHAR(20) DEFAULT 'verified',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Suppliers (
      supplier_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      user_id INTEGER NOT NULL UNIQUE,
      preferred_market_id INTEGER,
      business_name VARCHAR(200) NOT NULL,
      farm_location VARCHAR(200),
      primary_crop_types VARCHAR(255),
      verification_status VARCHAR(20) DEFAULT 'verified',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS DistributorRequests (
      request_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      supplier_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      request_type VARCHAR(20) DEFAULT 'initial',
      request_status VARCHAR(40) DEFAULT 'pending_admin_review',
      supplier_confirmed INTEGER DEFAULT 0,
      distributor_confirmed INTEGER DEFAULT 0,
      admin_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS DistributorConnections (
      connection_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      supplier_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      connection_status VARCHAR(20) DEFAULT 'active',
      start_date DATE NOT NULL,
      end_date DATE NULL,
      activated_by INTEGER NOT NULL,
      request_id INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CBSLPriceReports (
      report_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      report_date DATE NOT NULL,
      source_url VARCHAR(350) NOT NULL,
      retrieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      synchronization_status VARCHAR(20) DEFAULT 'verified',
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS VegetablePrices (
      price_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      report_id INTEGER NOT NULL,
      product_name VARCHAR(100) NOT NULL,
      category VARCHAR(50) DEFAULT 'Vegetable',
      market_name VARCHAR(100) NOT NULL,
      price_type VARCHAR(20) DEFAULT 'wholesale',
      price DECIMAL(10, 2) NOT NULL,
      previous_price DECIMAL(10, 2) NULL,
      price_change DECIMAL(10, 2) DEFAULT 0.00,
      percentage_change DECIMAL(6, 2) DEFAULT 0.00,
      unit VARCHAR(20) DEFAULT 'kg',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS PriceAlerts (
      alert_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      supplier_id INTEGER NOT NULL,
      price_id INTEGER NOT NULL,
      product_name VARCHAR(100) NOT NULL,
      previous_price DECIMAL(10, 2) NOT NULL,
      current_price DECIMAL(10, 2) NOT NULL,
      percentage_change DECIMAL(6, 2) NOT NULL,
      alert_type VARCHAR(30) NOT NULL,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Deliveries (
      delivery_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      supplier_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      product_name VARCHAR(100) NOT NULL,
      delivery_date DATE NOT NULL,
      quantity_sent DECIMAL(10, 2) NOT NULL,
      quantity_received DECIMAL(10, 2) NOT NULL,
      damaged_quantity DECIMAL(10, 2) DEFAULT 0.00,
      rejected_quantity DECIMAL(10, 2) DEFAULT 0.00,
      accepted_quantity DECIMAL(10, 2) NOT NULL,
      agreed_price DECIMAL(10, 2) NOT NULL,
      total_amount DECIMAL(12, 2) NOT NULL,
      delivery_status VARCHAR(30) DEFAULT 'pending_review',
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS DeliverySettlementConfirmations (
      confirmation_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      delivery_id INTEGER NOT NULL UNIQUE,
      supplier_confirmation INTEGER DEFAULT 0,
      distributor_confirmation INTEGER DEFAULT 1,
      supplier_confirmed_at TIMESTAMP NULL,
      distributor_confirmed_at TIMESTAMP NULL,
      settlement_status VARCHAR(30) DEFAULT 'pending',
      dispute_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ProductFeedback (
      feedback_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      delivery_id INTEGER NOT NULL UNIQUE,
      distributor_id INTEGER NOT NULL,
      quality_status VARCHAR(20) NOT NULL,
      comments TEXT,
      image_url VARCHAR(500),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Payments (
      payment_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      delivery_id INTEGER NOT NULL,
      supplier_id INTEGER NOT NULL,
      distributor_id INTEGER NOT NULL,
      amount DECIMAL(12, 2) NOT NULL,
      payment_method VARCHAR(50) DEFAULT 'payhere_sandbox',
      transaction_reference VARCHAR(100) NOT NULL UNIQUE,
      payhere_payment_id VARCHAR(100),
      payment_status VARCHAR(20) DEFAULT 'pending',
      payment_date TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ReliabilityHistory (
      history_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      user_id INTEGER NOT NULL,
      related_delivery_id INTEGER NULL,
      activity_type VARCHAR(40) NOT NULL,
      description TEXT,
      verified_status INTEGER DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS MarketAnnouncements (
      announcement_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      market_id INTEGER NOT NULL,
      title VARCHAR(200) NOT NULL,
      description TEXT NOT NULL,
      announcement_type VARCHAR(30) DEFAULT 'notice',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Notifications (
      notification_id INTEGER PRIMARY KEY ${isSqlite ? 'AUTOINCREMENT' : 'AUTO_INCREMENT'},
      user_id INTEGER NOT NULL,
      title VARCHAR(200) NOT NULL,
      message TEXT NOT NULL,
      notification_type VARCHAR(40) NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // Split and run each table creation
  const statements = createTablesSql.split(';').map(s => s.trim()).filter(Boolean);
  for (const statement of statements) {
    await db.run(statement);
  }

  // Check if users already seeded
  const existingUsers = await db.query('SELECT count(*) as count FROM Users');
  const userCount = existingUsers[0] ? (existingUsers[0].count || 0) : 0;
  if (userCount > 0) {
    console.log('[Seed] Database already contains data. Skipping re-seed.');
    return;
  }

  console.log('[Seed] Seeding initial demonstrative data...');

  // Hash standard passwords
  const passwordHash = await bcrypt.hash('MarketMate@2026', 10);
  const adminPasswordHash = await bcrypt.hash('Admin@123', 10);

  // 1. Seed Markets (Sri Lanka's 3 primary wholesale economic centres)
  await db.run(`
    INSERT INTO Markets (market_id, market_name, location, opening_time, closing_time, current_status, description)
    VALUES 
      (1, 'Dambulla Dedicated Economic Centre', 'Dambulla, Matale District, Central Province', '04:00 AM', '06:00 PM', 'open', 'Sri Lanka largest agricultural distribution hub handling upcountry and lowcountry vegetables.'),
      (2, 'Manning Market', 'Peliyagoda, Western Province', '03:00 AM', '04:00 PM', 'open', 'The central wholesale vegetable, fruit and grain hub supplying the Colombo metropolitan area.'),
      (3, 'Meegoda Dedicated Economic Centre', 'Meegoda, Homagama, Western Province', '05:00 AM', '05:00 PM', 'open', 'Specialized wholesale trade hub connecting Southern and Sabaragamuwa produce farmers.');
  `);

  // 2. Seed Users (Admin, Suppliers, Distributors)
  // Admin (user_id: 1)
  await db.run(`
    INSERT INTO Users (user_id, full_name, email, phone_number, password_hash, role, preferred_language, account_status)
    VALUES (1, 'MarketMate Central Admin', 'admin@marketmate.lk', '+94 11 234 5678', ?, 'admin', 'en', 'active')
  `, [adminPasswordHash]);

  // Suppliers (user_id: 2, 3, 4)
  await db.run(`
    INSERT INTO Users (user_id, full_name, email, phone_number, password_hash, role, preferred_language, account_status)
    VALUES 
      (2, 'Kamal Perera', 'kamal@supplier.lk', '+94 77 123 4567', ?, 'supplier', 'si', 'active'),
      (3, 'Sunil Shantha', 'sunil@supplier.lk', '+94 71 987 6543', ?, 'supplier', 'en', 'active'),
      (4, 'Ravi Kumar', 'ravi@supplier.lk', '+94 76 555 4321', ?, 'supplier', 'ta', 'active')
  `, [passwordHash, passwordHash, passwordHash]);

  // Distributors (user_id: 5, 6, 7)
  await db.run(`
    INSERT INTO Users (user_id, full_name, email, phone_number, password_hash, role, preferred_language, account_status)
    VALUES 
      (5, 'Aruna Gunawardena', 'aruna@distributor.lk', '+94 77 888 1122', ?, 'distributor', 'si', 'active'),
      (6, 'Bandara Wijeratne', 'bandara@distributor.lk', '+94 72 333 4455', ?, 'distributor', 'en', 'active'),
      (7, 'Nimal Perera', 'perera@distributor.lk', '+94 75 999 8877', ?, 'distributor', 'ta', 'active')
  `, [passwordHash, passwordHash, passwordHash]);

  // 3. Seed Suppliers Profile
  await db.run(`
    INSERT INTO Suppliers (supplier_id, user_id, preferred_market_id, business_name, farm_location, primary_crop_types, verification_status)
    VALUES 
      (1, 2, 1, 'Perera Green Farms', 'Welimada & Dambulla Outskirts', 'Tomatoes, Green Chillies, Beans, Cabbage', 'verified'),
      (2, 3, 2, 'Shantha Upcountry Agrico', 'Nuwara Eliya & Kandapola', 'Carrots, Leeks, Beetroot, Potatoes', 'verified'),
      (3, 4, 3, 'Ravi Fresh Harvest', 'Jaffna & Dambulla Regional Farm', 'Red Onions, Pumpkin, Lime, Bananas', 'verified');
  `);

  // 4. Seed Distributors Profile
  await db.run(`
    INSERT INTO Distributors (distributor_id, user_id, market_id, business_name, stall_number, business_description, verification_status)
    VALUES 
      (1, 5, 1, 'Aruna Wholesale Traders', 'Stall No. B-42', 'Specialized in wholesale distribution of tomatoes, capsicum, green chillies and beans with over 15 years experience.', 'verified'),
      (2, 6, 2, 'Bandara & Sons Agri Dist', 'Stall No. P-15', 'High volume vegetable wholesaler at Manning Market Peliyagoda connecting provincial farmers to Colombo retail markets.', 'verified'),
      (3, 7, 3, 'Perera Produce Traders', 'Stall No. M-08', 'Direct wholesale distributor supplying supermarkets and catering businesses across the Western Province.', 'verified');
  `);

  // 5. Seed Distributor Connections and Requests
  // Connection 1: Kamal Perera (Supplier 1) <-> Aruna Wholesale (Distributor 1) at Dambulla
  await db.run(`
    INSERT INTO DistributorRequests (request_id, supplier_id, distributor_id, request_type, request_status, supplier_confirmed, distributor_confirmed, admin_notes)
    VALUES (1, 1, 1, 'initial', 'approved_and_connected', 1, 1, 'Mutual agreement confirmed via telephone. Commercial verification approved by admin.')
  `);
  await db.run(`
    INSERT INTO DistributorConnections (connection_id, supplier_id, distributor_id, connection_status, start_date, activated_by, request_id)
    VALUES (1, 1, 1, 'active', '2026-10-01', 1, 1)
  `);

  // Connection 2: Sunil Shantha (Supplier 2) <-> Bandara & Sons (Distributor 2) at Manning Market
  await db.run(`
    INSERT INTO DistributorRequests (request_id, supplier_id, distributor_id, request_type, request_status, supplier_confirmed, distributor_confirmed, admin_notes)
    VALUES (2, 2, 2, 'initial', 'approved_and_connected', 1, 1, 'Agreement validated by market superintendent.')
  `);
  await db.run(`
    INSERT INTO DistributorConnections (connection_id, supplier_id, distributor_id, connection_status, start_date, activated_by, request_id)
    VALUES (2, 2, 2, 'active', '2026-10-15', 1, 2)
  `);

  // Connection 3: Ravi Kumar (Supplier 3) requesting Perera Produce Traders (Distributor 3) at Meegoda
  // Status: Pending Admin Review (demonstrates the multi-stage connection workflow)
  await db.run(`
    INSERT INTO DistributorRequests (request_id, supplier_id, distributor_id, request_type, request_status, supplier_confirmed, distributor_confirmed, admin_notes)
    VALUES (3, 3, 3, 'initial', 'pending_admin_review', 0, 0, 'New supplier connection request received. Awaiting admin facilitation.')
  `);

  // 6. Seed CBSL Price Reports (Real CBSL publication dates and data)
  // Report 1: Yesterday's report (2026-11-04)
  await db.run(`
    INSERT INTO CBSLPriceReports (report_id, report_date, source_url, synchronization_status, notes)
    VALUES (1, '2026-11-04', 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report', 'verified', 'Official CBSL Daily Price Bulletin - November 04, 2026')
  `);

  // Report 2: Today's latest report (2026-11-05)
  await db.run(`
    INSERT INTO CBSLPriceReports (report_id, report_date, source_url, synchronization_status, notes)
    VALUES (2, '2026-11-05', 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report', 'verified', 'Official CBSL Daily Price Bulletin - November 05, 2026')
  `);

  // 7. Seed Vegetable & Fruit Prices (CBSL Wholesale Prices for Dambulla and Manning Market / Pettah)
  const cbslPrices = [
    // Today's Dambulla wholesale prices (Report 2) with price change vs Yesterday (Report 1)
    { rep: 2, prod: 'Tomato', cat: 'Vegetable', mkt: 'Dambulla', cur: 220, prev: 180, diff: 40, pct: 22.22 },
    { rep: 2, prod: 'Carrot', cat: 'Vegetable', mkt: 'Dambulla', cur: 280, prev: 310, diff: -30, pct: -9.68 },
    { rep: 2, prod: 'Green Chilli', cat: 'Vegetable', mkt: 'Dambulla', cur: 650, prev: 550, diff: 100, pct: 18.18 },
    { rep: 2, prod: 'Beans (Green)', cat: 'Vegetable', mkt: 'Dambulla', cur: 260, prev: 240, diff: 20, pct: 8.33 },
    { rep: 2, prod: 'Cabbage', cat: 'Vegetable', mkt: 'Dambulla', cur: 150, prev: 160, diff: -10, pct: -6.25 },
    { rep: 2, prod: 'Leeks', cat: 'Vegetable', mkt: 'Dambulla', cur: 230, prev: 220, diff: 10, pct: 4.55 },
    { rep: 2, prod: 'Brinjal', cat: 'Vegetable', mkt: 'Dambulla', cur: 190, prev: 170, diff: 20, pct: 11.76 },
    { rep: 2, prod: 'Pumpkin', cat: 'Vegetable', mkt: 'Dambulla', cur: 130, prev: 130, diff: 0, pct: 0.00 },
    { rep: 2, prod: 'Lime', cat: 'Vegetable', mkt: 'Dambulla', cur: 850, prev: 700, diff: 150, pct: 21.43 },
    { rep: 2, prod: 'Banana (Ambul)', cat: 'Fruit', mkt: 'Dambulla', cur: 175, prev: 160, diff: 15, pct: 9.38 },
    { rep: 2, prod: 'Papaya', cat: 'Fruit', mkt: 'Dambulla', cur: 135, prev: 120, diff: 15, pct: 12.50 },
    { rep: 2, prod: 'Pineapple', cat: 'Fruit', mkt: 'Dambulla', cur: 260, prev: 260, diff: 0, pct: 0.00 },

    // Today's Manning Market wholesale prices (Report 2)
    { rep: 2, prod: 'Tomato', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 240, prev: 200, diff: 40, pct: 20.00 },
    { rep: 2, prod: 'Carrot', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 300, prev: 330, diff: -30, pct: -9.09 },
    { rep: 2, prod: 'Green Chilli', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 700, prev: 600, diff: 100, pct: 16.67 },
    { rep: 2, prod: 'Beans (Green)', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 280, prev: 250, diff: 30, pct: 12.00 },
    { rep: 2, prod: 'Cabbage', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 170, prev: 180, diff: -10, pct: -5.56 },
    { rep: 2, prod: 'Leeks', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 250, prev: 240, diff: 10, pct: 4.17 },
    { rep: 2, prod: 'Brinjal', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 210, prev: 180, diff: 30, pct: 16.67 },
    { rep: 2, prod: 'Pumpkin', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 150, prev: 150, diff: 0, pct: 0.00 },
    { rep: 2, prod: 'Lime', cat: 'Vegetable', mkt: 'Manning Market (Pettah)', cur: 900, prev: 750, diff: 150, pct: 20.00 },
    { rep: 2, prod: 'Banana (Ambul)', cat: 'Fruit', mkt: 'Manning Market (Pettah)', cur: 190, prev: 180, diff: 10, pct: 5.56 },
    { rep: 2, prod: 'Papaya', cat: 'Fruit', mkt: 'Manning Market (Pettah)', cur: 150, prev: 130, diff: 20, pct: 15.38 },
    { rep: 2, prod: 'Pineapple', cat: 'Fruit', mkt: 'Manning Market (Pettah)', cur: 280, prev: 280, diff: 0, pct: 0.00 }
  ];

  for (const p of cbslPrices) {
    await db.run(`
      INSERT INTO VegetablePrices (report_id, product_name, category, market_name, price_type, price, previous_price, price_change, percentage_change, unit)
      VALUES (?, ?, ?, ?, 'wholesale', ?, ?, ?, ?, 'kg')
    `, [p.rep, p.prod, p.cat, p.mkt, p.cur, p.prev, p.diff, p.pct]);
  }

  // 8. Seed Smart Price Alerts (Innovation 1: Automated smart price change alerts for suppliers)
  await db.run(`
    INSERT INTO PriceAlerts (supplier_id, price_id, product_name, previous_price, current_price, percentage_change, alert_type, message, is_read)
    VALUES 
      (1, 1, 'Tomato', 180.00, 220.00, 22.22, 'significant_spike', 'Tomato price has increased by Rs. 40 (+22.22%) according to the latest official CBSL report for Dambulla.', 0),
      (1, 3, 'Green Chilli', 550.00, 650.00, 18.18, 'significant_spike', 'Green Chilli wholesale price increased by Rs. 100 (+18.18%) at Dambulla Dedicated Economic Centre.', 0),
      (2, 2, 'Carrot', 310.00, 280.00, -9.68, 'decrease', 'Carrot wholesale price decreased by Rs. 30 (-9.68%) at Dambulla Market.', 1),
      (1, 9, 'Lime', 700.00, 850.00, 21.43, 'significant_spike', 'Lime price jumped by Rs. 150 (+21.43%) due to seasonal supply fluctuations reported by CBSL.', 0);
  `);

  // 9. Seed Deliveries (Innovation 2: Digital Delivery Settlement Slip)
  // Delivery 1: Tomato (Kamal -> Aruna) - Confirmed and Paid
  await db.run(`
    INSERT INTO Deliveries (delivery_id, supplier_id, distributor_id, product_name, delivery_date, quantity_sent, quantity_received, damaged_quantity, rejected_quantity, accepted_quantity, agreed_price, total_amount, delivery_status, notes)
    VALUES (1, 1, 1, 'Tomato', '2026-11-04', 100.00, 100.00, 10.00, 0.00, 90.00, 200.00, 18000.00, 'paid', 'First grade Welimada tomatoes delivered in standardized plastic crates.')
  `);
  await db.run(`
    INSERT INTO DeliverySettlementConfirmations (confirmation_id, delivery_id, supplier_confirmation, distributor_confirmation, supplier_confirmed_at, distributor_confirmed_at, settlement_status)
    VALUES (1, 1, 1, 1, '2026-11-04 14:30:00', '2026-11-04 11:15:00', 'mutually_confirmed')
  `);
  // Product Quality Feedback with image for Delivery 1
  await db.run(`
    INSERT INTO ProductFeedback (feedback_id, delivery_id, distributor_id, quality_status, comments, image_url)
    VALUES (1, 1, 1, 'Good', 'Very fresh batch of Welimada tomatoes. Minimal 10kg transit squeeze damage naturally accounted.', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800')
  `);
  // Payment record for Delivery 1 (PayHere Sandbox)
  await db.run(`
    INSERT INTO Payments (payment_id, delivery_id, supplier_id, distributor_id, amount, payment_method, transaction_reference, payhere_payment_id, payment_status, payment_date)
    VALUES (1, 1, 1, 1, 18000.00, 'payhere_sandbox', 'MM-PH-20261104-001', '320025981240', 'completed', '2026-11-04 16:45:00')
  `);

  // Delivery 2: Green Chilli (Kamal -> Aruna) - Today's delivery, pending supplier review
  await db.run(`
    INSERT INTO Deliveries (delivery_id, supplier_id, distributor_id, product_name, delivery_date, quantity_sent, quantity_received, damaged_quantity, rejected_quantity, accepted_quantity, agreed_price, total_amount, delivery_status, notes)
    VALUES (2, 1, 1, 'Green Chilli', '2026-11-05', 50.00, 50.00, 2.00, 0.00, 48.00, 600.00, 28800.00, 'pending_review', 'Spicy hot variety, harvested morning.')
  `);
  await db.run(`
    INSERT INTO DeliverySettlementConfirmations (confirmation_id, delivery_id, supplier_confirmation, distributor_confirmation, distributor_confirmed_at, settlement_status)
    VALUES (2, 2, 0, 1, '2026-11-05 09:30:00', 'pending')
  `);
  await db.run(`
    INSERT INTO ProductFeedback (feedback_id, delivery_id, distributor_id, quality_status, comments, image_url)
    VALUES (2, 2, 1, 'Good', 'Excellent aroma and firmness. 2kg weight loss during transport accepted.', 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800')
  `);

  // Delivery 3: Carrot (Sunil -> Bandara) - Disputed (Demonstrating Disputed Settlement Workflow)
  await db.run(`
    INSERT INTO Deliveries (delivery_id, supplier_id, distributor_id, product_name, delivery_date, quantity_sent, quantity_received, damaged_quantity, rejected_quantity, accepted_quantity, agreed_price, total_amount, delivery_status, notes)
    VALUES (3, 2, 2, 'Carrot', '2026-11-05', 200.00, 200.00, 30.00, 10.00, 160.00, 280.00, 44800.00, 'disputed', 'Washed Nuwara Eliya carrots.')
  `);
  await db.run(`
    INSERT INTO DeliverySettlementConfirmations (confirmation_id, delivery_id, supplier_confirmation, distributor_confirmation, distributor_confirmed_at, settlement_status, dispute_reason)
    VALUES (3, 3, 0, 1, '2026-11-05 08:00:00', 'disputed', 'Supplier notes: 30kg damage claim is excessive; carrots were packed in double-layer bags with ice.')
  `);
  await db.run(`
    INSERT INTO ProductFeedback (feedback_id, delivery_id, distributor_id, quality_status, comments, image_url)
    VALUES (3, 3, 2, 'Average', 'Bottom layers sustained water accumulation and slight rot during transit.', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800')
  `);

  // 10. Seed Reliability Audit History (Innovation 3: Verified activity records)
  await db.run(`
    INSERT INTO ReliabilityHistory (user_id, related_delivery_id, activity_type, description, verified_status)
    VALUES 
      (2, 1, 'delivery_completed', 'Delivered 100kg Tomato with 90kg accepted (90% fulfillment).', 1),
      (2, 1, 'settlement_confirmed', 'Mutually confirmed Digital Delivery Settlement Slip for Tomato delivery.', 1),
      (5, 1, 'payment_completed', 'Completed full payment of Rs. 18,000 via PayHere gateway on time.', 1),
      (5, 1, 'quality_rated_good', 'Rated supplier batch quality as Good with photographic evidence.', 1),
      (3, 3, 'delivery_disputed', 'Disputed 30kg damage deduction for Carrot delivery #3.', 1);
  `);

  // 11. Seed Market Announcements
  await db.run(`
    INSERT INTO MarketAnnouncements (market_id, title, description, announcement_type, start_date, end_date)
    VALUES 
      (1, 'Dambulla Centre Special Cleaning & Unloading Hours', 'The Dambulla Dedicated Economic Centre premises will undergo deep cleaning on Sunday evening. Bulk lorries must complete unloading by 5:00 PM.', 'special_hours', '2026-11-06', '2026-11-08'),
      (2, 'Peliyagoda Traffic & Weather Advisory', 'Due to anticipated afternoon rainfall, Manning Market access ramp gate 3 will be restricted to light trucks only.', 'notice', '2026-11-05', '2026-11-07'),
      (3, 'Meegoda Centre Normal Operations Active', 'All trading bays, electronic weighing scales, and administrative counters operating at full capacity.', 'notice', '2026-11-01', '2026-11-30');
  `);

  // 12. Seed Notifications
  await db.run(`
    INSERT INTO Notifications (user_id, title, message, notification_type, is_read)
    VALUES 
      (2, 'Price Spike Alert: Tomato', 'Tomato price increased by +Rs. 40 (+22.2%) in Dambulla CBSL report.', 'price_alert', 0),
      (2, 'Payment Received: Rs. 18,000', 'Distributor Aruna Wholesale Traders paid Rs. 18,000 for Delivery #1 via PayHere.', 'payment_update', 1),
      (5, 'New Delivery Recorded: #2 Green Chilli', 'Delivery slip generated for 50kg Green Chilli. Awaiting supplier confirmation.', 'delivery_update', 0),
      (1, 'New Connection Request #3', 'Supplier Ravi Kumar submitted connection request to Perera Produce Traders.', 'connection_update', 0);
  `);

  console.log('[Seed] Database initialization and seeding completed successfully!');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err);
      process.exit(1);
    });
}

module.exports = seed;
