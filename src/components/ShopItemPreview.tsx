import React, { useEffect, useRef } from 'react';
import type { AnyShopItem, SkinItem } from '../data/shopTypes.ts';
import { getSkinSpriteCanvas } from '../utils/skinRenderer.ts';

const SkinCanvasPreview: React.FC<{ item: SkinItem; heightCls: string }> = ({ item, heightCls }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const sprite = getSkinSpriteCanvas(item);
    ctx.clearRect(0, 0, c.width, c.height);
    if (item.rarity === 'Legendary') {
      ctx.fillStyle = item.renderParams.accentColor;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.ellipse(c.width / 2, c.height / 2 + 4, 46, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(sprite, (c.width - sprite.width) / 2, (c.height - sprite.height) / 2);
  }, [item]);

  return (
    <div className={`w-full ${heightCls} rounded-xl bg-[#161412] border border-white/10 flex items-center justify-center overflow-hidden`}>
      <canvas ref={canvasRef} width={144} height={96} className="h-full w-auto" />
    </div>
  );
};

interface ShopItemPreviewProps {
  item: AnyShopItem;
  size?: 'sm' | 'lg';
}

export const ShopItemPreview: React.FC<ShopItemPreviewProps> = ({ item, size = 'sm' }) => {
  const heightCls = size === 'lg' ? 'h-28' : 'h-20';

  if (item.category === 'skins') {
    return <SkinCanvasPreview item={item} heightCls={heightCls} />;
  }

  if (item.category === 'weapons') {
    const p = item.renderParams;
    return (
      <div className={`w-full ${heightCls} rounded-xl bg-[#161412] border border-white/10 flex items-center justify-center overflow-hidden`}>
        <svg viewBox="0 0 120 72" className="w-full h-full">
          <rect width="120" height="72" fill="#161412" />
          {p.glow && <circle cx="88" cy="36" r="18" fill={p.accentColor} opacity="0.22" />}
          <line x1="16" y1="36" x2="78" y2="36" stroke={p.shaftColor} strokeWidth="5" strokeLinecap="round" />
          <rect x="24" y="29" width="6" height="14" rx="2" fill={p.accentColor} />
          {p.archetype === 'hammer' ? (
            <rect x="74" y="18" width="22" height="36" rx="4" fill={p.headColor} stroke={p.accentColor} strokeWidth="2.5" />
          ) : p.archetype === 'shield' ? (
            <path d="M74 16 L96 22 L96 50 L74 56 Z" fill={p.headColor} stroke={p.accentColor} strokeWidth="2.5" />
          ) : p.archetype === 'blade' ? (
            <polygon points="72,30 108,26 100,44 72,42" fill={p.headColor} stroke={p.accentColor} strokeWidth="2" />
          ) : (
            <polygon points="72,26 108,36 72,46" fill={p.headColor} stroke={p.accentColor} strokeWidth="2" />
          )}
        </svg>
      </div>
    );
  }

  if (item.category === 'backgrounds') {
    const p = item.renderParams;
    return (
      <div className={`w-full ${heightCls} rounded-xl border border-white/10 overflow-hidden`}>
        <svg viewBox="0 0 120 72" className="w-full h-full">
          <defs>
            <linearGradient id={`bg_${item.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={p.skyTop} />
              <stop offset="100%" stopColor={p.skyBottom} />
            </linearGradient>
          </defs>
          <rect width="120" height="72" fill={`url(#bg_${item.id})`} />
          <circle cx="92" cy="18" r="8" fill={p.accentColor} opacity="0.85" />
          <path d="M0 50 Q30 34 62 48 T120 44 L120 72 L0 72 Z" fill={p.hillFar} />
          <path d="M0 58 Q40 44 82 58 T120 54 L120 72 L0 72 Z" fill={p.hillNear} />
        </svg>
      </div>
    );
  }

  if (item.category === 'themes') {
    const p = item.renderParams;
    return (
      <div
        className={`w-full ${heightCls} rounded-xl p-2.5 flex flex-col justify-between`}
        style={{ backgroundColor: p.bgPrimary, border: `1px solid ${p.borderColor}` }}
      >
        <div className="flex items-center justify-between">
          <div className="w-12 h-2.5 rounded" style={{ backgroundColor: p.textPrimary, opacity: 0.9 }} />
          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: p.accentPrimary }} />
        </div>
        <div className="rounded-lg p-2 flex items-center justify-between" style={{ backgroundColor: p.bgSurface }}>
          <div className="w-14 h-2 rounded" style={{ backgroundColor: p.textMuted, opacity: 0.7 }} />
          <div className="w-10 h-4 rounded" style={{ backgroundColor: p.accentSecondary }} />
        </div>
      </div>
    );
  }

  // Trails
  const tp = item.renderParams;
  return (
    <div className={`w-full ${heightCls} rounded-xl bg-[#161412] border border-white/10 flex items-center justify-center overflow-hidden`}>
      <svg viewBox="0 0 120 72" className="w-full h-full">
        <rect width="120" height="72" fill="#161412" />
        <circle cx="24" cy="40" r="3" fill={tp.secondaryColor} opacity="0.4" />
        <circle cx="40" cy="36" r="4.5" fill={tp.primaryColor} opacity="0.6" />
        <circle cx="58" cy="38" r="5.5" fill={tp.secondaryColor} opacity="0.75" />
        <circle cx="76" cy="35" r="7" fill={tp.primaryColor} opacity="0.9" />
        <circle cx="96" cy="36" r="11" fill="none" stroke={tp.hitRingColor} strokeWidth="2.5" />
        <circle cx="96" cy="36" r="4" fill={tp.primaryColor} />
      </svg>
    </div>
  );
};
