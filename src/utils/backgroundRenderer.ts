import type { BackgroundItem } from '../data/shopTypes.ts';

const bgCache = new Map<string, HTMLCanvasElement>();

function getSkyLayerCanvas(bg: BackgroundItem, width: number, height: number): HTMLCanvasElement {
  const key = `${bg.id}_${width}x${height}`;
  const cached = bgCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const p = bg.renderParams;
  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, p.skyTop);
  grad.addColorStop(1, p.skyBottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Stars for night / space / cyber
  if (p.timeOfDay === 'night' || p.template === 'space' || p.template === 'cyber') {
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 42; i++) {
      const sx = ((p.seed * 73 + i * 197) % 1000) / 1000 * width;
      const sy = ((p.seed * 41 + i * 113) % 1000) / 1000 * (height * 0.65);
      const r = (i % 3) * 0.6 + 0.7;
      ctx.globalAlpha = 0.25 + ((i % 5) * 0.14);
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Sun / Moon / Planet orb
  const orbX = width * (0.2 + ((p.seed * 17) % 60) / 100);
  const orbY = height * (p.timeOfDay === 'dusk' ? 0.42 : 0.22);
  ctx.save();
  ctx.fillStyle = p.accentColor;
  ctx.globalAlpha = 0.2;
  ctx.beginPath();
  ctx.arc(orbX, orbY, Math.min(width, height) * 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.8;
  ctx.beginPath();
  ctx.arc(orbX, orbY, Math.min(width, height) * 0.042, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (bgCache.size > 24) {
    const firstKey = bgCache.keys().next().value;
    if (firstKey) bgCache.delete(firstKey);
  }
  bgCache.set(key, canvas);
  return canvas;
}

export function drawProceduralBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundItem,
  width: number,
  height: number,
  parallaxOffsetX: number,
  timeMs: number
): void {
  const sky = getSkyLayerCanvas(bg, width, height);
  ctx.drawImage(sky, 0, 0);

  const p = bg.renderParams;
  const shiftFar = -parallaxOffsetX * 0.08;
  const shiftNear = -parallaxOffsetX * 0.16;

  // Far parallax layer
  ctx.save();
  ctx.fillStyle = p.hillFar;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = -40; x <= width + 60; x += 60) {
    const wave =
      p.template === 'city' || p.template === 'cyber'
        ? ((Math.abs(Math.floor((x + shiftFar) / 60 + p.seed)) % 4) * 26)
        : Math.sin((x + shiftFar) * 0.008 + p.seed) * 32 +
          Math.cos((x + shiftFar) * 0.017) * 16;
    const baseY = height * 0.68 - Math.abs(wave);
    ctx.lineTo(x, baseY);
  }
  ctx.lineTo(width + 60, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Template accents on far/mid layer
  if (p.template === 'castle') {
    ctx.fillStyle = p.hillFar;
    const cx = width * 0.5 + shiftFar * 0.5;
    ctx.fillRect(cx - 48, height * 0.44, 24, height * 0.3);
    ctx.fillRect(cx + 24, height * 0.46, 22, height * 0.3);
    ctx.beginPath();
    ctx.moveTo(cx - 52, height * 0.44);
    ctx.lineTo(cx - 36, height * 0.36);
    ctx.lineTo(cx - 20, height * 0.44);
    ctx.fill();
  } else if (p.template === 'clouds') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
    for (let i = 0; i < 4; i++) {
      const cx = ((i * 290 + timeMs * 0.01 + shiftFar) % (width + 200)) - 100;
      const cy = height * (0.18 + (i % 2) * 0.12);
      ctx.beginPath();
      ctx.ellipse(cx, cy, 70, 22, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Near parallax silhouette
  ctx.save();
  ctx.fillStyle = p.hillNear;
  ctx.beginPath();
  ctx.moveTo(0, height);
  for (let x = -40; x <= width + 60; x += 50) {
    const wave =
      Math.sin((x + shiftNear) * 0.011 + p.seed * 2) * 22 +
      Math.cos((x + shiftNear) * 0.024) * 10;
    ctx.lineTo(x, height * 0.8 + wave);
  }
  ctx.lineTo(width + 60, height);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Subtle weather overlay (lightweight 14 motes)
  if (p.weather === 'snowfall' || p.weather === 'sparks' || p.weather === 'breeze') {
    ctx.save();
    ctx.fillStyle = p.weather === 'snowfall' ? '#F8FAFC' : p.accentColor;
    for (let i = 0; i < 14; i++) {
      const t = timeMs * (p.weather === 'sparks' ? 0.04 : 0.025);
      const mx = ((i * 113 + p.seed * 31 + (p.weather === 'breeze' ? t * 1.8 : 0)) % (width + 40)) - 20;
      const my =
        p.weather === 'sparks'
          ? height - ((i * 79 + t) % height)
          : (i * 67 + t) % height;
      ctx.globalAlpha = 0.25 + (i % 3) * 0.1;
      ctx.beginPath();
      ctx.arc(mx, my, p.weather === 'snowfall' ? 2.2 : 1.7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}
