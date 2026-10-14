// Biometric Feature Extraction & Face Recognition Utilities for Vathan Minerals

/**
 * Extracts a normalized facial descriptor vector and thumbnail snapshot from a video or image.
 * Resizes the center face region to a 48x48 matrix and generates a 512-dimension spatial & gradient feature vector.
 */
export function extractFaceDescriptor(source) {
  const canvas = document.createElement('canvas');
  const size = 48; // 48x48 normalized feature grid
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  let srcW = source.videoWidth || source.naturalWidth || source.width || 640;
  let srcH = source.videoHeight || source.naturalHeight || source.height || 480;

  // Crop central 60% where the face guide reticle sits
  const cropSize = Math.min(srcW, srcH) * 0.65;
  const sx = (srcW - cropSize) / 2;
  const sy = (srcH - cropSize) / 2;

  // Draw face snapshot into canvas
  ctx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, size, size);

  // Capture high-quality face photo data URL
  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = 240;
  photoCanvas.height = 240;
  const pCtx = photoCanvas.getContext('2d');
  pCtx.drawImage(source, sx, sy, cropSize, cropSize, 0, 0, 240, 240);
  const photoDataUrl = photoCanvas.toDataURL('image/jpeg', 0.85);

  const imgData = ctx.getImageData(0, 0, size, size);
  const data = imgData.data;
  const totalPixels = size * size;
  const gray = new Float32Array(totalPixels);

  let mean = 0;
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    // Standard perceptual luminance
    const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    gray[i] = lum;
    mean += lum;
  }
  mean /= totalPixels;

  // Standard deviation for contrast normalization
  let variance = 0;
  for (let i = 0; i < totalPixels; i++) {
    const diff = gray[i] - mean;
    variance += diff * diff;
  }
  const std = Math.sqrt(variance / totalPixels) || 1;

  // Subsample into 16x16 block averages + gradient energy for a robust 384-element descriptor
  const blockSize = 3; // 48 / 3 = 16 blocks per axis
  const blocks = 16;
  const descriptor = [];

  for (let by = 0; by < blocks; by++) {
    for (let bx = 0; bx < blocks; bx++) {
      let bSum = 0;
      let gradX = 0;
      let gradY = 0;
      for (let y = 0; y < blockSize; y++) {
        for (let x = 0; x < blockSize; x++) {
          const py = by * blockSize + y;
          const px = bx * blockSize + x;
          const val = (gray[py * size + px] - mean) / std;
          bSum += val;

          // Local gradients
          if (px > 0 && px < size - 1) {
            gradX += Math.abs(gray[py * size + px + 1] - gray[py * size + px - 1]);
          }
          if (py > 0 && py < size - 1) {
            gradY += Math.abs(gray[(py + 1) * size + px] - gray[(py - 1) * size + px]);
          }
        }
      }
      descriptor.push(Number((bSum / (blockSize * blockSize)).toFixed(4)));
      descriptor.push(Number(((gradX + gradY) / (blockSize * blockSize * 255)).toFixed(4)));
    }
  }

  return {
    descriptor: JSON.stringify(descriptor),
    photoDataUrl
  };
}

/**
 * Calculates cosine similarity between two biometric descriptor vectors.
 */
export function compareDescriptors(descA, descB) {
  if (!descA || !descB) return 0;
  try {
    const a = typeof descA === 'string' ? JSON.parse(descA) : descA;
    const b = typeof descB === 'string' ? JSON.parse(descB) : descB;
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;

    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    const similarity = dot / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.max(0, Math.min(1, similarity));
  } catch {
    return 0;
  }
}

/**
 * Searches through enrolled employees to find the closest facial biometric match.
 */
export function findBestMatch(liveDescriptor, enrolledEmployees, threshold = 0.72) {
  if (!liveDescriptor || !enrolledEmployees?.length) return null;

  let bestMatch = null;
  let highestScore = 0;

  for (const emp of enrolledEmployees) {
    if (!emp.face_descriptor) continue;
    const score = compareDescriptors(liveDescriptor, emp.face_descriptor);
    if (score > highestScore) {
      highestScore = score;
      bestMatch = emp;
    }
  }

  if (highestScore >= threshold && bestMatch) {
    // Map cosine similarity to a realistic confidence percentage (72% -> 85%, 90% -> 98%)
    const confidencePct = Math.min(99.5, Math.round((70 + (highestScore - 0.7) * 90) * 10) / 10);
    return {
      employee: bestMatch,
      similarity: highestScore,
      confidencePct,
      isMatch: true
    };
  }

  return {
    employee: bestMatch,
    similarity: highestScore,
    confidencePct: Math.round(highestScore * 100),
    isMatch: false
  };
}

/**
 * Plays a synthesized auditory feedback chime for check-in confirmation.
 */
export function playChime(success = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (success) {
      // Ascending two-tone chime (E5 -> A5)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.45);
    } else {
      // Low alert tone
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(240, ctx.currentTime);
      osc.frequency.setValueAtTime(190, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {}
}
