// services/logoRaster.js
const GS = 0x1D;
const _cache = new Map();

export async function getLogoRaster(logoUrl, maxWidthPx = 240) {
  if (!logoUrl) return null;
  if (_cache.has(logoUrl)) return _cache.get(logoUrl);

  const img = await loadImage(logoUrl);
  const scale = Math.min(1, maxWidthPx / img.width);
  const w = Math.round(img.width * scale) & ~0x07; // múltiplo de 8
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const bytesPerRow = w / 8;
  const bitmap = new Uint8Array(bytesPerRow * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const gray = (data[i] * 0.3 + data[i+1] * 0.59 + data[i+2] * 0.11);
      const alpha = data[i+3];
      const isBlack = alpha > 128 && gray < 160;
      if (isBlack) {
        bitmap[y * bytesPerRow + (x >> 3)] |= (0x80 >> (x % 8));
      }
    }
  }

  const header = [
    GS, 0x76, 0x30, 0x00,
    bytesPerRow & 0xFF, (bytesPerRow >> 8) & 0xFF,
    h & 0xFF, (h >> 8) & 0xFF,
  ];
  const raster = new Uint8Array([...header, ...bitmap]);
  _cache.set(logoUrl, raster);
  return raster;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}