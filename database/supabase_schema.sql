-- =============================================================================
-- VATHAN MINERALS - MINING · Rly Kodur, Andhra Pradesh
-- Proprietor: MADDELA VENKATA SUBBAIAH
-- Complete Supabase / PostgreSQL Production Schema & Biometric Architecture
-- =============================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ADMINISTRATORS
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL DEFAULT 'manager' CHECK (role IN ('admin','manager','accounts','production','dispatch','hr')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. EMPLOYEES (With AI Facial & Biometric Fingerprint Storage)
CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  employee_code VARCHAR(40) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  job_title VARCHAR(100),
  date_joined DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  face_photo TEXT NULL,
  face_descriptor TEXT NULL,
  fingerprint_image TEXT NULL,
  fingerprint_template TEXT NULL,
  fingerprint_quality INT NULL,
  fingerprint_enrolled_at TIMESTAMP WITH TIME ZONE NULL,
  personal_password_hash VARCHAR(255) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. ATTENDANCE & BIOMETRIC VERIFICATION LOGS
CREATE TABLE IF NOT EXISTS attendance (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present','absent','leave','half_day')),
  check_in TIME NULL,
  check_out TIME NULL,
  notes VARCHAR(500),
  verification_type VARCHAR(30) DEFAULT 'manual' CHECK (verification_type IN ('manual','face_recognition','fingerprint')),
  face_snapshot TEXT NULL,
  fingerprint_snapshot TEXT NULL,
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_attendance_employee_date UNIQUE (employee_id, attendance_date)
);

-- 4. FINGERPRINT & WEBAUTHN CREDENTIALS (Mantra MFS100 / RD Service / Laptop Biometrics)
CREATE TABLE IF NOT EXISTS fingerprint_credentials (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  credential_id VARCHAR(700) NOT NULL UNIQUE,
  public_key TEXT NOT NULL,
  counter BIGINT DEFAULT 0,
  device_type VARCHAR(255) DEFAULT 'Mantra MFS100 USB',
  transports VARCHAR(200) DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_used TIMESTAMP WITH TIME ZONE NULL
);

CREATE INDEX IF NOT EXISTS idx_fp_cred_employee ON fingerprint_credentials(employee_id);

-- 5. LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS leave_requests (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  leave_type VARCHAR(20) NOT NULL DEFAULT 'casual' CHECK (leave_type IN ('casual','sick','annual','emergency','unpaid')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count DECIMAL(4,1) NOT NULL DEFAULT 1.0,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  reviewed_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE NULL,
  review_notes TEXT NULL
);

-- 6. SALARIES & PAYSLIPS
CREATE TABLE IF NOT EXISTS salaries (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL,
  basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  allowances DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  deductions DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  net_salary DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('paid','processing','pending')),
  payment_date DATE NULL,
  payment_method VARCHAR(80) DEFAULT 'Bank Transfer (NEFT/IMPS)',
  transaction_ref VARCHAR(100),
  notes VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. PRODUCTS & INVENTORY
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  sku VARCHAR(60) NOT NULL UNIQUE,
  name VARCHAR(160) NOT NULL,
  grade VARCHAR(80),
  stock_type VARCHAR(30) NOT NULL CHECK (stock_type IN ('raw_barytes','finished_powder','packing_material')),
  unit VARCHAR(20) NOT NULL DEFAULT 'tonne' CHECK (unit IN ('tonne','bag','piece')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. PRODUCTION LOGS
CREATE TABLE IF NOT EXISTS production_logs (
  id BIGSERIAL PRIMARY KEY,
  production_date DATE NOT NULL,
  raw_product_id BIGINT NOT NULL REFERENCES products(id),
  finished_product_id BIGINT NOT NULL REFERENCES products(id),
  raw_input_tonnes DECIMAL(12,3) NOT NULL CHECK (raw_input_tonnes >= 0),
  finished_output_tonnes DECIMAL(12,3) NOT NULL CHECK (finished_output_tonnes >= 0),
  wastage_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (wastage_tonnes >= 0),
  shift_name VARCHAR(50),
  notes VARCHAR(500),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. STOCK MOVEMENTS
CREATE TABLE IF NOT EXISTS stock_movements (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id),
  movement_date DATE NOT NULL,
  movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN ('opening','purchase','production_in','production_out','dispatch','adjustment','return')),
  quantity_tonnes DECIMAL(12,3) NOT NULL,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('in','out')),
  reference_type VARCHAR(40),
  reference_id BIGINT,
  notes VARCHAR(500),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_stock_prod_date ON stock_movements(product_id, movement_date);

-- 10. CUSTOMERS
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(180) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(190),
  billing_address TEXT,
  gstin VARCHAR(20),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 11. ORDERS
CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  order_date DATE NOT NULL,
  due_date DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','dispatched','completed','cancelled')),
  notes VARCHAR(500),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. ORDER ITEMS
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity_tonnes DECIMAL(12,3) NOT NULL CHECK (quantity_tonnes > 0),
  rate_per_tonne DECIMAL(12,2) NOT NULL CHECK (rate_per_tonne >= 0)
);

-- 13. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  customer_id BIGINT NOT NULL REFERENCES customers(id),
  invoice_date DATE NOT NULL,
  subtotal DECIMAL(14,2) NOT NULL,
  tax_rate DECIMAL(5,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(14,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(14,2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  notes VARCHAR(500),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 14. INVOICE ITEMS
CREATE TABLE IF NOT EXISTS invoice_items (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  description VARCHAR(255),
  quantity_tonnes DECIMAL(12,3) NOT NULL,
  rate_per_tonne DECIMAL(12,2) NOT NULL,
  line_total DECIMAL(14,2) NOT NULL
);

-- 15. PAYMENTS
CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  invoice_id BIGINT NOT NULL REFERENCES invoices(id),
  payment_date DATE NOT NULL,
  amount DECIMAL(14,2) NOT NULL CHECK (amount > 0),
  method VARCHAR(30) NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('cash','bank_transfer','upi','cheque','other')),
  reference_number VARCHAR(100),
  notes VARCHAR(500),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. VEHICLES & FLEET
CREATE TABLE IF NOT EXISTS vehicles (
  id BIGSERIAL PRIMARY KEY,
  registration_number VARCHAR(30) NOT NULL UNIQUE,
  vehicle_type VARCHAR(80),
  capacity_tonnes DECIMAL(10,3),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(160) NOT NULL,
  phone VARCHAR(30),
  licence_number VARCHAR(80),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- 18. LORRY TRIPS
CREATE TABLE IF NOT EXISTS lorry_trips (
  id BIGSERIAL PRIMARY KEY,
  trip_date DATE NOT NULL,
  vehicle_id BIGINT NOT NULL REFERENCES vehicles(id),
  driver_id BIGINT REFERENCES drivers(id) ON DELETE SET NULL,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  invoice_id BIGINT REFERENCES invoices(id) ON DELETE SET NULL,
  destination VARCHAR(255),
  gross_weight_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (gross_weight_tonnes >= 0),
  tare_weight_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (tare_weight_tonnes >= 0),
  net_weight_tonnes DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (net_weight_tonnes >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','loaded','dispatched','delivered','cancelled')),
  weighbridge_slip VARCHAR(100),
  notes VARCHAR(500),
  created_by BIGINT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 19. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id BIGINT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- SEED INITIAL EMPLOYEES & STAFF (VATHAN MINERALS - Rly. Kodur)
-- =============================================================================
INSERT INTO employees (id, employee_code, full_name, phone, job_title, active) VALUES
(1, 'B-001', 'Bharath Maddela', '+91 9030678492', 'System Manager', TRUE),
(2, 'EMP-002', 'Ramesh Kumar', '9848012345', 'Mining Supervisor', TRUE),
(4, '001', 'RAMA CHANDRAIAH', '001', 'Mill Operator', TRUE),
(5, '002', 'SIVA', '7396063526', 'Supervisor', TRUE),
(6, '005', 'MADDELA KRISHNA', '9542938030', 'Mill Incharge', TRUE),
(7, '006', 'HARI BABU', '9848903651', 'Hitachi Operator', TRUE),
(8, '007', 'KISHORE', '8374757324', 'Hitachi Helper', TRUE),
(9, '008', 'NAVEEN', '9949405770', 'Office Incharge', TRUE),
(10, '009', 'CHANDRA', '7674859036', 'Manager', TRUE),
(11, '010', 'NAGARJUNA', '918207556', 'Manager', TRUE),
(12, '003003', 'SUBODH', '7416189916', 'Operator & Watchman', TRUE),
(13, '004', 'GOURANGO BERA', '6304418709', 'Operator Helper', TRUE),
(14, '011', 'NAVEEN CHOWDARY', '9030518149', 'Office Worker', TRUE),
(15, '012', 'PENCHILAIAH', '9666431729', 'Driver', TRUE)
ON CONFLICT (employee_code) DO NOTHING;

-- Reset sequence to prevent ID collision
SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees));
