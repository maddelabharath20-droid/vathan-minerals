const PROD_API = 'https://inbox-toll-mid-opportunity.trycloudflare.com/api';
const isRemoteHost = typeof window !== 'undefined' && (
  window.location.hostname.includes('vercel.app') || 
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('trycloudflare.com'))
);
const BASE = isRemoteHost ? PROD_API : '/api';
const TOKEN_KEY = 'barytes_session_token';

export function getAuthToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    console.error('Failed to set auth token', e);
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.error('Failed to clear auth token', e);
  }
}

export async function api(path, options = {}) {
  const token = getAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers
  });

  const data = res.status === 204 ? null : await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && (data?.error === 'Please log in' || data?.error?.includes('expired'))) {
      clearAuthToken();
    }
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}
