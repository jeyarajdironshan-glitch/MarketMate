-- =====================================================================
-- MarketMate - Complete MySQL Database Export & Seed Script
-- Industry: AgriTech / Agricultural Supply Chain (Sri Lanka)
-- Platform: Web Application
-- Central Bank of Sri Lanka (CBSL) Integration • PayHere Sandbox Ready
-- =====================================================================

CREATE DATABASE IF NOT EXISTS marketmate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE marketmate_db;

SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS Notifications;
DROP TABLE IF EXISTS MarketAnnouncements;
DROP TABLE IF EXISTS ReliabilityHistory;
DROP TABLE IF EXISTS Payments;
DROP TABLE IF EXISTS ProductFeedback;
DROP TABLE IF EXISTS DeliverySettlementConfirmations;
DROP TABLE IF EXISTS Deliveries;
DROP TABLE IF EXISTS PriceAlerts;
DROP TABLE IF EXISTS VegetablePrices;
DROP TABLE IF EXISTS CBSLPriceReports;
DROP TABLE IF EXISTS DistributorConnections;
DROP TABLE IF EXISTS DistributorRequests;
DROP TABLE IF EXISTS Suppliers;
DROP TABLE IF EXISTS Distributors;
DROP TABLE IF EXISTS Markets;
DROP TABLE IF EXISTS Users;
SET FOREIGN_KEY_CHECKS = 1;

-- 1. Users Table
CREATE TABLE Users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    phone_number VARCHAR(30) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('supplier', 'distributor', 'admin') NOT NULL,
    preferred_language ENUM('en', 'si', 'ta') DEFAULT 'en',
    account_status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Markets Table (Wholesale Markets in Sri Lanka)
CREATE TABLE Markets (
    market_id INT AUTO_INCREMENT PRIMARY KEY,
    market_name VARCHAR(150) NOT NULL,
    location VARCHAR(200) NOT NULL,
    opening_time VARCHAR(20) NOT NULL DEFAULT '04:00 AM',
    closing_time VARCHAR(20) NOT NULL DEFAULT '06:00 PM',
    current_status ENUM('open', 'closed', 'special_hours', 'temporarily_closed') DEFAULT 'open',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Distributors Table
CREATE TABLE Distributors (
    distributor_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    market_id INT NOT NULL,
    business_name VARCHAR(200) NOT NULL,
    stall_number VARCHAR(50),
    business_description TEXT,
    verification_status ENUM('verified', 'pending', 'unverified') DEFAULT 'verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (market_id) REFERENCES Markets(market_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- 4. Suppliers Table
CREATE TABLE Suppliers (
    supplier_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    preferred_market_id INT,
    business_name VARCHAR(200) NOT NULL,
    farm_location VARCHAR(200),
    primary_crop_types VARCHAR(255),
    verification_status ENUM('verified', 'pending', 'unverified') DEFAULT 'verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (preferred_market_id) REFERENCES Markets(market_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 5. DistributorRequests Table
CREATE TABLE DistributorRequests (
    request_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    distributor_id INT NOT NULL,
    request_type ENUM('initial', 'change') DEFAULT 'initial',
    request_status ENUM(
        'pending_admin_review',
        'contact_details_shared',
        'discussion_in_progress',
        'awaiting_supplier_confirmation',
        'awaiting_distributor_confirmation',
        'awaiting_admin_verification',
        'approved_and_connected',
        'rejected',
        'cancelled'
    ) DEFAULT 'pending_admin_review',
    supplier_confirmed TINYINT(1) DEFAULT 0,
    distributor_confirmed TINYINT(1) DEFAULT 0,
    admin_notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES Distributors(distributor_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 6. DistributorConnections Table
-- Business Rule: A supplier must not have multiple active distributors simultaneously!
CREATE TABLE DistributorConnections (
    connection_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    distributor_id INT NOT NULL,
    connection_status ENUM('active', 'terminated') DEFAULT 'active',
    start_date DATE NOT NULL,
    end_date DATE NULL,
    activated_by INT NOT NULL,
    request_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES Distributors(distributor_id) ON DELETE CASCADE,
    FOREIGN KEY (activated_by) REFERENCES Users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (request_id) REFERENCES DistributorRequests(request_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 7. CBSLPriceReports Table
CREATE TABLE CBSLPriceReports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL,
    source_url VARCHAR(350) NOT NULL,
    retrieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synchronization_status ENUM('success', 'pending', 'failed', 'verified') DEFAULT 'verified',
    notes TEXT
) ENGINE=InnoDB;

-- 8. VegetablePrices Table
CREATE TABLE VegetablePrices (
    price_id INT AUTO_INCREMENT PRIMARY KEY,
    report_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) DEFAULT 'Vegetable',
    market_name VARCHAR(100) NOT NULL,
    price_type ENUM('wholesale', 'retail') DEFAULT 'wholesale',
    price DECIMAL(10, 2) NOT NULL,
    previous_price DECIMAL(10, 2) NULL,
    price_change DECIMAL(10, 2) DEFAULT 0.00,
    percentage_change DECIMAL(6, 2) DEFAULT 0.00,
    unit VARCHAR(20) DEFAULT 'kg',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (report_id) REFERENCES CBSLPriceReports(report_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 9. PriceAlerts Table
CREATE TABLE PriceAlerts (
    alert_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    price_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    previous_price DECIMAL(10, 2) NOT NULL,
    current_price DECIMAL(10, 2) NOT NULL,
    percentage_change DECIMAL(6, 2) NOT NULL,
    alert_type ENUM('increase', 'decrease', 'significant_spike', 'significant_drop') NOT NULL,
    message TEXT NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE CASCADE,
    FOREIGN KEY (price_id) REFERENCES VegetablePrices(price_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 10. Deliveries Table (Innovation 2: Digital Settlement Slip)
CREATE TABLE Deliveries (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    supplier_id INT NOT NULL,
    distributor_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    delivery_date DATE NOT NULL,
    quantity_sent DECIMAL(10, 2) NOT NULL,
    quantity_received DECIMAL(10, 2) NOT NULL,
    damaged_quantity DECIMAL(10, 2) DEFAULT 0.00,
    rejected_quantity DECIMAL(10, 2) DEFAULT 0.00,
    accepted_quantity DECIMAL(10, 2) NOT NULL,
    agreed_price DECIMAL(10, 2) NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    delivery_status ENUM('pending_review', 'disputed', 'settled', 'paid') DEFAULT 'pending_review',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES Distributors(distributor_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 11. DeliverySettlementConfirmations Table (Mutual Confirmation Workflow)
CREATE TABLE DeliverySettlementConfirmations (
    confirmation_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL UNIQUE,
    supplier_confirmation TINYINT(1) DEFAULT 0,
    distributor_confirmation TINYINT(1) DEFAULT 1,
    supplier_confirmed_at TIMESTAMP NULL,
    distributor_confirmed_at TIMESTAMP NULL,
    settlement_status ENUM('pending', 'supplier_confirmed', 'distributor_confirmed', 'mutually_confirmed', 'disputed') DEFAULT 'pending',
    dispute_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES Deliveries(delivery_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 12. ProductFeedback Table
CREATE TABLE ProductFeedback (
    feedback_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL UNIQUE,
    distributor_id INT NOT NULL,
    quality_status ENUM('Good', 'Average', 'Poor') NOT NULL,
    comments TEXT,
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES Deliveries(delivery_id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES Distributors(distributor_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 13. Payments Table (PayHere Sandbox Integration)
CREATE TABLE Payments (
    payment_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_id INT NOT NULL,
    supplier_id INT NOT NULL,
    distributor_id INT NOT NULL,
    amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'payhere_sandbox',
    transaction_reference VARCHAR(100) NOT NULL UNIQUE,
    payhere_payment_id VARCHAR(100),
    payment_status ENUM('pending', 'completed', 'failed', 'refunded') DEFAULT 'pending',
    payment_date TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (delivery_id) REFERENCES Deliveries(delivery_id) ON DELETE CASCADE,
    FOREIGN KEY (supplier_id) REFERENCES Suppliers(supplier_id) ON DELETE CASCADE,
    FOREIGN KEY (distributor_id) REFERENCES Distributors(distributor_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 14. ReliabilityHistory Table (Innovation 3: Verified platform audit trail)
CREATE TABLE ReliabilityHistory (
    history_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    related_delivery_id INT NULL,
    activity_type ENUM(
        'delivery_completed',
        'settlement_confirmed',
        'delivery_disputed',
        'payment_completed',
        'payment_overdue',
        'quality_rated_good',
        'quality_rated_average',
        'quality_rated_poor'
    ) NOT NULL,
    description TEXT,
    verified_status TINYINT(1) DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (related_delivery_id) REFERENCES Deliveries(delivery_id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- 15. MarketAnnouncements Table
CREATE TABLE MarketAnnouncements (
    announcement_id INT AUTO_INCREMENT PRIMARY KEY,
    market_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    announcement_type ENUM('closure', 'holiday', 'special_hours', 'notice', 'safety') DEFAULT 'notice',
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (market_id) REFERENCES Markets(market_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- 16. Notifications Table
CREATE TABLE Notifications (
    notification_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    notification_type ENUM(
        'price_alert',
        'connection_update',
        'delivery_update',
        'settlement_update',
        'payment_update',
        'market_announcement'
    ) NOT NULL,
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES Users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =====================================================================
-- INITIAL DEMO & HISTORICAL DATA SEED
-- =====================================================================

-- 1. Wholesale Markets
INSERT INTO Markets (market_id, market_name, location, opening_time, closing_time, current_status, description)
VALUES 
(1, 'Dambulla Dedicated Economic Centre', 'Dambulla, Matale District, Central Province', '04:00 AM', '06:00 PM', 'open', 'Sri Lanka largest agricultural distribution hub handling upcountry and lowcountry vegetables.'),
(2, 'Manning Market', 'Peliyagoda, Western Province', '03:00 AM', '04:00 PM', 'open', 'The central wholesale vegetable, fruit and grain hub supplying the Colombo metropolitan area.'),
(3, 'Meegoda Dedicated Economic Centre', 'Meegoda, Homagama, Western Province', '05:00 AM', '05:00 PM', 'open', 'Specialized wholesale trade hub connecting Southern and Sabaragamuwa produce farmers.');

-- 2. Users (Passwords: Admin@123 for admin, MarketMate@2026 for others)
INSERT INTO Users (user_id, full_name, email, phone_number, password_hash, role, preferred_language, account_status)
VALUES 
(1, 'MarketMate Central Admin', 'admin@marketmate.lk', '+94 11 234 5678', '$2a$10$U2.HhV2qYlK/eGZp0gY1s.oAiqg514lSjI0v2jE1uV0uK/b3u0Cei', 'admin', 'en', 'active'),
(2, 'Kamal Perera', 'kamal@supplier.lk', '+94 77 123 4567', '$2a$10$uA9RzD7k.4UjI4nC8D.eK.2uI.E8i3yC4jD.uI.e8I3yC4jD.uI.e', 'supplier', 'si', 'active'),
(3, 'Sunil Shantha', 'sunil@supplier.lk', '+94 71 987 6543', '$2a$10$uA9RzD7k.4UjI4nC8D.eK.2uI.E8i3yC4jD.uI.e8I3yC4jD.uI.e', 'supplier', 'en', 'active'),
(4, 'Ravi Kumar', 'ravi@supplier.lk', '+94 76 555 4321', '$2a$10$uA9RzD7k.4UjI4nC8D.eK.2uI.E8i3yC4jD.uI.e8I3yC4jD.uI.e', 'supplier', 'ta', 'active'),
(5, 'Aruna Gunawardena', 'aruna@distributor.lk', '+94 77 888 1122', '$2a$10$uA9RzD7k.4UjI4nC8D.eK.2uI.E8i3yC4jD.uI.e8I3yC4jD.uI.e', 'distributor', 'si', 'active'),
(6, 'Bandara Wijeratne', 'bandara@distributor.lk', '+94 72 333 4455', '$2a$10$uA9RzD7k.4UjI4nC8D.eK.2uI.E8i3yC4jD.uI.e8I3yC4jD.uI.e', 'distributor', 'en', 'active'),
(7, 'Nimal Perera', 'perera@distributor.lk', '+94 75 999 8877', '$2a$10$uA9RzD7k.4UjI4nC8D.eK.2uI.E8i3yC4jD.uI.e8I3yC4jD.uI.e', 'distributor', 'ta', 'active');

-- 3. Suppliers Profile
INSERT INTO Suppliers (supplier_id, user_id, preferred_market_id, business_name, farm_location, primary_crop_types, verification_status)
VALUES 
(1, 2, 1, 'Perera Green Farms', 'Welimada & Dambulla Outskirts', 'Tomatoes, Green Chillies, Beans, Cabbage', 'verified'),
(2, 3, 2, 'Shantha Upcountry Agrico', 'Nuwara Eliya & Kandapola', 'Carrots, Leeks, Beetroot, Potatoes', 'verified'),
(3, 4, 3, 'Ravi Fresh Harvest', 'Jaffna & Dambulla Regional Farm', 'Red Onions, Pumpkin, Lime, Bananas', 'verified');

-- 4. Distributors Profile
INSERT INTO Distributors (distributor_id, user_id, market_id, business_name, stall_number, business_description, verification_status)
VALUES 
(1, 5, 1, 'Aruna Wholesale Traders', 'Stall No. B-42', 'Specialized in wholesale distribution of tomatoes, capsicum, green chillies and beans with over 15 years experience.', 'verified'),
(2, 6, 2, 'Bandara & Sons Agri Dist', 'Stall No. P-15', 'High volume vegetable wholesaler at Manning Market Peliyagoda connecting provincial farmers to Colombo retail markets.', 'verified'),
(3, 7, 3, 'Perera Produce Traders', 'Stall No. M-08', 'Direct wholesale distributor supplying supermarkets and catering businesses across the Western Province.', 'verified');

-- 5. Distributor Requests & Connections
INSERT INTO DistributorRequests (request_id, supplier_id, distributor_id, request_type, request_status, supplier_confirmed, distributor_confirmed, admin_notes)
VALUES 
(1, 1, 1, 'initial', 'approved_and_connected', 1, 1, 'Mutual agreement confirmed via telephone. Commercial verification approved by admin.'),
(2, 2, 2, 'initial', 'approved_and_connected', 1, 1, 'Agreement validated by market superintendent.'),
(3, 3, 3, 'initial', 'pending_admin_review', 0, 0, 'New supplier connection request received. Awaiting admin facilitation.');

INSERT INTO DistributorConnections (connection_id, supplier_id, distributor_id, connection_status, start_date, activated_by, request_id)
VALUES 
(1, 1, 1, 'active', '2026-10-01', 1, 1),
(2, 2, 2, 'active', '2026-10-15', 1, 2);

-- 6. CBSL Price Reports
INSERT INTO CBSLPriceReports (report_id, report_date, source_url, synchronization_status, notes)
VALUES 
(1, '2026-11-04', 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report', 'verified', 'Official CBSL Daily Price Bulletin - November 04, 2026'),
(2, '2026-11-05', 'https://www.cbsl.gov.lk/en/statistics/economic-indicators/price-report', 'verified', 'Official CBSL Daily Price Bulletin - November 05, 2026');

-- 7. Vegetable Wholesale Prices from CBSL
INSERT INTO VegetablePrices (price_id, report_id, product_name, category, market_name, price_type, price, previous_price, price_change, percentage_change, unit)
VALUES 
(1, 2, 'Tomato', 'Vegetable', 'Dambulla', 'wholesale', 220.00, 180.00, 40.00, 22.22, 'kg'),
(2, 2, 'Carrot', 'Vegetable', 'Dambulla', 'wholesale', 280.00, 310.00, -30.00, -9.68, 'kg'),
(3, 2, 'Green Chilli', 'Vegetable', 'Dambulla', 'wholesale', 650.00, 550.00, 100.00, 18.18, 'kg'),
(4, 2, 'Beans (Green)', 'Vegetable', 'Dambulla', 'wholesale', 260.00, 240.00, 20.00, 8.33, 'kg'),
(5, 2, 'Cabbage', 'Vegetable', 'Dambulla', 'wholesale', 150.00, 160.00, -10.00, -6.25, 'kg'),
(6, 2, 'Leeks', 'Vegetable', 'Dambulla', 'wholesale', 230.00, 220.00, 10.00, 4.55, 'kg'),
(7, 2, 'Brinjal', 'Vegetable', 'Dambulla', 'wholesale', 190.00, 170.00, 20.00, 11.76, 'kg'),
(8, 2, 'Pumpkin', 'Vegetable', 'Dambulla', 'wholesale', 130.00, 130.00, 0.00, 0.00, 'kg'),
(9, 2, 'Lime', 'Vegetable', 'Dambulla', 'wholesale', 850.00, 700.00, 150.00, 21.43, 'kg'),
(10, 2, 'Banana (Ambul)', 'Fruit', 'Dambulla', 'wholesale', 175.00, 160.00, 15.00, 9.38, 'kg'),
(11, 2, 'Papaya', 'Fruit', 'Dambulla', 'wholesale', 135.00, 120.00, 15.00, 12.50, 'kg'),
(12, 2, 'Pineapple', 'Fruit', 'Dambulla', 'wholesale', 260.00, 260.00, 0.00, 0.00, 'kg');

-- 8. Price Alerts
INSERT INTO PriceAlerts (alert_id, supplier_id, price_id, product_name, previous_price, current_price, percentage_change, alert_type, message, is_read)
VALUES 
(1, 1, 1, 'Tomato', 180.00, 220.00, 22.22, 'significant_spike', 'Tomato price has increased by Rs. 40 (+22.22%) according to the latest official CBSL report for Dambulla.', 0),
(2, 1, 3, 'Green Chilli', 550.00, 650.00, 18.18, 'significant_spike', 'Green Chilli wholesale price increased by Rs. 100 (+18.18%) at Dambulla Dedicated Economic Centre.', 0),
(3, 2, 2, 'Carrot', 310.00, 280.00, -9.68, 'decrease', 'Carrot wholesale price decreased by Rs. 30 (-9.68%) at Dambulla Market.', 1),
(4, 1, 9, 'Lime', 700.00, 850.00, 21.43, 'significant_spike', 'Lime price jumped by Rs. 150 (+21.43%) due to seasonal supply fluctuations reported by CBSL.', 0);

-- 9. Deliveries & Settlements
INSERT INTO Deliveries (delivery_id, supplier_id, distributor_id, product_name, delivery_date, quantity_sent, quantity_received, damaged_quantity, rejected_quantity, accepted_quantity, agreed_price, total_amount, delivery_status, notes)
VALUES 
(1, 1, 1, 'Tomato', '2026-11-04', 100.00, 100.00, 10.00, 0.00, 90.00, 200.00, 18000.00, 'paid', 'First grade Welimada tomatoes delivered in standardized plastic crates.'),
(2, 1, 1, 'Green Chilli', '2026-11-05', 50.00, 50.00, 2.00, 0.00, 48.00, 600.00, 28800.00, 'pending_review', 'Spicy hot variety, harvested morning.'),
(3, 2, 2, 'Carrot', '2026-11-05', 200.00, 200.00, 30.00, 10.00, 160.00, 280.00, 44800.00, 'disputed', 'Washed Nuwara Eliya carrots.');

INSERT INTO DeliverySettlementConfirmations (confirmation_id, delivery_id, supplier_confirmation, distributor_confirmation, supplier_confirmed_at, distributor_confirmed_at, settlement_status, dispute_reason)
VALUES 
(1, 1, 1, 1, '2026-11-04 14:30:00', '2026-11-04 11:15:00', 'mutually_confirmed', NULL),
(2, 2, 0, 1, NULL, '2026-11-05 09:30:00', 'pending', NULL),
(3, 3, 0, 1, NULL, '2026-11-05 08:00:00', 'disputed', 'Supplier notes: 30kg damage claim is excessive; carrots were packed in double-layer bags with ice.');

-- 10. Product Feedback with photographic evidence
INSERT INTO ProductFeedback (feedback_id, delivery_id, distributor_id, quality_status, comments, image_url)
VALUES 
(1, 1, 1, 'Good', 'Very fresh batch of Welimada tomatoes. Minimal 10kg transit squeeze damage naturally accounted.', 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800'),
(2, 2, 1, 'Good', 'Excellent aroma and firmness. 2kg weight loss during transport accepted.', 'https://images.unsplash.com/photo-1588252303782-cb80119abd6d?w=800'),
(3, 3, 2, 'Average', 'Bottom layers sustained water accumulation and slight rot during transit.', 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=800');

-- 11. Payments (PayHere Sandbox)
INSERT INTO Payments (payment_id, delivery_id, supplier_id, distributor_id, amount, payment_method, transaction_reference, payhere_payment_id, payment_status, payment_date)
VALUES 
(1, 1, 1, 1, 18000.00, 'payhere_sandbox', 'MM-PH-20261104-001', '320025981240', 'completed', '2026-11-04 16:45:00');

-- 12. Reliability History
INSERT INTO ReliabilityHistory (history_id, user_id, related_delivery_id, activity_type, description, verified_status)
VALUES 
(1, 2, 1, 'delivery_completed', 'Delivered 100kg Tomato with 90kg accepted (90% fulfillment).', 1),
(2, 2, 1, 'settlement_confirmed', 'Mutually confirmed Digital Delivery Settlement Slip for Tomato delivery.', 1),
(3, 5, 1, 'payment_completed', 'Completed full payment of Rs. 18,000 via PayHere gateway on time.', 1),
(4, 5, 1, 'quality_rated_good', 'Rated supplier batch quality as Good with photographic evidence.', 1),
(5, 3, 3, 'delivery_disputed', 'Disputed 30kg damage deduction for Carrot delivery #3.', 1);

-- 13. Market Announcements
INSERT INTO MarketAnnouncements (announcement_id, market_id, title, description, announcement_type, start_date, end_date)
VALUES 
(1, 1, 'Dambulla Centre Special Cleaning & Unloading Hours', 'The Dambulla Dedicated Economic Centre premises will undergo deep cleaning on Sunday evening. Bulk lorries must complete unloading by 5:00 PM.', 'special_hours', '2026-11-06', '2026-11-08'),
(2, 2, 'Peliyagoda Traffic & Weather Advisory', 'Due to anticipated afternoon rainfall, Manning Market access ramp gate 3 will be restricted to light trucks only.', 'notice', '2026-11-05', '2026-11-07'),
(3, 3, 'Meegoda Centre Normal Operations Active', 'All trading bays, electronic weighing scales, and administrative counters operating at full capacity.', 'notice', '2026-11-01', '2026-11-30');

-- 14. Notifications
INSERT INTO Notifications (notification_id, user_id, title, message, notification_type, is_read)
VALUES 
(1, 2, 'Price Spike Alert: Tomato', 'Tomato price increased by +Rs. 40 (+22.2%) in Dambulla CBSL report.', 'price_alert', 0),
(2, 2, 'Payment Received: Rs. 18,000', 'Distributor Aruna Wholesale Traders paid Rs. 18,000 for Delivery #1 via PayHere.', 'payment_update', 1),
(3, 5, 'New Delivery Recorded: #2 Green Chilli', 'Delivery slip generated for 50kg Green Chilli. Awaiting supplier confirmation.', 'delivery_update', 0),
(4, 1, 'New Connection Request #3', 'Supplier Ravi Kumar submitted connection request to Perera Produce Traders.', 'connection_update', 0);
