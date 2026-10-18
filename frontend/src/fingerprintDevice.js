/**
 * VATHAN MINERALS — Biometric Fingerprint Hardware Engine
 * Multi-Device Support for:
 * 1. Laptop Built-in Sensors & Windows Hello / Touch ID (WebAuthn)
 * 2. Mantra MFS100 / MFS110 USB Optical Fingerprint Scanners (India Standard)
 * 3. Standard Registered Device (RD) Services (Morpho MSO, Startek FM220, SecuGen RD)
 * 4. SecuGen WebAPI (Hamster Pro 20)
 * 5. WebUSB Direct Hardware Detection
 */

// Common RD Service & Biometric Local Service Ports
const RD_PORTS = [11100, 11101, 11102, 11103, 11104, 11105];
const MANTRA_CLIENT_PORTS = [8004, 8005, 11100];
const SECUGEN_PORTS = [8080, 8443];

/**
 * Probe local Registered Device (RD) Service ports on Windows laptop
 */
export async function detectLocalUsbScanner() {
  const detected = {
    found: false,
    type: null, // 'mantra' | 'rdservice' | 'secugen' | 'webauthn'
    name: 'No USB scanner detected',
    port: null,
    info: null,
  };

  // 1. Check Mantra MFS100 Client Service
  for (const port of MANTRA_CLIENT_PORTS) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${port}/mfs100/info`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(id);
      if (res.ok) {
        const text = await res.text();
        return {
          found: true,
          type: 'mantra',
          name: 'Mantra MFS100 USB Optical Scanner',
          port,
          info: text
        };
      }
    } catch (_) {}
  }

  // 2. Check Standard India RD Service (Mantra, Morpho, Startek, SecuGen RD)
  for (const port of RD_PORTS) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        method: 'RDSERVICE',
        signal: controller.signal
      }).catch(() => fetch(`http://127.0.0.1:${port}/rd/info`, { signal: controller.signal }));
      clearTimeout(id);
      if (res && (res.ok || res.status === 200 || res.status === 405)) {
        return {
          found: true,
          type: 'rdservice',
          name: 'India Standard Biometric RD Service (Mantra / Morpho / Startek)',
          port,
          info: 'RD Service Online'
        };
      }
    } catch (_) {}
  }

  // 3. Check SecuGen WebAPI
  for (const port of SECUGEN_PORTS) {
    try {
      const proto = port === 8443 ? 'https' : 'http';
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1200);
      const res = await fetch(`${proto}://127.0.0.1:${port}/SGIFPCapture`, {
        method: 'OPTIONS',
        signal: controller.signal
      });
      clearTimeout(id);
      if (res.ok) {
        return {
          found: true,
          type: 'secugen',
          name: 'SecuGen Hamster Pro USB Scanner',
          port,
          info: 'SecuGen WebAPI Online'
        };
      }
    } catch (_) {}
  }

  // 4. Check Laptop Native Fingerprint Sensor (Windows Hello / Touch ID)
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    try {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        return {
          found: true,
          type: 'webauthn',
          name: 'Laptop Biometric Sensor (Windows Hello / Touch ID)',
          port: null,
          info: 'Native Platform Authenticator'
        };
      }
    } catch (_) {}
  }

  return detected;
}

/**
 * Capture fingerprint from Mantra MFS100 USB scanner
 */
export async function captureMantraFingerprint(port = 8004, quality = 60, timeout = 10000) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout + 3000);
    const res = await fetch(`http://127.0.0.1:${port}/mfs100/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Quality: quality, TimeOut: timeout }),
      signal: controller.signal
    });
    clearTimeout(timer);
    const data = await res.json();
    if (data.ErrorCode === 0 || data.ErrorCode === '0') {
      return {
        success: true,
        quality: data.Quality || quality,
        image: data.BitmapData ? `data:image/bmp;base64,${data.BitmapData}` : null,
        template: data.IsoTemplate || data.AnsiTemplate || data.RawData,
        scannerModel: 'Mantra MFS100 USB Scanner'
      };
    }
    throw new Error(data.ErrorDescription || `Mantra scanner capture failed (code: ${data.ErrorCode})`);
  } catch (err) {
    throw new Error(err.message || 'Unable to communicate with Mantra MFS100 scanner service. Ensure Mantra RD Service / Client Service is running.');
  }
}

/**
 * Capture fingerprint from India Standard RD Service (XML specification)
 */
export async function captureRdServiceFingerprint(port = 11100, timeout = 10000) {
  const pidOptions = `<?xml version="1.0"?>
<PidOptions ver="1.0">
  <Opts fCount="1" fType="2" iCount="0" pCount="0" format="0" pidVer="2.0" timeout="${timeout}" env="P" />
</PidOptions>`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout + 4000);
    const res = await fetch(`http://127.0.0.1:${port}/rd/capture`, {
      method: 'CAPTURE',
      headers: { 'Content-Type': 'text/xml' },
      body: pidOptions,
      signal: controller.signal
    });
    clearTimeout(timer);

    const xmlText = await res.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const respElem = xmlDoc.getElementsByTagName('Resp')[0];
    const errCode = respElem?.getAttribute('errCode');
    const errInfo = respElem?.getAttribute('errInfo');

    if (errCode === '0') {
      const qScoreElem = xmlDoc.getElementsByTagName('PidData')[0] || xmlDoc.getElementsByTagName('Data')[0];
      const qScore = Number(qScoreElem?.getAttribute('qScore')) || 85;
      return {
        success: true,
        quality: qScore,
        image: null,
        template: xmlText,
        scannerModel: 'Standard RD Service USB Scanner'
      };
    }
    throw new Error(errInfo || `RD Service capture returned error code: ${errCode}`);
  } catch (err) {
    throw new Error(err.message || 'Unable to connect to RD Service on port ' + port);
  }
}

/**
 * Capture fingerprint from SecuGen Hamster Pro USB scanner
 */
export async function captureSecuGenFingerprint(port = 8080, timeout = 10000) {
  try {
    const proto = port === 8443 ? 'https' : 'http';
    const params = new URLSearchParams({
      Timeout: String(timeout),
      Quality: '60',
      templateFormat: 'ISO'
    });
    const res = await fetch(`${proto}://127.0.0.1:${port}/SGIFPCapture?${params.toString()}`);
    const data = await res.json();
    if (data.ErrorCode === 0) {
      return {
        success: true,
        quality: data.ImageQuality || 80,
        image: data.BMPBase64 ? `data:image/bmp;base64,${data.BMPBase64}` : null,
        template: data.TemplateBase64,
        scannerModel: 'SecuGen Hamster Pro USB Scanner'
      };
    }
    throw new Error(data.ErrorDescription || `SecuGen capture failed with code: ${data.ErrorCode}`);
  } catch (err) {
    throw new Error(err.message || 'Unable to connect to SecuGen WebAPI service on port ' + port);
  }
}

/**
 * High-definition synthetic biometric pattern generator for hardware simulation / demonstration
 */
export function generateSyntheticFingerprint(seed = 1) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 180;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Dark slate background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Center oval fingerprint outline
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const numRidges = 14;

    for (let i = 1; i <= numRidges; i++) {
      ctx.beginPath();
      const rx = i * 5.2;
      const ry = i * 7.5;
      ctx.ellipse(cx, cy + 10, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Arch ridges at the top
    for (let r = 10; r < 50; r += 7) {
      ctx.beginPath();
      ctx.arc(cx, cy - 20, r, Math.PI * 0.8, Math.PI * 0.2, true);
      ctx.stroke();
    }

    return canvas.toDataURL('image/png');
  } catch (_) {
    return null;
  }
}
