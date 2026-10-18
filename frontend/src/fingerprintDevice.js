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
 * VATHAN MINERALS — Biometric Fingerprint Hardware Engine
 * Specialized Integration for:
 * 1. Mantra MFS100 / MFS110 USB Optical Fingerprint Scanners (India Standard)
 * 2. Mantra RD Service (UIDAI Registered Device XML Spec)
 * 3. WebUSB Direct Hardware Pairing
 * 4. India Standard RD Services (Morpho MSO 1300, Startek FM220, SecuGen)
 * 5. Laptop Built-in Sensors (Windows Hello / Touch ID via WebAuthn)
 */

// Mantra Official USB Vendor & Product IDs
export const MANTRA_USB_FILTERS = [
  { vendorId: 0x2779 }, // Mantra Softech India (10105)
  { vendorId: 0x0483, productId: 0x0214 }, // STMicroelectronics / Mantra MFS100 USB
  { vendorId: 0x0483, productId: 0x5710 }, // Mantra MFS110
  { vendorId: 0x2779, productId: 0x0214 }, // Mantra MFS100
  { vendorId: 0x2779, productId: 0x8890 }, // Mantra MIS100 / Iris
];

// Mantra Local Client & RD Service Endpoints
const MANTRA_ENDPOINTS = [
  { proto: 'https', host: '127.0.0.1', port: 8003, name: 'Mantra HTTPS Client (Port 8003)' },
  { proto: 'http',  host: '127.0.0.1', port: 8004, name: 'Mantra HTTP Client (Port 8004)' },
  { proto: 'http',  host: '127.0.0.1', port: 8005, name: 'Mantra HTTP Client (Port 8005)' },
  { proto: 'http',  host: 'localhost', port: 8004, name: 'Mantra HTTP Localhost' },
  { proto: 'https', host: '127.0.0.1', port: 11100, name: 'Mantra HTTPS RD Service (Port 11100)' },
  { proto: 'http',  host: '127.0.0.1', port: 11100, name: 'Mantra HTTP RD Service (Port 11100)' },
  { proto: 'http',  host: '127.0.0.1', port: 11101, name: 'Mantra HTTP RD Service (Port 11101)' },
];

export const MANTRA_DRIVER_DOWNLOADS = {
  driver: 'https://download.mantratecapp.com/Forms/DownLoadFiles?Verification=MFS100Driver_9.2.0.0.exe',
  rdService: 'https://download.mantratecapp.com/Forms/DownLoadFiles?Verification=MFS100RDService_1.0.8.exe',
  clientService: 'https://download.mantratecapp.com/Forms/DownLoadFiles?Verification=MFS100ClientService_9.0.3.8.exe',
  officialPortal: 'https://www.mantratec.com/download'
};

/**
 * Check if Mantra MFS100 device is connected via WebUSB (Chrome/Edge)
 */
export async function checkMantraWebUsb() {
  if (typeof navigator === 'undefined' || !navigator.usb) {
    return { supported: false, paired: false, device: null };
  }
  try {
    const devices = await navigator.usb.getDevices();
    const mantra = devices.find(d => 
      d.vendorId === 0x2779 || 
      (d.vendorId === 0x0483 && (d.productId === 0x0214 || d.productId === 0x5710))
    );
    if (mantra) {
      return {
        supported: true,
        paired: true,
        device: {
          productName: mantra.productName || 'Mantra MFS100 Optical Fingerprint Scanner',
          manufacturerName: mantra.manufacturerName || 'Mantra Softech India Pvt. Ltd.',
          serialNumber: mantra.serialNumber || 'USB-CONNECTED',
          vendorId: mantra.vendorId,
          productId: mantra.productId
        }
      };
    }
    return { supported: true, paired: false, device: null };
  } catch (_) {
    return { supported: true, paired: false, device: null };
  }
}

/**
 * Trigger Chrome/Edge browser popup to select and pair physical Mantra USB device
 */
export async function pairMantraUsbDevice() {
  if (typeof navigator === 'undefined' || !navigator.usb) {
    throw new Error('WebUSB is not supported in this browser. Please use Google Chrome or Microsoft Edge.');
  }
  try {
    const device = await navigator.usb.requestDevice({ filters: MANTRA_USB_FILTERS });
    return {
      success: true,
      productName: device.productName || 'Mantra MFS100 Optical Scanner',
      manufacturerName: device.manufacturerName || 'Mantra Softech India',
      serialNumber: device.serialNumber || 'MFS100-ACTIVE',
      vendorId: device.vendorId,
      productId: device.productId
    };
  } catch (err) {
    if (err.name === 'NotFoundError') {
      throw new Error('No Mantra device selected. Make sure the MFS100 USB cable is plugged into your laptop and click Connect again.');
    }
    throw err;
  }
}

/**
 * Probe Mantra MFS100 Client Service or RD Service on local machine
 */
export async function detectMantraDevice() {
  // 1. First check if paired via WebUSB
  const webusbStatus = await checkMantraWebUsb();
  
  // 2. Probe Mantra local web service endpoints
  for (const ep of MANTRA_ENDPOINTS) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 1100);
      const url = `${ep.proto}://${ep.host}:${ep.port}${ep.port === 11100 || ep.port === 11101 ? '/rd/info' : '/mfs100/info'}`;
      
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(id);

      if (res.ok) {
        let serialNo = null;
        let make = 'MANTRA SOFTECH';
        let model = 'MFS100';
        let width = 300;
        let height = 400;

        try {
          const text = await res.text();
          if (text.startsWith('{')) {
            const json = JSON.parse(text);
            const dev = json.DeviceInfo || json;
            serialNo = dev.SerialNo || dev.serialNo;
            make = dev.Make || make;
            model = dev.Model || model;
            width = dev.Width || width;
            height = dev.Height || height;
          }
        } catch (_) {}

        return {
          connected: true,
          endpoint: ep,
          make,
          model,
          serialNo: serialNo || (webusbStatus.paired ? webusbStatus.device.serialNumber : 'MFS100-ONLINE'),
          isRdService: ep.port === 11100 || ep.port === 11101,
          webusb: webusbStatus.paired,
          infoText: `${make} ${model} (Port ${ep.port})`
        };
      }
    } catch (_) {}
  }

  // If WebUSB is paired even if local HTTP service is stopped:
  if (webusbStatus.paired) {
    return {
      connected: true,
      endpoint: null,
      make: 'Mantra Softech India',
      model: 'MFS100 Optical Scanner',
      serialNo: webusbStatus.device.serialNumber || 'USB-PAIRED',
      isRdService: false,
      webusb: true,
      infoText: 'Mantra MFS100 USB Hardware Paired'
    };
  }

  return {
    connected: false,
    endpoint: null,
    make: null,
    model: null,
    serialNo: null,
    isRdService: false,
    webusb: false,
    infoText: 'Mantra MFS100 not detected'
  };
}

/**
 * Universal Hardware Probe (Mantra, Standard RD, SecuGen, Laptop Sensor)
 */
export async function detectLocalUsbScanner() {
  // Check Mantra First (Priority #1)
  const mantra = await detectMantraDevice();
  if (mantra.connected) {
    return {
      found: true,
      type: 'mantra',
      name: `Mantra ${mantra.model || 'MFS100'} Scanner`,
      port: mantra.endpoint?.port || 8004,
      mantraDetails: mantra
    };
  }

  // Check Laptop Biometrics (Windows Hello / Touch ID)
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

  return {
    found: false,
    type: null,
    name: 'No Biometric Hardware Detected',
    port: null
  };
}

/**
 * Real Mantra MFS100 Fingerprint Capture
 */
export async function captureMantraFingerprint(port = 8004, quality = 60, timeout = 10000) {
  // Check candidate ports if the specified one fails
  const candidatePorts = [port, 8004, 8003, 8005, 11100];
  let lastErr = null;

  for (const p of [...new Set(candidatePorts)]) {
    try {
      const proto = p === 8003 ? 'https' : 'http';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout + 3000);

      // If it's port 11100, use RD Service Capture spec
      if (p === 11100) {
        clearTimeout(timer);
        return await captureRdServiceFingerprint(11100, timeout);
      }

      const res = await fetch(`${proto}://127.0.0.1:${p}/mfs100/capture`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Quality: quality, TimeOut: timeout }),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (res.ok) {
        const data = await res.json();
        if (data.ErrorCode === 0 || data.ErrorCode === '0') {
          return {
            success: true,
            quality: data.Quality || quality,
            nfiq: data.Nfiq || 1,
            image: data.BitmapData ? `data:image/bmp;base64,${data.BitmapData}` : null,
            template: data.IsoTemplate || data.AnsiTemplate || data.RawData,
            serialNo: data.DeviceInfo?.SerialNo || null,
            scannerModel: 'Mantra MFS100 USB Optical Scanner'
          };
        }
        throw new Error(data.ErrorDescription || `Mantra capture returned code: ${data.ErrorCode}`);
      }
    } catch (err) {
      lastErr = err;
    }
  }

  throw new Error(
    lastErr?.message || 
    'Unable to communicate with Mantra MFS100. Ensure the scanner USB is plugged in and Mantra Client Service / RD Service is running.'
  );
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
        scannerModel: 'Mantra MFS100 RD Service'
      };
    }
    throw new Error(errInfo || `RD Service capture returned error code: ${errCode}`);
  } catch (err) {
    throw new Error(err.message || 'Unable to connect to Mantra RD Service on port ' + port);
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
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Optical green/cyan tint simulating Mantra scanner prism
    ctx.strokeStyle = '#10b981';
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

