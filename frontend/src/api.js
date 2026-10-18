const PROD_API = 'https://doors-strain-without-hostel.trycloudflare.com/api';
const isRemoteHost = typeof window !== 'undefined' && (
  window.location.hostname.includes('vercel.app') || 
  (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && !window.location.hostname.includes('trycloudflare.com'))
);
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

  const fetchOptions = {
    credentials: 'include',
    ...options,
    headers
  };

  // Determine candidate URLs (primary & fallback)
  const candidateUrls = [];
  if (isRemoteHost) {
    // On Vercel: try direct tunnel first for real-time speed, then Vercel proxy rewrite
    candidateUrls.push(`${PROD_API}${path}`);
    candidateUrls.push(`/api${path}`);
  } else {
    candidateUrls.push(`/api${path}`);
  }

  let lastError = null;
  for (const url of candidateUrls) {
    try {
      const res = await fetch(url, fetchOptions);
      const data = res.status === 204 ? null : await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 401 && (data?.error === 'Please log in' || data?.error?.includes('expired'))) {
          clearAuthToken();
        }
        throw new Error(data?.error || `Request failed (${res.status})`);
      }
      return data;
    } catch (err) {
      lastError = err;
      // If it's an HTTP error with a response (like 400, 401, 403), don't retry, rethrow immediately
      if (err.message && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError') && !err.message.includes('Load failed')) {
        throw err;
      }
      // If it was a network failure, loop will try the next candidate URL
    }
  }

  throw new Error(lastError?.message?.includes('Failed to fetch') || lastError?.message?.includes('NetworkError')
    ? 'Unable to connect to the mining server. Please verify network connection or try again.'
    : (lastError?.message || 'Network request failed'));
}

