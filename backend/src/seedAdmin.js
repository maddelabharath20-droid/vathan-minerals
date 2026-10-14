import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';

if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error('Set ADMIN_EMAIL and an ADMIN_PASSWORD of at least 12 characters in .env');
  process.exit(1);
}
try {
  const hash=await bcrypt.hash(process.env.ADMIN_PASSWORD,12);
  await pool.execute(
    `INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')
     ON DUPLICATE KEY UPDATE name=VALUES(name),password_hash=VALUES(password_hash),role='admin',active=1`,
    [process.env.ADMIN_NAME||'Company Administrator',process.env.ADMIN_EMAIL.toLowerCase(),hash]
  );
  console.log(`Admin user ready: ${process.env.ADMIN_EMAIL}`);
} finally { await pool.end(); }
