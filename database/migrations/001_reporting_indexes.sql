USE barytes_management;

-- Run once on an existing installation to speed up date-filtered dashboard/report queries.
-- If an index already exists under a different name, omit that individual ALTER statement.
ALTER TABLE attendance ADD INDEX idx_attendance_date_status (attendance_date, status);
ALTER TABLE production_logs ADD INDEX idx_production_date (production_date);
ALTER TABLE lorry_trips ADD INDEX idx_lorry_trip_date_status (trip_date, status);
ALTER TABLE orders ADD INDEX idx_orders_date_status (order_date, status);
ALTER TABLE invoices ADD INDEX idx_invoice_date_status (invoice_date, payment_status);
ALTER TABLE payments ADD INDEX idx_payments_invoice_date (invoice_id, payment_date);
