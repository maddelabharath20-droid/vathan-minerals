import { pool } from './db.js';
import bcrypt from 'bcryptjs';

async function updateAdmin() {
  const newEmail = 'vathanminerals6336@gmail.com';
  const newPassword = 'Mv@88904';
  const hash = await bcrypt.hash(newPassword, 12);

  const [existing] = await pool.execute('SELECT id FROM users WHERE email = ?', [newEmail]);
  if (existing.length > 0) {
    await pool.execute(
      'UPDATE users SET password_hash = ?, role = "admin", name = "Vathan Minerals Administrator", active = 1 WHERE email = ?',
      [hash, newEmail]
    );
    console.log(`Updated user ${newEmail} to admin with new password.`);
  } else {
    await pool.execute(
      'UPDATE users SET email = ?, password_hash = ?, role = "admin", name = "Vathan Minerals Administrator", active = 1 WHERE id = 1',
      [newEmail, hash]
    );
    console.log(`Updated user ID 1 email to ${newEmail} and password.`);
  }

  const [rows] = await pool.execute('SELECT id, name, email, role, active FROM users WHERE email = ?', [newEmail]);
  console.log('Verified updated admin in DB:', rows);
  process.exit(0);
}

updateAdmin().catch(err => {
  console.error(err);
  process.exit(1);
});
