import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, Eraser, RotateCcw, Sparkles } from 'lucide-react';
import { COSMETIC_CATALOG } from '../data/gameCatalog.ts';
import type { DrawnBlueprint, Point2D } from '../types/game.ts';
import { forgeAudio } from '../utils/audio.ts';
import {
  compileDrawnBlueprint,
  getPresetStrokes,
  MAX_INK_LENGTH,
  measureStrokesLength,
  type PresetKind,
} from '../utils/shapeCompiler.ts';

interface DrawingPadProps {
  roundIndex: number;
  remainingMs: number;
  inkStyleId: string;
  submitted: boolean;
  onSubmit: (blueprint: DrawnBlueprint) => void;
}

export const DrawingPad: React.FC<DrawingPadProps> = ({
  roundIndex,
  remainingMs,
  inkStyleId,
  submitted,
  onSubmit,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [strokes, setStrokes] = useState<Point2D[][]>([]);
  const activeStrokeRef = useRef<Point2D[] | null>(null);
  const autoSubmittedRef = useRef(false);

  const inkStyle = useMemo(
    () => COSMETIC_CATALOG.find((c) => c.id === inkStyleId) ?? COSMETIC_CATALOG[0],
    [inkStyleId]
  );

  const totalLen = useMemo(() => measureStrokesLength(strokes), [strokes]);
  const inkPercent = Math.max(0, Math.round((1 - totalLen / MAX_INK_LENGTH) * 100));
  const previewStats = useMemo(() => compileDrawnBlueprint(strokes).stats, [strokes]);

  const handleLockIn = useCallback(() => {
    if (submitted) return;
    forgeAudio.playForgeClang();
    const compiled = compileDrawnBlueprint(strokes.length > 0 ? strokes : getPresetStrokes('wheel'));
    onSubmit(compiled);
  }, [onSubmit, strokes, submitted]);

  // Auto-submit when 15s timer nears 0
  useEffect(() => {
    if (!submitted && remainingMs <= 180 && !autoSubmittedRef.current) {
      autoSubmittedRef.current = true;
      handleLockIn();
    }
  }, [remainingMs, submitted, handleLockIn]);

  // Render drafting strokes + rider mount guide onto pad canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(240, Math.round(rect.width));
    const h = Math.max(160, Math.round(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Drafting parchment surface
    ctx.fillStyle = '#EFE7D6';
    ctx.fillRect(0, 0, w, h);

    // Subtle blueprint grid
    ctx.strokeStyle = 'rgba(62, 48, 36, 0.09)';
    ctx.lineWidth = 1;
    const step = 28;
    for (let x = step; x < w; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = step; y < h; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Center chassis guide silhouette
    ctx.strokeStyle = 'rgba(217, 155, 38, 0.35)';
    ctx.setLineDash([5, 5]);
    ctx.strokeRect(w * 0.16, h * 0.22, w * 0.68, h * 0.58);
    ctx.setLineDash([]);

    // Ground baseline
    ctx.strokeStyle = 'rgba(43, 36, 30, 0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.8);
    ctx.lineTo(w * 0.9, h * 0.8);
    ctx.stroke();

    // Draw player ink strokes
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = inkStyle.color;
    ctx.lineWidth = 10;
    if (inkStyle.glowColor) {
      ctx.shadowColor = inkStyle.glowColor;
      ctx.shadowBlur = 10;
    }

    for (const stroke of strokes) {
      if (stroke.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke[0].x * w, stroke[0].y * h);
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x * w, stroke[i].y * h);
      }
      ctx.stroke();
    }
    ctx.shadowBlur = 0;

    // Highlight detected spike tips in molten orange
    if (strokes.length > 0) {
      const compiled = compileDrawnBlueprint(strokes);
      for (const tip of compiled.stats.spikeTips) {
        const tx = (compiled.centroid.x + tip.x) * w;
        const ty = (compiled.centroid.y + tip.y) * h;
        ctx.fillStyle = '#E85D2A';
        ctx.beginPath();
        ctx.arc(tx, ty, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [strokes, inkStyle]);

  const toNormalized = (e: React.PointerEvent<HTMLCanvasElement>): Point2D => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0.08, Math.min(0.92, (e.clientY - rect.top) / rect.height)),
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (submitted || totalLen >= MAX_INK_LENGTH) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = toNormalized(e);
    const nextStroke = [pt];
    activeStrokeRef.current = nextStroke;
    setStrokes((prev) => [...prev, nextStroke]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (submitted || !activeStrokeRef.current) return;
    const pt = toNormalized(e);
    const curr = activeStrokeRef.current;
    const last = curr[curr.length - 1];
    const segLen = Math.hypot(pt.x - last.x, pt.y - last.y);
    if (segLen < 0.012) return;
    if (totalLen + segLen > MAX_INK_LENGTH) return;

    curr.push(pt);
    forgeAudio.playInkTick();
    setStrokes((prev) => [...prev.slice(0, -1), [...curr]]);
  };

  const handlePointerUp = () => {
    activeStrokeRef.current = null;
  };

  const applyPreset = (kind: PresetKind) => {
    if (submitted) return;
    forgeAudio.playUiClick();
    setStrokes(getPresetStrokes(kind));
  };

  const secLeft = Math.max(0, Math.ceil(remainingMs / 1000));
  const timerPct = Math.max(0, Math.min(100, (remainingMs / 15_000) * 100));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#161412]/85 p-3 sm:p-5">
      <div className="w-full max-w-2xl rounded-2xl bg-[#221E1B] border border-[#D99B26]/30 p-3.5 sm:p-5 flex flex-col gap-3 max-h-[96vh]">
        {/* Header: Round + Timer + Ink */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-[#D99B26]">Round {roundIndex} · Draft Your Rig</p>
            <h2 className="font-display text-lg sm:text-xl font-extrabold text-[#F5EFE6]">
              Sketch Your Weapon &amp; Chassis
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-[11px] text-[#C7BEB2]">Ink Left</span>
              <div className="flex items-center gap-2">
                <div className="w-20 h-2 rounded-full bg-[#161412] overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-[#D99B26] transition-[width] duration-75"
                    style={{ width: `${inkPercent}%` }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums font-bold text-[#F5EFE6]">
                  {inkPercent}%
                </span>
              </div>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-[#161412] border border-[#E85D2A]/40 text-center min-w-[60px]">
              <span className={`font-mono tabular-nums text-base font-bold ${secLeft <= 4 ? 'text-[#E85D2A]' : 'text-[#F5EFE6]'}`}>
                {secLeft}s
              </span>
            </div>
          </div>
        </div>

        {/* Countdown bar */}
        <div className="w-full h-1.5 rounded-full bg-[#161412] overflow-hidden">
          <div
            className="h-full bg-[#E85D2A] transition-[width] duration-100"
            style={{ width: `${timerPct}%` }}
          />
        </div>

        {/* Interactive Sketch Canvas */}
        <div className="relative w-full h-48 sm:h-64 rounded-xl overflow-hidden border-2 border-[#D99B26]/40 shadow-inner">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="w-full h-full block touch-none cursor-crosshair"
          />
          {strokes.length === 0 && !submitted && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-4">
              <p className="font-display text-base sm:text-lg font-bold text-[#2B241E]/75">
                Drag with finger or mouse to draw
              </p>
              <p className="text-xs text-[#2B241E]/60 mt-1">
                Round shapes roll fast · Sharp corners forge deadly spikes · Big builds hit heavier
              </p>
            </div>
          )}
          {submitted && (
            <div className="absolute inset-0 bg-[#161412]/70 flex items-center justify-center">
              <div className="px-4 py-2.5 rounded-xl bg-[#221E1B] border border-[#10B981]/50 flex items-center gap-2 text-sm font-semibold text-[#10B981]">
                <Check className="w-4 h-4" />
                <span>Blueprint Forged · Waiting for opponent...</span>
              </div>
            </div>
          )}
        </div>

        {/* Live Shape Physics Readout */}
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-lg bg-[#161412] px-2 py-2 border border-white/5">
            <div className="text-[11px] text-[#C7BEB2]">Mass</div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#F5EFE6]">
              {previewStats.mass.toFixed(1)}t
            </div>
          </div>
          <div className="rounded-lg bg-[#161412] px-2 py-2 border border-white/5">
            <div className="text-[11px] text-[#C7BEB2]">Speed</div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#38BDF8]">
              {previewStats.speedRating}/10
            </div>
          </div>
          <div className="rounded-lg bg-[#161412] px-2 py-2 border border-white/5">
            <div className="text-[11px] text-[#C7BEB2]">Spikes</div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#E85D2A]">
              {previewStats.spikePower}/10
            </div>
          </div>
          <div className="rounded-lg bg-[#161412] px-2 py-2 border border-white/5">
            <div className="text-[11px] text-[#C7BEB2]">Hull HP</div>
            <div className="font-mono tabular-nums text-sm font-bold text-[#10B981]">
              {previewStats.armorHp}
            </div>
          </div>
        </div>

        {/* Presets + Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-[#C7BEB2] mr-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-[#D99B26]" />
              Templates:
            </span>
            {(['wheel', 'wedge', 'sled', 'spiker'] as PresetKind[]).map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={submitted}
                onClick={() => applyPreset(preset)}
                className="min-h-[38px] px-2.5 rounded-lg bg-[#2C2621] hover:bg-[#38312B] disabled:opacity-40 text-xs font-medium text-[#F5EFE6] capitalize cursor-pointer"
              >
                {preset}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              disabled={submitted || strokes.length === 0}
              onClick={() => {
                forgeAudio.playUiClick();
                setStrokes((s) => s.slice(0, -1));
              }}
              className="min-h-[44px] px-3 rounded-lg bg-[#2C2621] hover:bg-[#38312B] disabled:opacity-40 text-xs font-semibold text-[#F5EFE6] flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Undo</span>
            </button>
            <button
              type="button"
              disabled={submitted || strokes.length === 0}
              onClick={() => {
                forgeAudio.playUiClick();
                setStrokes([]);
              }}
              className="min-h-[44px] px-3 rounded-lg bg-[#2C2621] hover:bg-[#38312B] disabled:opacity-40 text-xs font-semibold text-[#F5EFE6] flex items-center gap-1.5 cursor-pointer"
            >
              <Eraser className="w-4 h-4" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              disabled={submitted}
              onClick={handleLockIn}
              className="min-h-[44px] px-5 rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] disabled:opacity-50 text-sm font-bold text-white flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Check className="w-4 h-4" />
              <span>Forge &amp; Fight</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
