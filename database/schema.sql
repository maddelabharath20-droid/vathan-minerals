CREATE DATABASE IF NOT EXISTS barytes_management
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE barytes_management;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','manager','accounts','production','dispatch','hr') NOT NULL DEFAULT 'manager',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  job_title VARCHAR(100),
  date_joined DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  face_photo MEDIUMTEXT NULL,
  face_descriptor LONGTEXT NULL,
  fingerprint_image MEDIUMTEXT NULL,
  fingerprint_template LONGTEXT NULL,
  fingerprint_quality INT NULL,
  fingerprint_enrolled_at TIMESTAMP NULL,
  personal_password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  employee_id BIGINT UNSIGNED NOT NULL,
  attendance_date DATE NOT NULL,
  status ENUM('present','absent','leave','half_day') NOT NULL,
  check_in TIME NULL,
  check_out TIME NULL,
  notes VARCHAR(500),
  verification_type ENUM('manual','face_recognition','fingerprint') DEFAULT 'manual',
  face_snapshot MEDIUMTEXT NULL,
  fingerprint_snapshot MEDIUMTEXT NULL,
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_attendance_employee_date(employee_id, attendance_date),
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS products (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  sku VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  grade VARCHAR(80),
  stock_type ENUM('raw_barytes','finished_powder','packing_material') NOT NULL,
  unit ENUM('tonne','bag','piece') NOT NULL DEFAULT 'tonne',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS production_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  production_date DATE NOT NULL,
  raw_product_id BIGINT UNSIGNED NOT NULL,
  finished_product_id BIGINT UNSIGNED NOT NULL,
  raw_input_tonnes DECIMAL(12,3) NOT NULL,
  finished_output_tonnes DECIMAL(12,3) NOT NULL,
  wastage_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0,
  shift_name VARCHAR(50),
  notes VARCHAR(500),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (raw_product_id) REFERENCES products(id),
  FOREIGN KEY (finished_product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (raw_input_tonnes >= 0 AND finished_output_tonnes >= 0 AND wastage_tonnes >= 0)
);

CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NOT NULL,
  movement_date DATE NOT NULL,
  movement_type ENUM('opening','purchase','production_in','production_out','dispatch','adjustment','return') NOT NULL,
  quantity_tonnes DECIMAL(12,3) NOT NULL,
  direction ENUM('in','out') NOT NULL,
  reference_type VARCHAR(40),
  reference_id BIGINT UNSIGNED,
  notes VARCHAR(500),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_stock_product_date(product_id, movement_date)
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(190),
  billing_address TEXT,
  gstin VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id BIGINT UNSIGNED NOT NULL,
  order_date DATE NOT NULL,
  due_date DATE,
  status ENUM('pending','in_progress','dispatched','completed','cancelled') NOT NULL DEFAULT 'pending',
  notes VARCHAR(500),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  quantity_tonnes DECIMAL(12,3) NOT NULL,
  rate_per_tonne DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  CHECK (quantity_tonnes > 0 AND rate_per_tonne >= 0)
);

CREATE TABLE IF NOT EXISTS invoices (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  order_id BIGINT UNSIGNED,
  customer_id BIGINT UNSIGNED NOT NULL,
  invoice_date DATE NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL,
  payment_status ENUM('unpaid','partial','paid') NOT NULL DEFAULT 'unpaid',
  notes VARCHAR(500),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  product_id BIGINT UNSIGNED NOT NULL,
  description VARCHAR(255),
  quantity_tonnes DECIMAL(12,3) NOT NULL,
  rate_per_tonne DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  invoice_id BIGINT UNSIGNED NOT NULL,
  payment_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  method ENUM('cash','bank_transfer','upi','cheque','other') NOT NULL DEFAULT 'bank_transfer',
  reference_number VARCHAR(100),
  notes VARCHAR(500),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id),
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (amount > 0)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  registration_number VARCHAR(30) NOT NULL UNIQUE,
  vehicle_type VARCHAR(80),
  capacity_tonnes DECIMAL(10,3),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS drivers (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  licence_number VARCHAR(80),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS lorry_trips (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  trip_date DATE NOT NULL,
  vehicle_id BIGINT UNSIGNED NOT NULL,
  driver_id BIGINT UNSIGNED,
  order_id BIGINT UNSIGNED,
  invoice_id BIGINT UNSIGNED,
  destination VARCHAR(255),
  gross_weight_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0,
  tare_weight_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0,
  net_weight_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0,
  status ENUM('planned','loaded','dispatched','delivered','cancelled') NOT NULL DEFAULT 'planned',
  weighbridge_slip VARCHAR(100),
  notes VARCHAR(500),
  created_by BIGINT UNSIGNED,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (vehicle_id) REFERENCES vehicles(id),
  FOREIGN KEY (driver_id) REFERENCES drivers(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CHECK (gross_weight_tonnes >= 0 AND tare_weight_tonnes >= 0 AND net_weight_tonnes >= 0)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT UNSIGNED,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT UNSIGNED,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Fingerprint / WebAuthn biometric credentials
CREATE TABLE IF NOT EXISTS fingerprint_credentials (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  employee_id BIGINT UNSIGNED NOT NULL,
  credential_id VARCHAR(700) NOT NULL,        -- WebAuthn base64url credential ID
  public_key MEDIUMTEXT NOT NULL,             -- base64-encoded COSE public key
  counter BIGINT UNSIGNED DEFAULT 0,          -- signature counter (replay protection)
  device_type VARCHAR(255) DEFAULT 'singleDevice',
  transports VARCHAR(200) DEFAULT NULL,       -- comma-separated transport hints
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP NULL,
  UNIQUE KEY uq_cred_id (credential_id(500)),
  INDEX idx_emp_id (employee_id),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);
