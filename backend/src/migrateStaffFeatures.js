import { pool } from './db.js';

async function migrate() {
  console.log('Running migration for Staff Portal, Leave Approval, and Salaries...');

  // 1. Update users table role and add employee_id
  try {
    await pool.execute(`
      ALTER TABLE users 
      MODIFY COLUMN role ENUM('admin','manager','accounts','production','dispatch','hr','staff') NOT NULL DEFAULT 'manager'
    `);
    console.log('Updated users role enum to include staff.');
  } catch (e) {
    console.log('Role enum update:', e.message);
  }

  try {
    await pool.execute(`
      ALTER TABLE users 
      ADD COLUMN employee_id BIGINT UNSIGNED NULL AFTER role
    `);
    console.log('Added employee_id column to users.');
  } catch (e) {
    console.log('employee_id column note:', e.message);
  }

  // 2. Create leave_requests table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS leave_requests (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      employee_id BIGINT UNSIGNED NOT NULL,
      leave_type ENUM('casual','sick','annual','emergency','unpaid') NOT NULL DEFAULT 'casual',
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      days_count DECIMAL(4,1) NOT NULL DEFAULT 1.0,
      reason TEXT NOT NULL,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      reviewed_by BIGINT UNSIGNED NULL,
      reviewed_at TIMESTAMP NULL,
      review_notes TEXT NULL,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
      INDEX idx_leave_emp_status(employee_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('leave_requests table verified/created.');

  // 3. Create salaries table
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS salaries (
      id BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
      employee_id BIGINT UNSIGNED NOT NULL,
      month_year VARCHAR(7) NOT NULL,
      basic_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
      allowances DECIMAL(10,2) NOT NULL DEFAULT 0,
      deductions DECIMAL(10,2) NOT NULL DEFAULT 0,
      net_salary DECIMAL(10,2) NOT NULL DEFAULT 0,
      payment_status ENUM('paid','processing','pending') NOT NULL DEFAULT 'pending',
      payment_date DATE NULL,
      payment_method VARCHAR(80) DEFAULT 'Bank Transfer (NEFT/IMPS)',
      transaction_ref VARCHAR(100) NULL,
      notes VARCHAR(255) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_employee_salary_month(employee_id, month_year),
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log('salaries table verified/created.');

  // 4. Seed initial sample salary records for employees if empty
  const [existingSalaries] = await pool.execute('SELECT COUNT(*) as cnt FROM salaries');
  if (existingSalaries[0].cnt === 0) {
    console.log('Seeding initial salary records for staff...');
    const [employees] = await pool.execute('SELECT id, full_name, job_title FROM employees');
    const months = ['2026-10', '2026-09'];
    
    for (const emp of employees) {
      // Determine realistic salary by job title
      let base = 25000;
      if (emp.job_title?.toUpperCase().includes('MANAGER')) base = 45000;
      else if (emp.job_title?.toUpperCase().includes('INCHARGE') || emp.job_title?.toUpperCase().includes('SUPERVISOR')) base = 32000;
      else if (emp.job_title?.toUpperCase().includes('OPERATOR')) base = 26000;
      else if (emp.job_title?.toUpperCase().includes('DRIVER')) base = 24000;
      else if (emp.job_title?.toUpperCase().includes('HELPER') || emp.job_title?.toUpperCase().includes('WORK')) base = 20000;

      for (const m of months) {
        const allowance = 3000;
        const deduction = m === '2026-10' ? 1200 : 1500;
        const net = base + allowance - deduction;
        const status = m === '2026-09' ? 'paid' : 'processing';
        const pDate = m === '2026-09' ? '2026-10-05' : null;
        const txn = m === '2026-09' ? `VM-NEFT-${emp.id}9824` : null;

        await pool.execute(`
          INSERT IGNORE INTO salaries 
          (employee_id, month_year, basic_salary, allowances, deductions, net_salary, payment_status, payment_date, transaction_ref, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [emp.id, m, base, allowance, deduction, net, status, pDate, txn, `${m} Salary for ${emp.full_name}`]);
      }
    }
    console.log('Seeded salaries for all staff.');
  }

  // 5. Seed sample leave requests if empty
  const [existingLeaves] = await pool.execute('SELECT COUNT(*) as cnt FROM leave_requests');
  if (existingLeaves[0].cnt === 0) {
    console.log('Seeding sample leave requests...');
    const [employees] = await pool.execute('SELECT id FROM employees LIMIT 5');
    if (employees.length >= 3) {
      await pool.execute(`
        INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status, review_notes)
        VALUES 
        (?, 'casual', '2026-10-20', '2026-10-21', 2, 'Family function in native village', 'approved', 'Approved by Operations Manager. Shift adjusted.'),
        (?, 'sick', '2026-10-14', '2026-10-15', 2, 'Viral fever, medical rest advised', 'approved', 'Approved on submission of medical slip.'),
        (?, 'annual', '2026-10-25', '2026-10-28', 4, 'Annual festive vacation and temple visit', 'pending', NULL)
      `, [employees[0].id, employees[1].id, employees[2].id]);
      console.log('Seeded initial leave requests.');
    }
  }

  console.log('Migration completed successfully.');
  process.exit(0);
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
