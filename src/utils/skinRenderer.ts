import type { SkinItem } from '../data/shopTypes.ts';

const spriteCache = new Map<string, HTMLCanvasElement>();

export function getSkinSpriteCanvas(skin: SkinItem): HTMLCanvasElement {
  const cached = spriteCache.get(skin.id);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const p = skin.renderParams;
  ctx.translate(64, 54);

  // Subtle shadow base
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 34, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body path based on bodyStyle
  ctx.fillStyle = p.primaryColor;
  ctx.strokeStyle = p.secondaryColor;
  ctx.lineWidth = 3;

  ctx.beginPath();
  switch (p.bodyStyle) {
    case 'beetle':
      ctx.ellipse(0, 2, 30, 17, 0, Math.PI, 0);
      ctx.lineTo(30, 14);
      ctx.lineTo(-30, 14);
      ctx.closePath();
      break;
    case 'sled':
      ctx.moveTo(-34, 14);
      ctx.quadraticCurveTo(-28, -4, -10, -4);
      ctx.lineTo(28, -2);
      ctx.quadraticCurveTo(38, 6, 34, 14);
      ctx.closePath();
      break;
    case 'ship':
    case 'catamaran':
      ctx.moveTo(-32, -4);
      ctx.lineTo(34, -6);
      ctx.lineTo(24, 15);
      ctx.lineTo(-24, 15);
      ctx.closePath();
      break;
    case 'rocket_pod':
    case 'drill_ram':
      ctx.moveTo(-30, -10);
      ctx.lineTo(18, -12);
      ctx.lineTo(38, 2);
      ctx.lineTo(18, 16);
      ctx.lineTo(-30, 14);
      ctx.closePath();
      break;
    case 'mech':
    case 'clockwork_walker':
      ctx.roundRect(-24, -14, 48, 28, 7);
      break;
    case 'dragon':
      ctx.moveTo(-32, 14);
      ctx.lineTo(-24, -10);
      ctx.lineTo(12, -12);
      ctx.lineTo(36, -2);
      ctx.lineTo(24, 14);
      ctx.closePath();
      break;
    case 'monowheel':
      ctx.arc(0, 2, 22, 0, Math.PI * 2);
      break;
    case 'crawler':
      ctx.roundRect(-32, -6, 64, 20, 9);
      break;
    case 'wheel':
      ctx.roundRect(-22, -8, 44, 20, 6);
      break;
    default: // cart
      ctx.roundRect(-28, -8, 56, 22, 6);
      break;
  }
  ctx.fill();
  ctx.stroke();

  // Pattern overlay clipped inside body
  ctx.save();
  ctx.clip();
  if (p.pattern === 'stripes') {
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 4;
    for (let x = -30; x <= 30; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, -20);
      ctx.lineTo(x - 8, 20);
      ctx.stroke();
    }
  } else if (p.pattern === 'dots') {
    ctx.fillStyle = p.accentColor;
    for (let x = -20; x <= 20; x += 13) {
      ctx.beginPath();
      ctx.arc(x, (x % 2 === 0 ? -1 : 5), 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.pattern === 'camo') {
    ctx.fillStyle = p.secondaryColor;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.ellipse(-12, 2, 11, 6, 0.3, 0, Math.PI * 2);
    ctx.ellipse(14, -2, 10, 5, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.pattern === 'gradient') {
    const grad = ctx.createLinearGradient(-30, -14, 30, 16);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    ctx.fillStyle = grad;
    ctx.fillRect(-40, -20, 80, 44);
  } else if (p.pattern === 'metal') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.lineTo(26, -2);
    ctx.stroke();
    ctx.fillStyle = p.accentColor;
    for (let x = -22; x <= 22; x += 11) {
      ctx.beginPath();
      ctx.arc(x, 6, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (p.pattern === 'glow') {
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 3;
    ctx.strokeRect(-28, -10, 56, 24);
  }
  ctx.restore();

  // Accessories
  if (p.accessory === 'flags') {
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.lineTo(-20, -32);
    ctx.stroke();
    ctx.fillStyle = p.accentColor;
    ctx.beginPath();
    ctx.moveTo(-20, -32);
    ctx.lineTo(-2, -26);
    ctx.lineTo(-20, -20);
    ctx.closePath();
    ctx.fill();
  } else if (p.accessory === 'wings') {
    ctx.fillStyle = p.accentColor;
    ctx.beginPath();
    ctx.moveTo(-18, -4);
    ctx.lineTo(-38, -24);
    ctx.lineTo(-26, 6);
    ctx.closePath();
    ctx.fill();
  } else if (p.accessory === 'horns') {
    ctx.fillStyle = p.accentColor;
    ctx.beginPath();
    ctx.moveTo(14, -8);
    ctx.lineTo(26, -25);
    ctx.lineTo(22, -5);
    ctx.closePath();
    ctx.fill();
  } else if (p.accessory === 'antenna') {
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-14, -8);
    ctx.lineTo(-14, -27);
    ctx.stroke();
    ctx.fillStyle = p.visorColor;
    ctx.beginPath();
    ctx.arc(-14, -29, 3.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.accessory === 'ribbons') {
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-26, -2);
    ctx.quadraticCurveTo(-38, -10, -44, -2);
    ctx.stroke();
  } else if (p.accessory === 'armor') {
    ctx.fillStyle = p.accentColor;
    ctx.strokeStyle = p.secondaryColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(14, -8, 16, 18, 4);
    ctx.fill();
    ctx.stroke();
  } else if (p.accessory === 'crown') {
    ctx.fillStyle = '#FBBF24';
    ctx.beginPath();
    ctx.moveTo(-9, -15);
    ctx.lineTo(-6, -27);
    ctx.lineTo(0, -20);
    ctx.lineTo(6, -27);
    ctx.lineTo(9, -15);
    ctx.closePath();
    ctx.fill();
  }

  // Wheel / Track accents
  if (p.bodyStyle === 'monowheel') {
    ctx.strokeStyle = p.accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 2, 16, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const wheelPositions = p.bodyStyle === 'crawler' ? [-22, 0, 22] : [-20, 20];
    for (const wx of wheelPositions) {
      ctx.fillStyle = p.secondaryColor;
      ctx.strokeStyle = p.accentColor;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(wx, 15, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.visorColor;
      ctx.beginPath();
      ctx.arc(wx, 15, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  spriteCache.set(skin.id, canvas);
  return canvas;
}

export function drawVehicleSkinSprite(
  ctx: CanvasRenderingContext2D,
  skin: SkinItem,
  x: number,
  y: number,
  angle: number,
  facing: 1 | -1,
  timeMs: number
): void {
  const sprite = getSkinSpriteCanvas(skin);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  if (facing < 0) {
    ctx.scale(-1, 1);
  }

  if (skin.rarity === 'Legendary') {
    const pulse = 0.22 + 0.14 * Math.sin(timeMs * 0.006);
    ctx.fillStyle = skin.renderParams.accentColor;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.ellipse(0, 0, 48, 28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.drawImage(sprite, -64, -56);
  ctx.restore();
}
