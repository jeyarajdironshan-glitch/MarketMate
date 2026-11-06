-- =====================================================================
-- MarketMate Database Schema (MySQL Compatible)
-- Industry: AgriTech / Agricultural Supply Chain (Sri Lanka)
-- Platform: Web Application
-- =====================================================================

CREATE DATABASE IF NOT EXISTS marketmate_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE marketmate_db;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS Users (
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
CREATE TABLE IF NOT EXISTS Markets (
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
CREATE TABLE IF NOT EXISTS Distributors (
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
CREATE TABLE IF NOT EXISTS Suppliers (
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
CREATE TABLE IF NOT EXISTS DistributorRequests (
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
-- Business Rule: Each supplier can have ONLY ONE active distributor connection at any time!
CREATE TABLE IF NOT EXISTS DistributorConnections (
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
CREATE TABLE IF NOT EXISTS CBSLPriceReports (
    report_id INT AUTO_INCREMENT PRIMARY KEY,
    report_date DATE NOT NULL,
    source_url VARCHAR(350) NOT NULL,
    retrieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    synchronization_status ENUM('success', 'pending', 'failed', 'verified') DEFAULT 'verified',
    notes TEXT
) ENGINE=InnoDB;

-- 8. VegetablePrices Table (Daily wholesale/retail commodity prices from CBSL)
CREATE TABLE IF NOT EXISTS VegetablePrices (
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
CREATE TABLE IF NOT EXISTS PriceAlerts (
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

-- 10. Deliveries Table
CREATE TABLE IF NOT EXISTS Deliveries (
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
CREATE TABLE IF NOT EXISTS DeliverySettlementConfirmations (
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
CREATE TABLE IF NOT EXISTS ProductFeedback (
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
CREATE TABLE IF NOT EXISTS Payments (
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

-- 14. ReliabilityHistory Table (Verified platform audit trail)
CREATE TABLE IF NOT EXISTS ReliabilityHistory (
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
CREATE TABLE IF NOT EXISTS MarketAnnouncements (
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
CREATE TABLE IF NOT EXISTS Notifications (
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

-- Indexes for high-frequency queries
CREATE INDEX idx_dist_market ON Distributors(market_id);
CREATE INDEX idx_supp_market ON Suppliers(preferred_market_id);
CREATE INDEX idx_conn_active ON DistributorConnections(supplier_id, connection_status);
CREATE INDEX idx_veg_report ON VegetablePrices(report_id, market_name);
CREATE INDEX idx_deliv_supplier ON Deliveries(supplier_id);
CREATE INDEX idx_deliv_distributor ON Deliveries(distributor_id);
CREATE INDEX idx_pay_delivery ON Payments(delivery_id);
CREATE INDEX idx_notif_user ON Notifications(user_id, is_read);
