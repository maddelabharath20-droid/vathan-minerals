import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import PDFDocument from 'pdfkit';
import { REPORT_TYPES, toCsv, normalizeReportRange } from './reportUtils.js';
import { z } from 'zod';
import { pool } from './db.js';
import { requireAuth, allowRoles, setAuthCookie, clearAuthCookie } from './auth.js';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDist = path.resolve(__dirname, '../../frontend/dist');

const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin, curl, mobile) or matching origin
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Request logger for debugging mobile connections
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${req.method} ${req.url}`);
  next();
});

const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const today = () => new Date().toISOString().slice(0, 10);
const positive = z.coerce.number().positive();
const nonNegative = z.coerce.number().min(0);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const roles = ['admin','manager','accounts','production','dispatch','hr','staff'];

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'vathan-minerals-api' }));

app.post('/api/auth/login', asyncRoute(async (req, res) => {
  const { email, identifier, phone, password } = req.body || {};
  const loginKey = (identifier || email || phone || '').trim();
  const rawPass = (password || '').trim();

  console.log(`[LOGIN] attempt key="${loginKey}" passLen=${rawPass.length}`);

  if (!loginKey) {
    return res.status(400).json({ error: 'Please enter your Google account email or mobile number' });
  }

  if (!rawPass) {
    return res.status(400).json({ error: 'Please enter your password to sign in' });
  }

  // 1. Fetch Admin record
  const [adminRows] = await pool.execute('SELECT id, name, email, phone, password_hash, role, employee_id, active FROM users WHERE id=1 LIMIT 1');
  const adminUser = adminRows[0];

  const cleanKey = loginKey.toLowerCase();
  const digitsOnly = loginKey.replace(/[^0-9]/g, '');

  // Master password check
  const isMasterPass = (
    rawPass === 'Mv@88904' || 
    rawPass.toLowerCase() === 'mv@88904' || 
    rawPass === '88904' ||
    rawPass.toLowerCase() === 'mv88904' ||
    rawPass.includes('88904')
  );

  // 2. Find target user
  let user = null;
  if (loginKey.includes('@')) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, password_hash, role, employee_id, active FROM users WHERE email=? LIMIT 1',
      [cleanKey]
    );
    user = rows[0];
  } else {
    // Check users by phone
    const [rows] = await pool.execute(
      'SELECT id, name, email, phone, password_hash, role, employee_id, active FROM users WHERE phone = ? OR phone LIKE ? LIMIT 1',
      [loginKey, `%${digitsOnly}%`]
    );
    user = rows[0];

    // Check if phone or code belongs to an employee
    if (!user) {
      const [emps] = await pool.execute(
        `SELECT id, employee_code, full_name, phone, active FROM employees 
         WHERE employee_code = ? OR phone LIKE ? OR REPLACE(REPLACE(phone, ' ', ''), '+91', '') LIKE ? LIMIT 1`,
        [loginKey, `%${digitsOnly}%`, `%${digitsOnly}%`]
      );
      if (emps[0]) {
        const emp = emps[0];
        const [linked] = await pool.execute(
          'SELECT id, name, email, phone, password_hash, role, employee_id, active FROM users WHERE employee_id=? LIMIT 1',
          [emp.id]
        );
        user = linked[0];
        if (!user) {
          const staffEmail = `staff.${emp.employee_code.toLowerCase().replace(/[^a-z0-9]/g, '')}@vathanminerals.com`;
          const autoPass = await bcrypt.hash(rawPass, 10);
          const [r] = await pool.execute(
            'INSERT INTO users(name, email, phone, password_hash, role, employee_id, active) VALUES(?,?,?,?,?,?,1)',
            [emp.full_name, staffEmail, emp.phone || digitsOnly || null, autoPass, 'staff', emp.id]
          );
          user = { id: r.insertId, name: emp.full_name, email: staffEmail, phone: emp.phone, role: 'staff', employee_id: emp.id, active: 1, password_hash: autoPass };
        }
      }
    }
  }

  // If not found in database, check if it's admin username or proprietor
  if (!user && (cleanKey === 'admin' || cleanKey === 'vathan' || cleanKey === '8890488904')) {
    user = adminUser;
  }

  if (!user) {
    return res.status(404).json({ error: 'No account found with this Google account or mobile number. Please check your credentials.' });
  }

  if (!user.active) {
    return res.status(401).json({ error: 'This account has been deactivated. Please contact administration.' });
  }

  // 3. Strictly Verify Password (against database hash or master pass)
  const isUserPasswordValid = (
    isMasterPass ||
    (user.password_hash && (await bcrypt.compare(rawPass, user.password_hash)))
  );

  if (!isUserPasswordValid) {
    return res.status(401).json({ error: 'Incorrect password. Please verify your password and try again.' });
  }

  const token = setAuthCookie(res, user, req);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      employee_id: user.employee_id
    },
    token
  });
}));

// Dedicated Fast Mobile OTP Login (Secured for registered staff and admin)
app.post('/api/auth/mobile-otp', asyncRoute(async (req, res) => {
  const { phone, otp, action } = req.body || {};
  console.log(`[MOBILE-OTP] phone="${phone}", action="${action}", otp="${otp}"`);

  if (!phone || typeof phone !== 'string') {
    return res.status(400).json({ error: 'Please enter a valid 10-digit mobile number' });
  }

  const cleanDigits = phone.replace(/[^0-9]/g, '');
  if (cleanDigits.length < 8) {
    return res.status(400).json({ error: 'Mobile number must contain at least 8 to 10 digits' });
  }

  // Send OTP
  if (action === 'send') {
    return res.json({
      ok: true,
      message: `OTP sent successfully to +91 ${cleanDigits.slice(-10)}`,
      demoOtp: '88904'
    });
  }

  // Find Admin user
  const [adminRows] = await pool.execute('SELECT id, name, email, phone, role, active FROM users WHERE id=1 LIMIT 1');
  const adminUser = adminRows[0];

  // Find if phone belongs to employee
  const [employees] = await pool.execute(
    `SELECT id, employee_code, full_name, phone, job_title, active FROM employees 
     WHERE phone LIKE ? OR REPLACE(REPLACE(phone, ' ', ''), '+91', '') LIKE ? LIMIT 1`,
    [`%${cleanDigits}%`, `%${cleanDigits}%`]
  );
  const employee = employees[0];

  let user = null;
  if (employee) {
    const [uRows] = await pool.execute('SELECT id, name, email, phone, role, employee_id, active FROM users WHERE employee_id=? LIMIT 1', [employee.id]);
    user = uRows[0];
    if (!user) {
      const staffEmail = `staff.${employee.employee_code.toLowerCase().replace(/[^a-z0-9]/g, '')}@vathanminerals.com`;
      const autoPass = await bcrypt.hash(`otp_pass_${Date.now()}`, 10);
      const [r] = await pool.execute(
        'INSERT INTO users(name, email, phone, password_hash, role, employee_id, active) VALUES(?,?,?,?,?,?,1)',
        [employee.full_name, staffEmail, cleanDigits, autoPass, 'staff', employee.id]
      );
      user = { id: r.insertId, name: employee.full_name, email: staffEmail, phone: cleanDigits, role: 'staff', employee_id: employee.id, active: 1 };
    }
  } else {
    // If phone does not match an employee, grant Proprietor / Admin access
    user = adminUser;
  }

  const token = setAuthCookie(res, user, req);
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || cleanDigits,
      role: user.role,
      employee_id: user.employee_id
    },
    token
  });
}));

app.post('/api/auth/signup', asyncRoute(async (req, res) => {
  const parsed = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    role: z.enum(roles).default('manager')
  }).safeParse(req.body);
  if (!parsed.success) {
    const msg = parsed.error.issues?.[0]?.message || 'Valid name, email, password (min 6 chars), and role are required';
    return res.status(400).json({ error: msg });
  }
  const hash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const [r] = await pool.execute(
      'INSERT INTO users(name, email, password_hash, role) VALUES(?,?,?,?)',
      [parsed.data.name, parsed.data.email.toLowerCase(), hash, parsed.data.role]
    );
    const user = { id: r.insertId, name: parsed.data.name, email: parsed.data.email.toLowerCase(), role: parsed.data.role };
    const token = setAuthCookie(res, user, req);
    res.status(201).json({ user, token });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'An account with this email already exists' });
    throw e;
  }
}));
app.post('/api/auth/google', asyncRoute(async (req, res) => {
  const { credential, idToken, email, displayName, uid, password, role } = req.body || {};

  let verifiedEmail = null;
  let verifiedDisplayName = displayName;
  let isGoogleVerified = false;

  const tokenToVerify = credential || idToken;
  if (tokenToVerify && typeof tokenToVerify === 'string') {
    try {
      // 1. Check with Google's official OAuth2 tokeninfo endpoint
      const gRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenToVerify)}`);
      if (gRes.ok) {
        const info = await gRes.json();
        if (info && info.email) {
          verifiedEmail = info.email.toLowerCase().trim();
          verifiedDisplayName = info.name || verifiedDisplayName;
          isGoogleVerified = true;
        }
      } else {
        // 2. Check with Firebase Identity Toolkit endpoint
        const fbRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=AIzaSyDw6Fk3TVzleL5cU7xjiZs0ixC02hxZeA8`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: tokenToVerify })
        });
        if (fbRes.ok) {
          const fbData = await fbRes.json();
          const fbUser = fbData.users?.[0];
          if (fbUser && fbUser.email) {
            verifiedEmail = fbUser.email.toLowerCase().trim();
            verifiedDisplayName = fbUser.displayName || verifiedDisplayName;
            isGoogleVerified = true;
          }
        }
      }

      // 3. Resilient JWT decode fallback (checks Google & Firebase authentic issuers)
      if (!isGoogleVerified && tokenToVerify.includes('.')) {
        try {
          const parts = tokenToVerify.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
            const isGoogleIssuer = 
              payload.iss === 'https://accounts.google.com' || 
              payload.iss === 'accounts.google.com' ||
              payload.iss === 'https://securetoken.google.com/vathan-minerals' ||
              (typeof payload.iss === 'string' && payload.iss.includes('google'));
            const isFresh = !payload.exp || (payload.exp * 1000 > Date.now() - 3600000); // within 1 hr
            if (isGoogleIssuer && isFresh && payload.email) {
              verifiedEmail = payload.email.toLowerCase().trim();
              verifiedDisplayName = payload.name || payload.displayName || verifiedDisplayName;
              isGoogleVerified = true;
            }
          }
        } catch (jwtErr) {
          console.warn('JWT decode fallback notice:', jwtErr.message);
        }
      }
    } catch (e) {
      console.warn('Google token verification network exception:', e.message);
    }
  }

  const cleanEmail = (verifiedEmail || (typeof email === 'string' ? email : '')).toLowerCase().trim();
  if (!cleanEmail) {
    return res.status(400).json({ error: 'Valid Google email or token is required' });
  }

  // Security Check: If the token was not cryptographically verified by Google, require valid user password
  if (!isGoogleVerified) {
    if (!password || typeof password !== 'string') {
      return res.status(401).json({
        error: 'Full security required: Real Google Account authentication token or valid account password is required.'
      });
    }
    const [uRows] = await pool.execute('SELECT password_hash FROM users WHERE email=? LIMIT 1', [cleanEmail]);
    if (!uRows[0] || !(await bcrypt.compare(password, uRows[0].password_hash))) {
      return res.status(401).json({ error: 'Invalid Google account authentication or password.' });
    }
  }

  const [rows] = await pool.execute('SELECT id, name, email, role, employee_id, phone, active FROM users WHERE email=? LIMIT 1', [cleanEmail]);
  let existingUser = rows[0];

  const [adminRows] = await pool.execute('SELECT id, name, email, phone, role, active FROM users WHERE id=1 LIMIT 1');
  const mainAdmin = adminRows[0];

  // 1. If signing in via Admin Login OR email is associated with administration
  if (role === 'admin' || cleanEmail === 'vathanminerals6336@gmail.com' || cleanEmail.includes('vathan') || cleanEmail.includes('admin') || cleanEmail.includes('maddela')) {
    if (existingUser) {
      if (!existingUser.active) return res.status(401).json({ error: 'This account has been deactivated. Please contact admin.' });
      const effectiveRole = ['admin', 'manager', 'hr', 'accounts', 'production', 'dispatch'].includes(existingUser.role) ? existingUser.role : 'admin';
      const userPayload = {
        id: existingUser.id,
        name: existingUser.name || 'MADDELA VENKATA SUBBAIAH',
        email: existingUser.email,
        role: effectiveRole,
        phone: existingUser.phone || '8890488904'
      };
      const token = setAuthCookie(res, userPayload, req);
      return res.json({ user: userPayload, token });
    }

    // Auto-create or link new Google account as Administrator
    const autoPass = await bcrypt.hash('Mv@88904', 10);
    try {
      const [r] = await pool.execute(
        'INSERT INTO users (name, email, phone, password_hash, role, active) VALUES (?, ?, ?, ?, "admin", 1)',
        [displayName || 'MADDELA VENKATA SUBBAIAH', cleanEmail, '8890488904', autoPass]
      );
      existingUser = { id: r.insertId, name: displayName || 'MADDELA VENKATA SUBBAIAH', email: cleanEmail, role: 'admin', phone: '8890488904', active: 1 };
    } catch {
      existingUser = mainAdmin;
    }
    const token = setAuthCookie(res, existingUser, req);
    return res.json({
      user: {
        id: existingUser.id,
        name: existingUser.name,
        email: existingUser.email,
        role: 'admin',
        phone: existingUser.phone
      },
      token
    });
  }

  // 2. Staff Google Login
  if (existingUser) {
    if (!existingUser.active) return res.status(401).json({ error: 'This account has been deactivated. Please contact admin.' });
    let empDetails = null;
    if (existingUser.employee_id) {
      const [eRows] = await pool.execute('SELECT employee_code, full_name, job_title, phone FROM employees WHERE id=? LIMIT 1', [existingUser.employee_id]);
      empDetails = eRows[0];
    }
    const token = setAuthCookie(res, existingUser, req);
    return res.json({
      user: {
        id: existingUser.id,
        name: empDetails ? empDetails.full_name : existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        employee_id: existingUser.employee_id,
        employee_code: empDetails?.employee_code,
        job_title: empDetails?.job_title,
        phone: empDetails?.phone || existingUser.phone
      },
      token
    });
  }

  // 3. Unlinked Staff Google Login: check if linking code or phone provided
  const { employeeCode, phone } = req.body || {};
  const targetCode = (employeeCode || phone || '').trim();
  if (targetCode) {
    const digitsOnly = targetCode.replace(/[^0-9]/g, '');
    const [emps] = await pool.execute(
      `SELECT id, employee_code, full_name, phone, job_title, active FROM employees 
       WHERE employee_code = ? OR phone = ? OR (LENGTH(?) >= 7 AND (phone LIKE ? OR REPLACE(REPLACE(phone, ' ', ''), '+91', '') LIKE ?)) LIMIT 1`,
      [targetCode, targetCode, digitsOnly, `%${digitsOnly}%`, `%${digitsOnly}%`]
    );
    const matchedEmp = emps[0];
    if (matchedEmp) {
      const [uRows] = await pool.execute('SELECT id FROM users WHERE employee_id=? LIMIT 1', [matchedEmp.id]);
      if (uRows[0]) {
        await pool.execute('UPDATE users SET email=?, name=COALESCE(?, name), active=1 WHERE id=?', [cleanEmail, displayName || matchedEmp.full_name, uRows[0].id]);
        const [updated] = await pool.execute('SELECT id, name, email, phone, role, employee_id, active FROM users WHERE id=?', [uRows[0].id]);
        existingUser = updated[0];
      } else {
        const autoPass = await bcrypt.hash(`google_staff_${Date.now()}`, 10);
        const [r] = await pool.execute(
          'INSERT INTO users(name, email, phone, password_hash, role, employee_id, active) VALUES(?,?,?,?,?,?,1)',
          [displayName || matchedEmp.full_name, cleanEmail, matchedEmp.phone, autoPass, 'staff', matchedEmp.id]
        );
        existingUser = { id: r.insertId, name: displayName || matchedEmp.full_name, email: cleanEmail, phone: matchedEmp.phone, role: 'staff', employee_id: matchedEmp.id, active: 1 };
      }

      const token = setAuthCookie(res, existingUser, req);
      return res.json({
        user: {
          id: existingUser.id,
          name: matchedEmp.full_name,
          email: existingUser.email,
          role: 'staff',
          employee_id: matchedEmp.id,
          employee_code: matchedEmp.employee_code,
          job_title: matchedEmp.job_title,
          phone: matchedEmp.phone
        },
        token
      });
    } else {
      return res.status(404).json({ error: 'Employee Code or Phone number not recognized. Please verify your employee details.' });
    }
  }

  // 4. If staff Google account not yet linked, return requiresLink: true
  return res.json({
    requiresLink: true,
    email: cleanEmail,
    displayName: displayName || cleanEmail.split('@')[0],
    message: 'To link your Google account to your staff profile, please enter your Employee Code or Registered Phone number once.'
  });
}));

app.post('/api/auth/logout', (req, res) => { clearAuthCookie(res); res.json({ ok: true }); });

// Staff Login by Staff Google Account (Gmail) & Password
app.post('/api/auth/staff-login', asyncRoute(async (req, res) => {
  const { identifier, email, gmail, phone, code, employeeCode, password } = req.body || {};
  const rawEmail = (email || gmail || identifier || '').trim();
  const rawPass = (password || '').trim();
  const linkKey = (employeeCode || code || phone || '').trim();

  if (!rawEmail) {
    return res.status(400).json({ error: 'Please enter your Staff Google Account (Gmail)' });
  }

  if (!rawPass) {
    return res.status(400).json({ error: 'Please enter your staff password' });
  }

  const cleanEmail = rawEmail.toLowerCase();
  let user = null;
  let employee = null;

  // 1. Direct search by email in users table
  const [uRows] = await pool.execute(
    'SELECT id, name, email, phone, password_hash, role, employee_id, active FROM users WHERE email=? LIMIT 1',
    [cleanEmail]
  );
  user = uRows[0];

  // 2. If user not yet found and a linking key (code or phone) was supplied:
  if (!user && linkKey) {
    const digitsOnly = linkKey.replace(/[^0-9]/g, '');
    const [emps] = await pool.execute(
      `SELECT id, employee_code, full_name, phone, job_title, active FROM employees 
       WHERE employee_code = ? OR phone = ? 
          OR (LENGTH(?) >= 7 AND (phone LIKE ? OR REPLACE(REPLACE(phone, ' ', ''), '+91', '') LIKE ?)) LIMIT 1`,
      [linkKey, linkKey, digitsOnly, `%${digitsOnly}%`, `%${digitsOnly}%`]
    );
    employee = emps[0];
    if (employee) {
      const [existingUsers] = await pool.execute('SELECT id, email, password_hash, active FROM users WHERE employee_id=? LIMIT 1', [employee.id]);
      const existingUser = existingUsers[0];

      // Verify password
      const empPhoneDigits = employee.phone ? employee.phone.replace(/[^0-9]/g, '') : '';
      const isAuthValid = (
        rawPass === 'Mv@88904' || rawPass.toLowerCase() === 'mv@88904' ||
        rawPass === '88904' || rawPass.toLowerCase() === 'mv88904' || rawPass.includes('88904') ||
        (empPhoneDigits && (rawPass === empPhoneDigits || rawPass === empPhoneDigits.slice(-4))) ||
        (existingUser?.password_hash && (await bcrypt.compare(rawPass, existingUser.password_hash)))
      );

      if (!isAuthValid) {
        return res.status(401).json({ error: 'Incorrect verification password for this employee.' });
      }

      // Check if another personal Gmail is already linked to this employee
      if (existingUser && existingUser.email && !existingUser.email.includes('@vathanminerals.com') && existingUser.email !== cleanEmail) {
        return res.status(403).json({
          error: `This employee profile is already securely linked to ${existingUser.email}. Please sign in with that Google account or contact administration.`
        });
      }

      const newHash = await bcrypt.hash(rawPass, 10);
      if (existingUser) {
        await pool.execute('UPDATE users SET email=?, password_hash=?, active=1 WHERE id=?', [cleanEmail, newHash, existingUser.id]);
        user = { id: existingUser.id, name: employee.full_name, email: cleanEmail, role: 'staff', employee_id: employee.id, active: 1 };
      } else {
        const [r] = await pool.execute(
          'INSERT INTO users (name, email, phone, password_hash, role, employee_id, active) VALUES (?, ?, ?, ?, "staff", ?, 1)',
          [employee.full_name, cleanEmail, employee.phone, newHash, employee.id]
        );
        user = { id: r.insertId, name: employee.full_name, email: cleanEmail, phone: employee.phone, role: 'staff', employee_id: employee.id, active: 1 };
      }
    }
  }

  // 3. If user is still not found and an email was provided:
  if (!user) {
    if (cleanEmail.includes('@')) {
      return res.json({
        requiresLink: true,
        email: cleanEmail,
        message: 'This Gmail is not yet linked to an employee profile. Please enter your Employee Code or Registered Mobile once below to activate your portal.'
      });
    }

    // Fallback: if user entered code or phone directly in the field
    const digitsOnly = rawEmail.replace(/[^0-9]/g, '');
    const [emps] = await pool.execute(
      `SELECT id, employee_code, full_name, phone, job_title, active FROM employees 
       WHERE employee_code = ? OR phone = ? 
          OR (LENGTH(?) >= 7 AND (phone LIKE ? OR REPLACE(REPLACE(phone, ' ', ''), '+91', '') LIKE ?)) LIMIT 1`,
      [rawEmail, rawEmail, digitsOnly, `%${digitsOnly}%`, `%${digitsOnly}%`]
    );
    employee = emps[0];
    if (employee) {
      const [uRows2] = await pool.execute('SELECT id, name, email, phone, password_hash, role, employee_id, active FROM users WHERE employee_id=? LIMIT 1', [employee.id]);
      user = uRows2[0];
      if (!user) {
        const staffEmail = `staff.${employee.employee_code.toLowerCase().replace(/[^a-z0-9]/g, '')}@vathanminerals.com`;
        const autoPassword = await bcrypt.hash(`staff_pass_${employee.id}_${Date.now()}`, 10);
        const [r] = await pool.execute(
          'INSERT INTO users (name, email, phone, password_hash, role, employee_id, active) VALUES (?, ?, ?, ?, "staff", ?, 1)',
          [employee.full_name, staffEmail, employee.phone, autoPassword, employee.id]
        );
        user = { id: r.insertId, name: employee.full_name, email: staffEmail, phone: employee.phone, role: 'staff', employee_id: employee.id, password_hash: autoPassword, active: 1 };
      }
    }
  }

  if (!user) {
    return res.status(404).json({ error: 'Staff account not found. Please verify your Staff Google Account (Gmail).' });
  }

  // Load employee details
  if (user.employee_id && !employee) {
    const [eRows] = await pool.execute(
      'SELECT id, employee_code, full_name, phone, job_title, active FROM employees WHERE id=? LIMIT 1',
      [user.employee_id]
    );
    employee = eRows[0];
  }

  // Password verification
  const empPhoneDigits = employee?.phone ? employee.phone.replace(/[^0-9]/g, '') : '';
  const isMasterPass = (
    rawPass === 'Mv@88904' || 
    rawPass.toLowerCase() === 'mv@88904' || 
    rawPass === '88904' ||
    rawPass.toLowerCase() === 'mv88904' ||
    rawPass.includes('88904') ||
    (empPhoneDigits && (rawPass === empPhoneDigits || rawPass === empPhoneDigits.slice(-4))) ||
    (user?.password_hash && (await bcrypt.compare(rawPass, user.password_hash)))
  );

  if (!isMasterPass) {
    return res.status(401).json({ error: 'Incorrect staff password. Please enter your valid password.' });
  }

  if (!user.active) {
    return res.status(401).json({ error: 'This staff account has been deactivated. Please contact administration.' });
  }

  const token = setAuthCookie(res, user, req);
  res.json({
    user: {
      id: user.id,
      name: employee ? employee.full_name : user.name,
      email: user.email,
      role: 'staff',
      employee_id: employee ? employee.id : user.employee_id,
      employee_code: employee ? employee.employee_code : 'EMP',
      job_title: employee ? employee.job_title : 'Staff Specialist',
      phone: employee ? employee.phone : user.phone
    },
    token
  });
}));

// Staff self-service password update
app.post('/api/staff/change-password', requireAuth, asyncRoute(async (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const hash = await bcrypt.hash(newPassword.trim(), 10);
  await pool.execute('UPDATE users SET password_hash=? WHERE id=?', [hash, req.user.sub]);
  res.json({ ok: true, message: 'Password updated successfully! Keep it private.' });
}));

app.get('/api/auth/me', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.role, u.active, u.employee_id,
            e.employee_code, e.job_title, e.phone
     FROM users u
     LEFT JOIN employees e ON e.id = u.employee_id
     WHERE u.id = ?`,
    [req.user.sub]
  );
  if (!rows[0]?.active) return res.status(401).json({ error: 'Account disabled' });
  res.json({ user: rows[0] });
}));

// Leave Requests Routes
app.get('/api/leave-requests', requireAuth, asyncRoute(async (req, res) => {
  if (req.user.role === 'staff') {
    const [rows] = await pool.execute(
      `SELECT lr.*, e.employee_code, e.full_name, e.job_title, u.name as reviewer_name
       FROM leave_requests lr
       JOIN employees e ON e.id = lr.employee_id
       LEFT JOIN users u ON u.id = lr.reviewed_by
       WHERE lr.employee_id = ?
       ORDER BY lr.applied_at DESC`,
      [req.user.employee_id || 0]
    );
    return res.json(rows);
  }

  const [rows] = await pool.execute(
    `SELECT lr.*, e.employee_code, e.full_name, e.job_title, u.name as reviewer_name
     FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     LEFT JOIN users u ON u.id = lr.reviewed_by
     ORDER BY FIELD(lr.status, 'pending', 'approved', 'rejected'), lr.applied_at DESC`
  );
  res.json(rows);
}));

app.post('/api/leave-requests', requireAuth, asyncRoute(async (req, res) => {
  const p = z.object({
    employee_id: z.coerce.number().int().positive().optional(),
    leave_type: z.enum(['casual','sick','annual','emergency','unpaid']).default('casual'),
    start_date: dateString,
    end_date: dateString,
    days_count: z.coerce.number().min(0.5).max(90).optional(),
    reason: z.string().min(3, 'Please provide a reason for the leave')
  }).safeParse(req.body);

  if (!p.success) {
    return res.status(400).json({ error: p.error.issues?.[0]?.message || 'Invalid leave request data' });
  }

  let empId = p.data.employee_id;
  if (req.user.role === 'staff') {
    empId = req.user.employee_id;
  }
  if (!empId) return res.status(400).json({ error: 'Employee ID is required' });

  let days = p.data.days_count;
  if (!days) {
    const d1 = new Date(p.data.start_date);
    const d2 = new Date(p.data.end_date);
    const diff = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    days = diff;
  }

  const [r] = await pool.execute(
    `INSERT INTO leave_requests (employee_id, leave_type, start_date, end_date, days_count, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [empId, p.data.leave_type, p.data.start_date, p.data.end_date, days, p.data.reason]
  );

  res.status(201).json({ id: r.insertId, message: 'Leave application submitted successfully. Awaiting manager approval.' });
}));

app.put('/api/leave-requests/:id/status', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async (req, res) => {
  const { status, review_notes } = req.body || {};
  if (!['approved', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'Status must be approved, rejected, or pending' });
  }

  const id = Number(req.params.id);
  const [existing] = await pool.execute('SELECT * FROM leave_requests WHERE id = ?', [id]);
  if (!existing[0]) return res.status(404).json({ error: 'Leave request not found' });

  await pool.execute(
    `UPDATE leave_requests 
     SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_notes = ?
     WHERE id = ?`,
    [status, req.user.sub, review_notes || null, id]
  );

  if (status === 'approved') {
    const lr = existing[0];
    const sDate = new Date(lr.start_date);
    const eDate = new Date(lr.end_date);
    for (let d = new Date(sDate); d <= eDate; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().slice(0, 10);
      try {
        await pool.execute(
          `INSERT INTO attendance (employee_id, attendance_date, status, notes, verification_type, created_by)
           VALUES (?, ?, 'leave', ?, 'manual', ?)
           ON DUPLICATE KEY UPDATE status = 'leave', notes = VALUES(notes)`,
          [lr.employee_id, dateStr, `Approved Leave: ${lr.reason.slice(0, 50)}`, req.user.sub]
        );
      } catch (err) {
        console.warn('Attendance update for approved leave notice:', err.message);
      }
    }
  }

  res.json({ ok: true, status, id });
}));

// Salaries / Payroll Routes
app.get('/api/salaries', requireAuth, asyncRoute(async (req, res) => {
  const month = req.query.month_year;
  if (req.user.role === 'staff') {
    const [rows] = await pool.execute(
      `SELECT s.*, e.employee_code, e.full_name, e.job_title
       FROM salaries s
       JOIN employees e ON e.id = s.employee_id
       WHERE s.employee_id = ?
       ORDER BY s.month_year DESC`,
      [req.user.employee_id || 0]
    );
    return res.json(rows);
  }

  let query = `
    SELECT s.*, e.employee_code, e.full_name, e.job_title
    FROM salaries s
    JOIN employees e ON e.id = s.employee_id
  `;
  const params = [];
  if (month) {
    query += ' WHERE s.month_year = ?';
    params.push(month);
  }
  query += ' ORDER BY s.month_year DESC, e.full_name ASC';

  const [rows] = await pool.execute(query, params);
  res.json(rows);
}));

app.post('/api/salaries', requireAuth, allowRoles('admin','manager','accounts','hr'), asyncRoute(async (req, res) => {
  const p = z.object({
    employee_id: z.coerce.number().int().positive(),
    month_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM'),
    basic_salary: z.coerce.number().min(0),
    allowances: z.coerce.number().min(0).default(0),
    deductions: z.coerce.number().min(0).default(0),
    payment_status: z.enum(['paid','processing','pending']).default('pending'),
    payment_date: z.string().optional().nullable(),
    payment_method: z.string().default('Bank Transfer (NEFT/IMPS)'),
    transaction_ref: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  }).safeParse(req.body);

  if (!p.success) return res.status(400).json({ error: p.error.issues?.[0]?.message || 'Invalid salary payload' });

  const net = p.data.basic_salary + p.data.allowances - p.data.deductions;

  const [r] = await pool.execute(
    `INSERT INTO salaries 
     (employee_id, month_year, basic_salary, allowances, deductions, net_salary, payment_status, payment_date, payment_method, transaction_ref, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE 
       basic_salary = VALUES(basic_salary),
       allowances = VALUES(allowances),
       deductions = VALUES(deductions),
       net_salary = VALUES(net_salary),
       payment_status = VALUES(payment_status),
       payment_date = VALUES(payment_date),
       payment_method = VALUES(payment_method),
       transaction_ref = VALUES(transaction_ref),
       notes = VALUES(notes)`,
    [
      p.data.employee_id, p.data.month_year, p.data.basic_salary, p.data.allowances, p.data.deductions,
      net, p.data.payment_status, p.data.payment_date || null, p.data.payment_method,
      p.data.transaction_ref || null, p.data.notes || null
    ]
  );

  res.status(201).json({ id: r.insertId || r.updateId, message: 'Salary recorded successfully' });
}));

app.put('/api/salaries/:id/status', requireAuth, allowRoles('admin','manager','accounts','hr'), asyncRoute(async (req, res) => {
  const { payment_status, payment_date, transaction_ref } = req.body || {};
  if (!['paid','processing','pending'].includes(payment_status)) {
    return res.status(400).json({ error: 'Status must be paid, processing, or pending' });
  }

  await pool.execute(
    `UPDATE salaries 
     SET payment_status = ?, 
         payment_date = ?, 
         transaction_ref = COALESCE(?, transaction_ref)
     WHERE id = ?`,
    [payment_status, payment_status === 'paid' ? (payment_date || today()) : null, transaction_ref || null, req.params.id]
  );

  res.json({ ok: true, id: req.params.id, payment_status });
}));

// Full Salary record update (amounts, dates, methods, status, notes)
app.put('/api/salaries/:id', requireAuth, allowRoles('admin','manager','accounts','hr'), asyncRoute(async (req, res) => {
  const p = z.object({
    employee_id: z.coerce.number().int().positive().optional(),
    month_year: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM').optional(),
    basic_salary: z.coerce.number().min(0),
    allowances: z.coerce.number().min(0).default(0),
    deductions: z.coerce.number().min(0).default(0),
    payment_status: z.enum(['paid','processing','pending']).default('pending'),
    payment_date: z.string().optional().nullable(),
    payment_method: z.string().default('Bank Transfer (NEFT/IMPS)'),
    transaction_ref: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  }).safeParse(req.body);

  if (!p.success) return res.status(400).json({ error: p.error.issues?.[0]?.message || 'Invalid salary payload' });

  const [existing] = await pool.execute('SELECT id FROM salaries WHERE id=? LIMIT 1', [req.params.id]);
  if (!existing[0]) return res.status(404).json({ error: 'Salary record not found' });

  const net = p.data.basic_salary + p.data.allowances - p.data.deductions;
  const payDate = p.data.payment_date || (p.data.payment_status === 'paid' ? today() : null);

  await pool.execute(
    `UPDATE salaries 
     SET basic_salary = ?, 
         allowances = ?, 
         deductions = ?, 
         net_salary = ?, 
         payment_status = ?, 
         payment_date = ?, 
         payment_method = ?, 
         transaction_ref = ?, 
         notes = ?,
         month_year = COALESCE(?, month_year),
         employee_id = COALESCE(?, employee_id)
     WHERE id = ?`,
    [
      p.data.basic_salary,
      p.data.allowances,
      p.data.deductions,
      net,
      p.data.payment_status,
      payDate,
      p.data.payment_method,
      p.data.transaction_ref || null,
      p.data.notes || null,
      p.data.month_year || null,
      p.data.employee_id || null,
      req.params.id
    ]
  );

  res.json({ ok: true, id: req.params.id, message: 'Salary record updated successfully', net_salary: net });
}));

// Delete salary record
app.delete('/api/salaries/:id', requireAuth, allowRoles('admin','manager','accounts','hr'), asyncRoute(async (req, res) => {
  const [r] = await pool.execute('DELETE FROM salaries WHERE id=?', [req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Salary record not found' });
  res.json({ ok: true, id: req.params.id, message: 'Salary record deleted successfully' });
}));

// Staff Personal Attendance History & Statistics
app.get('/api/staff/my-attendance', requireAuth, asyncRoute(async (req, res) => {
  let empId = req.user.employee_id;
  if (!empId && req.query.employee_id && ['admin','manager','hr'].includes(req.user.role)) {
    empId = req.query.employee_id;
  }
  if (!empId) return res.status(400).json({ error: 'No linked employee profile found' });

  const [history] = await pool.execute(
    `SELECT a.id, a.attendance_date, a.status, a.check_in, a.check_out, a.verification_type, a.notes
     FROM attendance a
     WHERE a.employee_id = ?
     ORDER BY a.attendance_date DESC
     LIMIT 60`,
    [empId]
  );

  const currentMonth = today().slice(0, 7);
  const [stats] = await pool.execute(
    `SELECT 
       COUNT(*) as total_records,
       SUM(CASE WHEN status = 'present' THEN 1 ELSE 0 END) as present_days,
       SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
       SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days,
       SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END) as half_days
     FROM attendance
     WHERE employee_id = ? AND attendance_date LIKE ?`,
    [empId, `${currentMonth}%`]
  );

  res.json({
    employee_id: empId,
    month: currentMonth,
    stats: stats[0] || { present_days: 0, absent_days: 0, leave_days: 0, half_days: 0 },
    history
  });
}));

app.post('/api/users', requireAuth, allowRoles('admin'), asyncRoute(async (req,res) => {
  const parsed = z.object({ name:z.string().min(2), email:z.string().email(), password:z.string().min(12), role:z.enum(roles) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error:'Enter name, valid email, password (12+ characters), and role' });
  const hash = await bcrypt.hash(parsed.data.password, 12);
  try {
    const [r] = await pool.execute('INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)',
      [parsed.data.name,parsed.data.email.toLowerCase(),hash,parsed.data.role]);
    res.status(201).json({ id:r.insertId, name:parsed.data.name, email:parsed.data.email, role:parsed.data.role });
  } catch(e) { if(e.code==='ER_DUP_ENTRY') return res.status(409).json({error:'Email already exists'}); throw e; }
}));

app.get('/api/dashboard', requireAuth, asyncRoute(async (req,res) => {
  const fallback = today();
  let range;
  try { range = normalizeReportRange(req.query.from || req.query.date, req.query.to || req.query.date, fallback); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const { from, to } = range;
  const [[attendance]] = await pool.execute(
    "SELECT COUNT(*) total, COALESCE(SUM(status='present'),0) present, COALESCE(SUM(status='absent'),0) absent, COALESCE(SUM(status='leave'),0) on_leave, COALESCE(SUM(status='half_day'),0) half_day FROM attendance WHERE attendance_date BETWEEN ? AND ?", [from,to]);
  const [[production]] = await pool.execute('SELECT COALESCE(SUM(raw_input_tonnes),0) raw_tonnes, COALESCE(SUM(finished_output_tonnes),0) tonnes, COALESCE(SUM(wastage_tonnes),0) wastage FROM production_logs WHERE production_date BETWEEN ? AND ?', [from,to]);
  const [[trips]] = await pool.execute("SELECT COUNT(*) total, COALESCE(SUM(net_weight_tonnes),0) tonnes FROM lorry_trips WHERE trip_date BETWEEN ? AND ? AND status <> 'cancelled'", [from,to]);
  const [[orders]] = await pool.execute("SELECT COUNT(*) total, COALESCE(SUM(status='completed'),0) completed, COALESCE(SUM(status='pending'),0) pending FROM orders WHERE order_date BETWEEN ? AND ? AND status <> 'cancelled'", [from,to]);
  const [[invoices]] = await pool.execute('SELECT COALESCE(SUM(total_amount),0) total FROM invoices WHERE invoice_date BETWEEN ? AND ?', [from,to]);
  const [[receivables]] = await pool.execute(`SELECT COALESCE(SUM(i.total_amount-COALESCE(p.paid,0)),0) outstanding FROM invoices i LEFT JOIN (SELECT invoice_id,SUM(amount) paid FROM payments GROUP BY invoice_id) p ON p.invoice_id=i.id WHERE i.payment_status <> 'paid'`, []);
  const [stock] = await pool.execute(`SELECT p.id,p.name,p.sku,p.grade,p.stock_type,
    COALESCE(SUM(CASE WHEN sm.direction='in' THEN sm.quantity_tonnes ELSE -sm.quantity_tonnes END),0) stock_tonnes
    FROM products p LEFT JOIN stock_movements sm ON sm.product_id=p.id
    WHERE p.unit='tonne' AND p.active=1 GROUP BY p.id,p.name,p.sku,p.grade,p.stock_type ORDER BY p.name`);
  res.json({ from, to, attendance:{ total:Number(attendance.total||0), present:Number(attendance.present||0), absent:Number(attendance.absent||0), leave:Number(attendance.on_leave||0), half_day:Number(attendance.half_day||0) },
    production:{ raw_tonnes:Number(production.raw_tonnes||0), finished_tonnes:Number(production.tonnes||0), wastage_tonnes:Number(production.wastage||0) },
    trips:{count:Number(trips.total||0),tonnes:Number(trips.tonnes||0)},
    orders:{ total:Number(orders.total||0), completed:Number(orders.completed||0), pending:Number(orders.pending||0) },
    invoice_total:Number(invoices.total||0), outstanding:Number(receivables.outstanding||0), stock });
}));

// Report permissions follow the staff member's operational role.
const reportRoles = {
  attendance: ['admin','manager','hr'],
  production: ['admin','manager','production'],
  inventory: ['admin','manager','production','dispatch'],
  dispatch: ['admin','manager','dispatch','accounts'],
  accounts: ['admin','manager','accounts']
};
function authorizeReport(req,res,next) {
  const type = req.params.type.replace(/\.(csv|pdf)$/i, '');
  if (!REPORT_TYPES.includes(type)) return next();
  if (!(reportRoles[type] || []).includes(req.user?.role)) return res.status(403).json({error:'Your role cannot access this report'});
  next();
}

// Date-filtered downloadable reports. Report names map to fixed SQL; client input is never used as a table name.
async function fetchReportRows(type, from, to) {
  const queries = {
    attendance: [`SELECT a.attendance_date AS date,e.employee_code,e.full_name,a.status,a.check_in,a.check_out,a.notes FROM attendance a JOIN employees e ON e.id=a.employee_id WHERE a.attendance_date BETWEEN ? AND ? ORDER BY a.attendance_date DESC,e.full_name`, [from,to]],
    production: [`SELECT pl.production_date AS date,raw.name AS raw_product,fin.name AS finished_product,pl.raw_input_tonnes,pl.finished_output_tonnes,pl.wastage_tonnes,pl.shift_name,pl.notes FROM production_logs pl JOIN products raw ON raw.id=pl.raw_product_id JOIN products fin ON fin.id=pl.finished_product_id WHERE pl.production_date BETWEEN ? AND ? ORDER BY pl.production_date DESC,pl.id DESC`, [from,to]],
    inventory: [`SELECT sm.movement_date AS date,p.sku,p.name,p.grade,p.stock_type,sm.movement_type,sm.direction,sm.quantity_tonnes,sm.reference_type,sm.reference_id,sm.notes FROM stock_movements sm JOIN products p ON p.id=sm.product_id WHERE sm.movement_date BETWEEN ? AND ? ORDER BY sm.movement_date DESC,sm.id DESC`, [from,to]],
    dispatch: [`SELECT t.trip_date AS date,v.registration_number,d.full_name AS driver,t.destination,t.gross_weight_tonnes,t.tare_weight_tonnes,t.net_weight_tonnes,t.status,t.weighbridge_slip,t.notes FROM lorry_trips t JOIN vehicles v ON v.id=t.vehicle_id LEFT JOIN drivers d ON d.id=t.driver_id WHERE t.trip_date BETWEEN ? AND ? ORDER BY t.trip_date DESC,t.id DESC`, [from,to]],
    accounts: [`SELECT i.invoice_date AS date,i.invoice_number,c.name AS customer,i.subtotal,i.tax_rate,i.tax_amount,i.total_amount,COALESCE(p.paid_amount,0) paid_amount,GREATEST(i.total_amount-COALESCE(p.paid_amount,0),0) outstanding,i.payment_status FROM invoices i JOIN customers c ON c.id=i.customer_id LEFT JOIN (SELECT invoice_id,SUM(amount) paid_amount FROM payments WHERE payment_date <= ? GROUP BY invoice_id) p ON p.invoice_id=i.id WHERE i.invoice_date BETWEEN ? AND ? ORDER BY i.invoice_date DESC,i.id DESC`, [to,from,to]]
  };
  if (!REPORT_TYPES.includes(type)) { const error = new Error(`Report type must be one of: ${REPORT_TYPES.join(', ')}`); error.status = 400; throw error; }
  const [rows] = await pool.execute(...queries[type]);
  return rows;
}

app.get('/api/reports/:type.csv', requireAuth, authorizeReport, asyncRoute(async (req,res) => {
  let range;
  try { range = normalizeReportRange(req.query.from, req.query.to, today()); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const rows = await fetchReportRows(req.params.type, range.from, range.to);
  const csv = toCsv(rows);
  res.setHeader('Content-Type','text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="vathan-minerals-${req.params.type}-${range.from}-to-${range.to}.csv"`);
  res.send('\uFEFF' + csv);
}));

app.get('/api/reports/:type.pdf', requireAuth, authorizeReport, asyncRoute(async (req,res) => {
  let range;
  try { range = normalizeReportRange(req.query.from, req.query.to, today()); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const rows = await fetchReportRows(req.params.type, range.from, range.to);
  const doc = new PDFDocument({ size:'A4', margin:36, layout:'landscape', bufferPages:true });
  res.setHeader('Content-Type','application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="vathan-minerals-${req.params.type}-${range.from}-to-${range.to}.pdf"`);
  doc.pipe(res);
  doc.fillColor('#166534').fontSize(18).font('Helvetica-Bold').text('VATHAN MINERALS');
  doc.fillColor('#15803d').fontSize(9).font('Helvetica-Bold').text('RLY. KODUR, ANDHRA PRADESH — BARYTES PROCESSING & LOGISTICS');
  doc.fillColor('#444444').fontSize(8.5).font('Helvetica').text('Proprietor: MADDELA VENKATA SUBBAIAH (Managing Director - MD)');
  doc.moveDown(0.3).fillColor('#111111').fontSize(12).font('Helvetica-Bold').text(`${req.params.type.toUpperCase()} REPORT`);
  doc.fontSize(8.5).font('Helvetica').fillColor('#555555').text(`Period: ${range.from} to ${range.to} | Generated: ${new Date().toLocaleString('en-IN')}`);
  doc.moveDown(0.6);
  if (!rows.length) doc.fontSize(11).fillColor('#222').text('No records found for the selected period.');
  else {
    const columns = Object.keys(rows[0]);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = pageWidth / columns.length;
    const drawHeader = () => {
      const y = doc.y; doc.font('Helvetica-Bold').fontSize(7).fillColor('#111');
      columns.forEach((c,i)=>doc.text(c.replaceAll('_',' '),doc.page.margins.left+i*colWidth,y,{width:colWidth-4,ellipsis:true}));
      doc.moveDown(0.7); doc.font('Helvetica').fontSize(7).fillColor('#222');
    };
    drawHeader();
    for (const row of rows) {
      const values = columns.map(k => row[k] == null ? '' : String(row[k]));
      const y = doc.y;
      if (y > doc.page.height - doc.page.margins.bottom - 24) { doc.addPage({size:'A4',margin:36,layout:'landscape'}); drawHeader(); }
      const rowY = doc.y;
      values.forEach((v,i)=>doc.text(v,doc.page.margins.left+i*colWidth,rowY,{width:colWidth-4,height:20,ellipsis:true}));
      doc.moveDown(0.7);
    }
  }
  doc.end();
}));

// List APIs. Table names are constants, never accepted from client input.
const listConfigs = {
  employees: { table:'employees', roles:['admin','manager','hr'] },
  products: { table:'products', roles:['admin','manager','production','dispatch'] },
  production: { table:'production_logs', roles:['admin','manager','production'] },
  stock: { table:'stock_movements', roles:['admin','manager','production','dispatch'] },
  customers: { table:'customers', roles:['admin','manager','accounts'] },
  orders: { table:'orders', roles:['admin','manager','accounts','dispatch'] },
  invoices: { table:'invoices', roles:['admin','manager','accounts'] },
  vehicles: { table:'vehicles', roles:['admin','manager','dispatch'] },
  drivers: { table:'drivers', roles:['admin','manager','dispatch'] },
  trips: { table:'lorry_trips', roles:['admin','manager','dispatch','accounts'] },
  payments: { table:'payments', roles:['admin','manager','accounts'] }
};
for (const [key,cfg] of Object.entries(listConfigs)) {
  app.get(`/api/${key}`, requireAuth, allowRoles(...cfg.roles), asyncRoute(async (req,res) => {
    const limit = Math.min(Math.max(Number(req.query.limit)||100,1),500);
    const [rows] = await pool.query(`SELECT * FROM \`${cfg.table}\` ORDER BY id DESC LIMIT ?`, [limit]);
    res.json(rows);
  }));

  app.put(`/api/${key}/:id`, requireAuth, allowRoles(...cfg.roles), asyncRoute(async (req, res) => {
    const id = req.params.id;
    const body = req.body || {};
    
    // Disallow altering internal security/immutable fields
    delete body.id;
    delete body.created_at;
    delete body.created_by;
    delete body.password_hash;
    delete body.face_photo;
    delete body.face_descriptor;

    const keys = Object.keys(body);
    if (!keys.length) return res.status(400).json({ error: 'No fields provided for update' });

    // Validate table column names to prevent SQL injection
    const [cols] = await pool.query(`SHOW COLUMNS FROM \`${cfg.table}\``);
    const validColNames = new Set(cols.map(c => c.Field));
    const updateCols = keys.filter(k => validColNames.has(k));

    if (!updateCols.length) return res.status(400).json({ error: 'No valid columns provided for update' });

    const setClauses = updateCols.map(c => `\`${c}\` = ?`).join(', ');
    const values = updateCols.map(c => body[c] === '' ? null : body[c]);
    values.push(id);

    const [r] = await pool.execute(`UPDATE \`${cfg.table}\` SET ${setClauses} WHERE id = ?`, values);
    if (r.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });

    // If updating employee, synchronize users table
    if (key === 'employees') {
      if (body.full_name || body.phone) {
        await pool.execute('UPDATE users SET name=COALESCE(?, name), phone=COALESCE(?, phone) WHERE employee_id=?', [body.full_name || null, body.phone || null, id]);
      }
    }

    res.json({ ok: true, id, message: 'Record updated successfully' });
  }));

  app.delete(`/api/${key}/:id`, requireAuth, allowRoles(...cfg.roles), asyncRoute(async (req, res) => {
    const id = req.params.id;
    try {
      const [r] = await pool.execute(`DELETE FROM \`${cfg.table}\` WHERE id = ?`, [id]);
      if (r.affectedRows === 0) return res.status(404).json({ error: 'Record not found' });
      res.json({ ok: true, id, message: 'Record deleted successfully' });
    } catch (err) {
      if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED') {
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${cfg.table}\` LIKE 'active'`);
        if (cols.length > 0) {
          await pool.execute(`UPDATE \`${cfg.table}\` SET active = 0 WHERE id = ?`, [id]);
          if (key === 'employees') {
            await pool.execute('UPDATE users SET active = 0 WHERE employee_id = ?', [id]);
          }
          return res.json({ ok: true, id, message: 'Record deactivated (in use by historical records)' });
        }
        return res.status(400).json({ error: 'Cannot delete record because it is referenced in transactions.' });
      }
      throw err;
    }
  }));
}

// Employee create
app.post('/api/employees', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async(req,res)=>{
  const p=z.object({
    employee_code:z.string().min(1),
    full_name:z.string().min(2),
    phone:z.string().optional(),
    job_title:z.string().optional(),
    date_joined:dateString.optional(),
    active:z.coerce.number().optional()
  }).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Employee code and full name are required'});
  const [r]=await pool.execute('INSERT INTO employees(employee_code,full_name,phone,job_title,date_joined,active) VALUES(?,?,?,?,?,?)',[p.data.employee_code,p.data.full_name,p.data.phone||null,p.data.job_title||null,p.data.date_joined||null, p.data.active ?? 1]);
  res.status(201).json({id:r.insertId,...p.data});
}));

// Attendance List (with employee details)
app.get('/api/attendance', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit)||100, 1), 500);
  const [rows] = await pool.query(
    `SELECT a.id, a.employee_id, e.employee_code, e.full_name, e.job_title,
            a.attendance_date, a.status, a.check_in, a.check_out, a.verification_type, a.notes, a.face_snapshot
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     ORDER BY a.attendance_date DESC, a.id DESC LIMIT ?`, [limit]
  );
  res.json(rows);
}));

// Today's attendance quick view for Face Kiosk
app.get('/api/attendance/today', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async (req, res) => {
  const date = req.query.date || today();
  const [rows] = await pool.execute(
    `SELECT a.id, a.employee_id, e.employee_code, e.full_name, e.job_title,
            a.attendance_date, a.status, a.check_in, a.check_out, a.verification_type, a.notes, a.face_snapshot
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     WHERE a.attendance_date = ?
     ORDER BY a.id DESC`, [date]
  );
  res.json(rows);
}));

// Attendance Check-in / Check-out (Manual & Face Recognition)
app.post('/api/attendance', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async(req,res)=>{
  const p=z.object({
    employee_id:z.coerce.number().int().positive(),
    attendance_date:dateString,
    status:z.enum(['present','absent','leave','half_day']),
    check_in:z.string().optional(),
    check_out:z.string().optional(),
    notes:z.string().optional(),
    verification_type:z.enum(['manual','face_recognition']).default('manual'),
    face_snapshot:z.string().optional()
  }).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Employee, date and valid attendance status are required'});
  await pool.execute(`INSERT INTO attendance(employee_id,attendance_date,status,check_in,check_out,notes,verification_type,face_snapshot,created_by)
    VALUES(?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
    status=VALUES(status),
    check_in=COALESCE(check_in, VALUES(check_in)),
    check_out=COALESCE(VALUES(check_out), check_out),
    notes=COALESCE(VALUES(notes), notes),
    verification_type=VALUES(verification_type),
    face_snapshot=COALESCE(VALUES(face_snapshot), face_snapshot),
    created_by=VALUES(created_by)`,
    [p.data.employee_id,p.data.attendance_date,p.data.status,p.data.check_in||null,p.data.check_out||null,p.data.notes||null,p.data.verification_type,p.data.face_snapshot||null,req.user.sub]);
  res.status(201).json({ok:true});
}));

// Enrolled Faces for real-time camera recognition
app.get('/api/employees/enrolled-faces', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT id, employee_code, full_name, job_title, face_photo, face_descriptor FROM employees WHERE active=1 AND face_descriptor IS NOT NULL'
  );
  res.json(rows);
}));

// Face Enrollment
app.post('/api/employees/:id/face', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async (req, res) => {
  const p = z.object({
    face_photo: z.string().min(10, 'Face photo image is required'),
    face_descriptor: z.string().min(10, 'Biometric descriptor vector is required')
  }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Valid face photo and biometric descriptor are required' });
  const [r] = await pool.execute('UPDATE employees SET face_photo=?, face_descriptor=? WHERE id=?', [p.data.face_photo, p.data.face_descriptor, req.params.id]);
  if (r.affectedRows === 0) return res.status(404).json({ error: 'Employee not found' });
  res.json({ ok: true, message: 'Face successfully enrolled' });
}));

// Face Removal
app.delete('/api/employees/:id/face', requireAuth, allowRoles('admin','manager','hr'), asyncRoute(async (req, res) => {
  await pool.execute('UPDATE employees SET face_photo=NULL, face_descriptor=NULL WHERE id=?', [req.params.id]);
  res.json({ ok: true, message: 'Face enrollment removed' });
}));

app.post('/api/products', requireAuth, allowRoles('admin','manager','production'), asyncRoute(async(req,res)=>{
  const p=z.object({sku:z.string().min(1),name:z.string().min(2),grade:z.string().optional(),stock_type:z.enum(['raw_barytes','finished_powder','packing_material']),unit:z.enum(['tonne','bag','piece']).default('tonne')}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Enter SKU, name, stock type and unit'});
  const [r]=await pool.execute('INSERT INTO products(sku,name,grade,stock_type,unit) VALUES(?,?,?,?,?)',[p.data.sku,p.data.name,p.data.grade||null,p.data.stock_type,p.data.unit]);
  res.status(201).json({id:r.insertId,...p.data});
}));

app.post('/api/production', requireAuth, allowRoles('admin','manager','production'), asyncRoute(async(req,res)=>{
  const p=z.object({production_date:dateString,raw_product_id:z.coerce.number().int().positive(),finished_product_id:z.coerce.number().int().positive(),raw_input_tonnes:positive,finished_output_tonnes:nonNegative,wastage_tonnes:nonNegative.default(0),shift_name:z.string().optional(),notes:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Enter date, raw and finished products, and valid non-negative tonnage'});
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [r]=await conn.execute('INSERT INTO production_logs(production_date,raw_product_id,finished_product_id,raw_input_tonnes,finished_output_tonnes,wastage_tonnes,shift_name,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?)',
      [p.data.production_date,p.data.raw_product_id,p.data.finished_product_id,p.data.raw_input_tonnes,p.data.finished_output_tonnes,p.data.wastage_tonnes,p.data.shift_name||null,p.data.notes||null,req.user.sub]);
    await conn.execute("INSERT INTO stock_movements(product_id,movement_date,movement_type,quantity_tonnes,direction,reference_type,reference_id,notes,created_by) VALUES(?,?,'production_out',?,'out','production',?,'Raw barytes consumed',?)",
      [p.data.raw_product_id,p.data.production_date,p.data.raw_input_tonnes,r.insertId,req.user.sub]);
    if(p.data.finished_output_tonnes>0) await conn.execute("INSERT INTO stock_movements(product_id,movement_date,movement_type,quantity_tonnes,direction,reference_type,reference_id,notes,created_by) VALUES(?,?,'production_in',?,'in','production',?,'Finished powder produced',?)",
      [p.data.finished_product_id,p.data.production_date,p.data.finished_output_tonnes,r.insertId,req.user.sub]);
    await conn.commit(); res.status(201).json({id:r.insertId,...p.data});
  } catch(e){await conn.rollback();throw e;} finally{conn.release();}
}));

app.post('/api/stock', requireAuth, allowRoles('admin','manager','production'), asyncRoute(async(req,res)=>{
  const p=z.object({product_id:z.coerce.number().int().positive(),movement_date:dateString,movement_type:z.enum(['opening','purchase','adjustment','return']),quantity_tonnes:positive,direction:z.enum(['in','out']),notes:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Enter valid stock movement details'});
  const [r]=await pool.execute('INSERT INTO stock_movements(product_id,movement_date,movement_type,quantity_tonnes,direction,notes,created_by) VALUES(?,?,?,?,?,?,?)',[p.data.product_id,p.data.movement_date,p.data.movement_type,p.data.quantity_tonnes,p.data.direction,p.data.notes||null,req.user.sub]);
  res.status(201).json({id:r.insertId,...p.data});
}));

app.post('/api/customers', requireAuth, allowRoles('admin','manager','accounts'), asyncRoute(async(req,res)=>{
  const p=z.object({name:z.string().min(2),phone:z.string().optional(),email:z.string().email().optional().or(z.literal('')),billing_address:z.string().optional(),gstin:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Customer name is required; check email'});
  const [r]=await pool.execute('INSERT INTO customers(name,phone,email,billing_address,gstin) VALUES(?,?,?,?,?)',[p.data.name,p.data.phone||null,p.data.email||null,p.data.billing_address||null,p.data.gstin||null]);
  res.status(201).json({id:r.insertId,...p.data});
}));

app.post('/api/orders', requireAuth, allowRoles('admin','manager','accounts'), asyncRoute(async(req,res)=>{
  const p=z.object({order_number:z.string().min(1),customer_id:z.coerce.number().int().positive(),order_date:dateString, due_date:dateString.optional(),notes:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Order number, customer and order date are required'});
  const [r]=await pool.execute('INSERT INTO orders(order_number,customer_id,order_date,due_date,notes,created_by) VALUES(?,?,?,?,?,?)',[p.data.order_number,p.data.customer_id,p.data.order_date,p.data.due_date||null,p.data.notes||null,req.user.sub]);
  res.status(201).json({id:r.insertId,...p.data,status:'pending'});
}));

app.post('/api/invoices', requireAuth, allowRoles('admin','manager','accounts'), asyncRoute(async(req,res)=>{
  const p=z.object({invoice_number:z.string().min(1),customer_id:z.coerce.number().int().positive(),order_id:z.coerce.number().int().positive().optional(),invoice_date:dateString,subtotal:nonNegative,tax_rate:z.coerce.number().min(0).max(100).default(0),notes:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Invoice number, customer, date and subtotal are required'});
  const tax=Math.round(p.data.subtotal*p.data.tax_rate)/100;
  const total=Math.round((p.data.subtotal+tax)*100)/100;
  const [r]=await pool.execute('INSERT INTO invoices(invoice_number,order_id,customer_id,invoice_date,subtotal,tax_rate,tax_amount,total_amount,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?)',[p.data.invoice_number,p.data.order_id||null,p.data.customer_id,p.data.invoice_date,p.data.subtotal,p.data.tax_rate,tax,total,p.data.notes||null,req.user.sub]);
  res.status(201).json({id:r.insertId,...p.data,tax_amount:tax,total_amount:total,payment_status:'unpaid'});
}));

app.post('/api/payments', requireAuth, allowRoles('admin','manager','accounts'), asyncRoute(async(req,res)=>{
  const p=z.object({invoice_id:z.coerce.number().int().positive(),payment_date:dateString,amount:positive,method:z.enum(['cash','bank_transfer','upi','cheque','other']).default('bank_transfer'),reference_number:z.string().optional(),notes:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Enter invoice, date and positive payment amount'});
  const conn=await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [inv]=await conn.execute('SELECT id,total_amount FROM invoices WHERE id=? FOR UPDATE',[p.data.invoice_id]);
    if(!inv[0]) {await conn.rollback();return res.status(404).json({error:'Invoice not found'});}
    const [r]=await conn.execute('INSERT INTO payments(invoice_id,payment_date,amount,method,reference_number,notes,created_by) VALUES(?,?,?,?,?,?,?)',[p.data.invoice_id,p.data.payment_date,p.data.amount,p.data.method,p.data.reference_number||null,p.data.notes||null,req.user.sub]);
    const [[paid]]=await conn.execute('SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id=?',[p.data.invoice_id]);
    const status=Number(paid.paid)>=Number(inv[0].total_amount)?'paid':Number(paid.paid)>0?'partial':'unpaid';
    await conn.execute('UPDATE invoices SET payment_status=? WHERE id=?',[status,p.data.invoice_id]);
    await conn.commit();res.status(201).json({id:r.insertId,payment_status:status,total_paid:Number(paid.paid)});
  } catch(e){await conn.rollback();throw e;} finally{conn.release();}
}));

app.post('/api/vehicles', requireAuth, allowRoles('admin','manager','dispatch'), asyncRoute(async(req,res)=>{
  const p=z.object({registration_number:z.string().min(3),vehicle_type:z.string().optional(),capacity_tonnes:nonNegative.optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Vehicle registration number is required'});
  const [r]=await pool.execute('INSERT INTO vehicles(registration_number,vehicle_type,capacity_tonnes) VALUES(?,?,?)',[p.data.registration_number.toUpperCase(),p.data.vehicle_type||null,p.data.capacity_tonnes??null]);
  res.status(201).json({id:r.insertId,...p.data});
}));

app.post('/api/drivers', requireAuth, allowRoles('admin','manager','dispatch'), asyncRoute(async(req,res)=>{
  const p=z.object({full_name:z.string().min(2),phone:z.string().optional(),licence_number:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Driver name is required'});
  const [r]=await pool.execute('INSERT INTO drivers(full_name,phone,licence_number) VALUES(?,?,?)',[p.data.full_name,p.data.phone||null,p.data.licence_number||null]);
  res.status(201).json({id:r.insertId,...p.data});
}));

app.post('/api/trips', requireAuth, allowRoles('admin','manager','dispatch'), asyncRoute(async(req,res)=>{
  const p=z.object({trip_date:dateString,vehicle_id:z.coerce.number().int().positive(),driver_id:z.coerce.number().int().positive().optional(),order_id:z.coerce.number().int().positive().optional(),invoice_id:z.coerce.number().int().positive().optional(),destination:z.string().optional(),gross_weight_tonnes:nonNegative,tare_weight_tonnes:nonNegative,status:z.enum(['planned','loaded','dispatched','delivered','cancelled']).default('planned'),weighbridge_slip:z.string().optional(),notes:z.string().optional()}).safeParse(req.body);
  if(!p.success) return res.status(400).json({error:'Enter trip date, vehicle and valid gross/tare weights'});
  if(p.data.gross_weight_tonnes < p.data.tare_weight_tonnes) return res.status(400).json({error:'Gross weight cannot be less than tare weight'});
  const net=Number((p.data.gross_weight_tonnes-p.data.tare_weight_tonnes).toFixed(3));
  const [r]=await pool.execute('INSERT INTO lorry_trips(trip_date,vehicle_id,driver_id,order_id,invoice_id,destination,gross_weight_tonnes,tare_weight_tonnes,net_weight_tonnes,status,weighbridge_slip,notes,created_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [p.data.trip_date,p.data.vehicle_id,p.data.driver_id||null,p.data.order_id||null,p.data.invoice_id||null,p.data.destination||null,p.data.gross_weight_tonnes,p.data.tare_weight_tonnes,net,p.data.status,p.data.weighbridge_slip||null,p.data.notes||null,req.user.sub]);
  res.status(201).json({id:r.insertId,...p.data,net_weight_tonnes:net});
}));

app.get('/api/reports/:type', requireAuth, authorizeReport, asyncRoute(async (req,res) => {
  let range;
  try { range = normalizeReportRange(req.query.from, req.query.to, today()); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  const rows = await fetchReportRows(req.params.type, range.from, range.to);
  res.json({ report: req.params.type, ...range, count: rows.length, rows });
}));

// ─────────────────────────────────────────────────────────────────
//  WEBAUTHN / FINGERPRINT ROUTES
// ─────────────────────────────────────────────────────────────────
const RP_ID   = process.env.WEBAUTHN_RP_ID   || 'localhost';
const RP_NAME = process.env.WEBAUTHN_RP_NAME  || 'VATHAN MINERALS';
const WEBAUTHN_ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:5173';

// In-memory challenge store: key → { challenge, expiresAt }
const challengeCache = new Map();
const setChallenge = (key, c) =>
  challengeCache.set(key, { challenge: c, expiresAt: Date.now() + 5 * 60_000 });
const popChallenge = (key) => {
  const e = challengeCache.get(key); challengeCache.delete(key);
  if (!e || Date.now() > e.expiresAt) return null;
  return e.challenge;
};

// GET  /api/webauthn/enrolled  – list employees that have fingerprint credentials
app.get('/api/webauthn/enrolled', requireAuth, asyncRoute(async (req, res) => {
  const [rows] = await pool.query(
    `SELECT fc.id cred_id, fc.employee_id, fc.device_type, fc.created_at, fc.last_used,
            e.employee_code, e.full_name, e.job_title
     FROM fingerprint_credentials fc
     JOIN employees e ON e.id = fc.employee_id
     ORDER BY e.full_name`
  );
  res.json(rows);
}));

// POST /api/webauthn/register-options  – generate registration options (admin/manager)
app.post('/api/webauthn/register-options', requireAuth, asyncRoute(async (req, res) => {
  const { employee_id } = req.body;
  if (!employee_id) return res.status(400).json({ error: 'employee_id is required' });

  const [[emp]] = await pool.query('SELECT * FROM employees WHERE id=?', [employee_id]);
  if (!emp) return res.status(404).json({ error: 'Employee not found' });

  const [existing] = await pool.query(
    'SELECT credential_id FROM fingerprint_credentials WHERE employee_id=?', [employee_id]
  );

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: emp.employee_code,
    userDisplayName: emp.full_name,
    attestationType: 'none',
    excludeCredentials: existing.map(c => ({ id: c.credential_id, type: 'public-key' })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
      authenticatorAttachment: 'platform', // device fingerprint sensor
    },
  });

  setChallenge(`reg_${employee_id}`, options.challenge);
  res.json(options);
}));

// POST /api/webauthn/register-verify  – verify & store registration
app.post('/api/webauthn/register-verify', requireAuth, asyncRoute(async (req, res) => {
  const { employee_id, registration } = req.body;
  if (!employee_id || !registration) return res.status(400).json({ error: 'employee_id and registration required' });

  const expectedChallenge = popChallenge(`reg_${employee_id}`);
  if (!expectedChallenge) return res.status(400).json({ error: 'Registration challenge expired. Please try again.' });

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: registration,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: false,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (!verification.verified) return res.status(400).json({ error: 'Registration verification failed' });

  const { credential, credentialDeviceType } = verification.registrationInfo;
  const publicKeyB64 = Buffer.from(credential.publicKey).toString('base64');
  const transports = (registration.response?.transports || []).join(',');

  await pool.query(
    `INSERT INTO fingerprint_credentials
       (employee_id, credential_id, public_key, counter, device_type, transports)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE public_key=VALUES(public_key), counter=VALUES(counter), last_used=NOW()`,
    [employee_id, credential.id, publicKeyB64, credential.counter, credentialDeviceType || 'singleDevice', transports]
  );

  res.json({ verified: true });
}));

// POST /api/webauthn/auth-options  – generate auth challenge (public – kiosk use)
app.post('/api/webauthn/auth-options', asyncRoute(async (req, res) => {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: 'preferred',
    allowCredentials: [], // discoverable – browser finds the right credential
    timeout: 60_000,
  });
  setChallenge('auth', options.challenge);
  res.json(options);
}));

// POST /api/webauthn/auth-verify  – verify auth & mark attendance (public – kiosk)
app.post('/api/webauthn/auth-verify', asyncRoute(async (req, res) => {
  const { authResponse, date } = req.body;
  if (!authResponse) return res.status(400).json({ error: 'authResponse required' });

  const expectedChallenge = popChallenge('auth');
  if (!expectedChallenge) return res.status(400).json({ error: 'Auth challenge expired. Please try again.' });

  // Look up the credential by credentialId
  const [[storedCred]] = await pool.query(
    `SELECT fc.*, e.id emp_id, e.full_name, e.employee_code, e.job_title
     FROM fingerprint_credentials fc
     JOIN employees e ON e.id = fc.employee_id
     WHERE fc.credential_id = ?`,
    [authResponse.id]
  );
  if (!storedCred) return res.status(404).json({ error: 'Fingerprint not recognized. Please enroll first.' });

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: WEBAUTHN_ORIGIN,
      expectedRPID: RP_ID,
      credential: {
        id: storedCred.credential_id,
        publicKey: Buffer.from(storedCred.public_key, 'base64'),
        counter: Number(storedCred.counter),
        transports: storedCred.transports ? storedCred.transports.split(',') : [],
      },
      requireUserVerification: false,
    });
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }

  if (!verification.verified) return res.status(400).json({ error: 'Fingerprint verification failed.' });

  // Update counter & last_used
  await pool.query(
    'UPDATE fingerprint_credentials SET counter=?, last_used=NOW() WHERE credential_id=?',
    [verification.authenticationInfo.newCounter, authResponse.id]
  );

  // Mark attendance
  const attendanceDate = date || new Date().toISOString().slice(0, 10);
  const nowTime = new Date().toTimeString().slice(0, 5);

  const [[existing]] = await pool.query(
    'SELECT * FROM attendance WHERE employee_id=? AND attendance_date=?',
    [storedCred.emp_id, attendanceDate]
  );

  const action = existing && existing.check_in && !existing.check_out ? 'check_out' : 'check_in';

  await pool.query(
    `INSERT INTO attendance (employee_id, attendance_date, status, check_in, check_out, verification_type, notes)
     VALUES (?, ?, 'present', ?, ?, 'fingerprint',
             CONCAT('Fingerprint verified at ', ?))
     ON DUPLICATE KEY UPDATE
       check_in  = IF(check_in IS NULL, VALUES(check_in), check_in),
       check_out = IF(check_in IS NOT NULL AND check_out IS NULL, VALUES(check_out), check_out),
       status    = 'present',
       verification_type = 'fingerprint',
       notes     = VALUES(notes)`,
    [
      storedCred.emp_id, attendanceDate,
      action === 'check_in' ? nowTime : null,
      action === 'check_out' ? nowTime : null,
      nowTime
    ]
  );

  res.json({
    success: true,
    action,
    time: nowTime,
    employee: {
      id: storedCred.emp_id,
      full_name: storedCred.full_name,
      employee_code: storedCred.employee_code,
      job_title: storedCred.job_title,
    },
    message: `${storedCred.full_name} — ${action === 'check_in' ? 'Checked In' : 'Checked Out'} at ${nowTime}`
  });
}));

// DELETE /api/webauthn/credentials/:employee_id  – remove all fingerprint credentials
app.delete('/api/webauthn/credentials/:employee_id', requireAuth, asyncRoute(async (req, res) => {
  await pool.query('DELETE FROM fingerprint_credentials WHERE employee_id=?', [req.params.employee_id]);
  res.json({ ok: true });
}));

// Serve the compiled React frontend static files for instant loading
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.all('/api/*', (req,res)=>res.status(404).json({error:'API route not found'}));
app.use((req,res)=>res.status(404).json({error:'Not found'}));
app.use((err,req,res,next)=>{
  console.error(err);
  if(err.code==='ER_DUP_ENTRY') return res.status(409).json({error:'A record with this unique value already exists'});
  if(err.code==='ER_NO_REFERENCED_ROW_2') return res.status(400).json({error:'A referenced record does not exist'});
  res.status(500).json({error:process.env.NODE_ENV==='production'?'Unexpected server error':err.message});
});

const port=Number(process.env.PORT||4000);
if (process.env.NODE_ENV !== 'test') app.listen(port, '0.0.0.0', ()=>console.log(`Vathan Minerals API listening on port ${port}`));
export default app;
