import jwt from 'jsonwebtoken';

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax',
  path: '/',
  maxAge: 8 * 60 * 60 * 1000
});

export function setAuthCookie(res, user) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  const token = jwt.sign({ sub: String(user.id), role: user.role, email: user.email }, secret, { expiresIn: '8h' });
  res.cookie('barytes_session', token, cookieOptions());
}

export function clearAuthCookie(res) {
  res.clearCookie('barytes_session', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.barytes_session;
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
