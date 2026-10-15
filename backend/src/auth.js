import jwt from 'jsonwebtoken';

const isConnectionSecure = (req) => {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (!req) return false;
  return Boolean(
    req.secure || 
    req.headers['x-forwarded-proto'] === 'https' || 
    (typeof req.headers['cf-visitor'] === 'string' && req.headers['cf-visitor'].includes('https'))
  );
};

const cookieOptions = (isSecure = false) => ({
  httpOnly: true,
  secure: isSecure,
  sameSite: isSecure ? 'none' : 'lax',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000
});

export function setAuthCookie(res, user, req = null) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  const token = jwt.sign({ 
    sub: String(user.id), 
    role: user.role, 
    email: user.email, 
    employee_id: user.employee_id || null 
  }, secret, { expiresIn: '8h' });
  const secure = isConnectionSecure(req);
  res.cookie('barytes_session', token, cookieOptions(secure));
  return token;
}

export function clearAuthCookie(res) {
  res.clearCookie('barytes_session', { httpOnly: true, secure: true, sameSite: 'none', path: '/' });
  res.clearCookie('barytes_session', { httpOnly: true, secure: false, sameSite: 'lax', path: '/' });
}

export function requireAuth(req, res, next) {
  let token = req.cookies?.barytes_session;
  
  // Also support Authorization: Bearer <token>
  if (!token && req.headers?.authorization) {
    const parts = req.headers.authorization.split(' ');
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1].trim();
    }
  }

  // Also support URL query auth_token for download links (e.g. PDF / CSV)
  if (!token && req.query?.auth_token) {
    token = String(req.query.auth_token).trim();
  }

  if (!token) return res.status(401).json({ error: 'Please log in' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please log in again.' });
  }
}

export function allowRoles(...roles) {
  return (req, res, next) => roles.includes(req.user?.role)
    ? next()
    : res.status(403).json({ error: 'You do not have permission for this action' });
}
