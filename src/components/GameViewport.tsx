import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Crosshair,
  Flame,
  LogOut,
  Pause,
  Sliders,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { getBackgroundById } from '../data/backgrounds.ts';
import { ARENAS, COSMETIC_CATALOG, RIDER_CATALOG, ROOM_WEAPONS } from '../data/gameCatalog.ts';
import type { WeaponItem } from '../data/shopTypes.ts';
import { getSkinById } from '../data/skins.ts';
import { getThemeById } from '../data/themes.ts';
import { getTrailById } from '../data/trails.ts';
import { getWeaponById } from '../data/weapons.ts';
import type { InputManager } from '../engine/inputManager.ts';
import type {
  ControlSettings,
  DrawnBlueprint,
  MatchSnapshot,
  VehicleSnapshot,
  VisualEffectEvent,
} from '../types/game.ts';
import { forgeAudio } from '../utils/audio.ts';
import { drawProceduralBackground } from '../utils/backgroundRenderer.ts';
import {
  detectDeviceProfile,
  resolveActiveControlScheme,
  subscribeDeviceProfile,
  type DeviceProfile,
} from '../utils/deviceProfile.ts';
import { drawVehicleSkinSprite } from '../utils/skinRenderer.ts';
import { ControlsSettingsModal } from './ControlsSettingsModal.tsx';
import { DrawingPad } from './DrawingPad.tsx';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  shape?: 'circle' | 'square' | 'star';
}

interface FxRing {
  kind: VisualEffectEvent['kind'];
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  color: string;
  life: number;
  maxLife: number;
  label?: string;
}

interface GameViewportProps {
  localPlayerId: string;
  snapshot: MatchSnapshot;
  inputManager: InputManager;
  fxQueueRef: React.MutableRefObject<VisualEffectEvent[]>;
  muted: boolean;
  hasSeenHowToPlay: boolean;
  controlSettings: ControlSettings;
  onUpdateControlSettings: (next: ControlSettings) => void;
  onDismissHowToPlay: () => void;
  onToggleMute: () => void;
  onSubmitDrawing: (blueprint: DrawnBlueprint) => void;
  onExitMatch: () => void;
  onSoloPauseChange?: (paused: boolean) => void;
}

function drawClockworkRider(
  ctx: CanvasRenderingContext2D,
  v: VehicleSnapshot,
  riderColor: string,
  accentColor: string,
  visorColor: string,
  weapon: WeaponItem
) {
  ctx.save();
  ctx.translate(v.riderX, v.riderY);
  ctx.rotate(v.riderAngle);

  // Rider body silhouette
  ctx.fillStyle = riderColor;
  ctx.strokeStyle = '#161412';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(0, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Brass gear shoulder trim
  ctx.fillStyle = accentColor;
  ctx.beginPath();
  ctx.arc(0, 5, 9, 0, Math.PI);
  ctx.fill();

  // Clockwork goggle visor facing opponent
  ctx.fillStyle = visorColor;
  ctx.beginPath();
  ctx.arc(v.facing * 6, -3, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#161412';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Subtle head hitbox outline + bright flash on head hit
  const headFlashing = (v.headFlashMs ?? 0) > 0;
  if (headFlashing) {
    ctx.fillStyle = 'rgba(239, 68, 68, 0.55)';
    ctx.beginPath();
    ctx.arc(0, -2, v.headRadius ?? 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  } else {
    ctx.strokeStyle = 'rgba(245, 239, 230, 0.14)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, -2, v.headRadius ?? 22, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Equipped Weapon rotated by v.lanceAngle
  const wp = weapon.renderParams;
  const reach = 42 * wp.lengthScale;
  const tipX = 58 * wp.lengthScale;
  const hs = wp.headScale;

  ctx.save();
  const pitch = v.facing === 1 ? v.lanceAngle + v.angle * 0.25 : -v.lanceAngle + v.angle * 0.25;
  ctx.rotate(pitch);

  if (wp.glow) {
    ctx.fillStyle = wp.accentColor;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(v.facing * (reach + 8), 0, 16 * hs, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.strokeStyle = wp.shaftColor;
  ctx.lineWidth = 4.2;
  ctx.beginPath();
  ctx.moveTo(-v.facing * 12, 2);
  ctx.lineTo(v.facing * reach, -1);
  ctx.stroke();

  ctx.fillStyle = wp.headColor;
  ctx.strokeStyle = '#161412';
  ctx.lineWidth = 1.5;

  if (wp.archetype === 'hammer') {
    const hw = 13 * hs;
    const hh = 22 * hs;
    ctx.beginPath();
    ctx.roundRect(v.facing * (reach - 4) - (v.facing < 0 ? hw : 0), -hh / 2, hw, hh, 3);
    ctx.fill();
    ctx.stroke();
  } else if (wp.archetype === 'shield') {
    const sh = 24 * hs;
    ctx.beginPath();
    ctx.roundRect(v.facing * (reach - 6) - (v.facing < 0 ? 12 : 0), -sh / 2, 12, sh, 4);
    ctx.fill();
    ctx.stroke();
  } else if (wp.archetype === 'blade') {
    ctx.beginPath();
    ctx.moveTo(v.facing * (reach - 4), -4 * hs);
    ctx.lineTo(v.facing * tipX, -7 * hs);
    ctx.lineTo(v.facing * (tipX - 6), 5 * hs);
    ctx.lineTo(v.facing * (reach - 4), 4 * hs);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // lance or spear
    const halfW = (wp.archetype === 'spear' ? 4.8 : 6.2) * hs;
    ctx.beginPath();
    ctx.moveTo(v.facing * tipX, -1.5);
    ctx.lineTo(v.facing * (reach - 4), -halfW);
    ctx.lineTo(v.facing * (reach - 4), halfW);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Hilt guard accent
  ctx.fillStyle = wp.accentColor;
  ctx.fillRect(v.facing * 12 - 2.5, -5, 5, 10);

  ctx.restore();
  ctx.restore();
}

export const GameViewport: React.FC<GameViewportProps> = ({
  localPlayerId,
  snapshot,
  inputManager,
  fxQueueRef,
  muted,
  hasSeenHowToPlay,
  controlSettings,
  onUpdateControlSettings,
  onDismissHowToPlay,
  onToggleMute,
  onSubmitDrawing,
  onExitMatch,
  onSoloPauseChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const snapshotRef = useRef<MatchSnapshot>(snapshot);
  snapshotRef.current = snapshot;

  const particlesRef = useRef<Particle[]>([]);
  const ringsRef = useRef<FxRing[]>([]);
  const shakeRef = useRef<number>(0);
  const hitstopMsRef = useRef<number>(0);
  const interpRef = useRef<
    Map<string, { x: number; y: number; angle: number; riderX: number; riderY: number; riderAngle: number }>
  >(new Map());

  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [submittedRound, setSubmittedRound] = useState<number>(0);
  const [deviceProfile, setDeviceProfile] = useState<DeviceProfile>(() => detectDeviceProfile());

  const showHowToPlayOverlay =
    !hasSeenHowToPlay &&
    snapshot.phase !== 'MATCH_OVER' &&
    (snapshot.mode === 'solo' || snapshot.phase === 'FIGHTING');

  const uiBlockingFight = paused || showSettings || showHowToPlayOverlay;
  const uiBlockingFightRef = useRef<boolean>(uiBlockingFight);
  uiBlockingFightRef.current = uiBlockingFight;

  useEffect(() => {
    onSoloPauseChange?.(paused || showSettings || (!hasSeenHowToPlay && snapshot.mode === 'solo'));
    if (paused || showSettings) {
      inputManager.clearAll();
    }
  }, [paused, showSettings, hasSeenHowToPlay, snapshot.mode, onSoloPauseChange, inputManager]);

  // Sync sensitivity to InputManager without touching render loop
  useEffect(() => {
    inputManager.setSensitivity(controlSettings.sensitivity);
  }, [inputManager, controlSettings.sensitivity]);

  // Auto-detect DeviceProfile (mobile vs desktop, resize, orientation, hybrid auto-switch)
  useEffect(() => {
    return subscribeDeviceProfile((next) => setDeviceProfile(next));
  }, []);

  // Reset submitted state when a new round starts drawing
  useEffect(() => {
    if (snapshot.phase === 'DRAWING' && submittedRound !== snapshot.roundIndex) {
      setSubmittedRound(0);
      inputManager.clearAll();
    }
  }, [snapshot.phase, snapshot.roundIndex, submittedRound, inputManager]);

  // Persistent Keyboard + Blur listeners (mounted once, reads snapshotRef so never torn down!)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        setPaused((p) => !p);
        return;
      }
      if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
      }
      if (snapshotRef.current.phase !== 'FIGHTING' || uiBlockingFightRef.current) return;
      const handled = inputManager.handleKeyDown(e);
      if (handled && e.code === 'Space' && !e.repeat) {
        forgeAudio.playBoostWhoosh();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      inputManager.handleKeyUp(e);
    };

    const onBlur = () => {
      inputManager.clearAll();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      inputManager.clearAll();
    };
  }, [inputManager]);

  // Isolated 60 FPS Canvas Rendering Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    let boostParticleAcc = 0;

    const spawnParticles = (
      x: number,
      y: number,
      color: string,
      count: number,
      speed = 5,
      shape: Particle['shape'] = 'circle'
    ) => {
      for (let i = 0; i < count && particlesRef.current.length < 220; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = (0.4 + Math.random() * 0.9) * speed;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - 1.5,
          life: 0.45 + Math.random() * 0.3,
          maxLife: 0.75,
          size: 2.5 + Math.random() * 4,
          color,
          shape,
        });
      }
    };

    const renderFrame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);
      boostParticleAcc += dt;

      // Process incoming FX events
      while (fxQueueRef.current.length > 0) {
        const ev = fxQueueRef.current.shift()!;
        ringsRef.current.push({
          kind: ev.kind,
          x: ev.x,
          y: ev.y,
          targetX: ev.targetX,
          targetY: ev.targetY,
          color: ev.color,
          life: 0.42,
          maxLife: 0.42,
          label: ev.label,
        });
        spawnParticles(
          ev.x,
          ev.y,
          ev.color,
          ev.kind === 'ko' ? 28 : ev.kind === 'head_hit' ? 22 : 12,
          ev.kind === 'ko' ? 7 : ev.kind === 'head_hit' ? 6.5 : 4.5
        );
        shakeRef.current = Math.min(20, shakeRef.current + ev.intensity * 7);
        if (ev.kind === 'head_hit' && (ev.damage ?? 0) >= 26) {
          hitstopMsRef.current = 65;
        } else if (ev.intensity >= 1.2) {
          hitstopMsRef.current = 42;
        }
        if (ev.kind === 'head_hit') {
          forgeAudio.playHeadHit(ev.intensity);
        } else if (ev.kind === 'pickup_spawn') {
          forgeAudio.playPickupSpawn();
        } else if (ev.kind === 'heal') {
          forgeAudio.playHealPickup();
        } else if (ev.kind === 'impact' || ev.kind === 'ko') {
          forgeAudio.playImpact(ev.intensity);
        } else {
          forgeAudio.playWeaponFx(ev.kind);
        }
      }

      if (hitstopMsRef.current > 0) {
        hitstopMsRef.current = Math.max(0, hitstopMsRef.current - dt * 1000);
      }
      shakeRef.current = Math.max(0, shakeRef.current - dt * 36);

      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const rect = canvas.getBoundingClientRect();
        const w = Math.max(320, Math.round(rect.width));
        const h = Math.max(240, Math.round(rect.height));
        if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
          canvas.width = w * dpr;
          canvas.height = h * dpr;
        }

        const ctx = canvas.getContext('2d');
        if (ctx) {
          const snap = snapshotRef.current;
          const arena = ARENAS.find((a) => a.id === snap.arenaId) ?? ARENAS[0];
          const localSnapVehicle = snap.vehicles.find((v) => v.playerId === localPlayerId);
          const equippedBg = getBackgroundById(localSnapVehicle?.cosmetics.backgroundId);
          const equippedTheme = getThemeById(localSnapVehicle?.cosmetics.themeId);

          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

          let focusX = 0;
          let focusY = 120;
          const living = snap.vehicles.filter((v) => !v.eliminated);
          if (living.length > 0) {
            focusX = living.reduce((s, v) => s + v.x, 0) / living.length;
            focusY = living.reduce((s, v) => s + v.y, 0) / living.length;
          }

          // Procedural Parallax Background + Active Theme Arena Tint
          drawProceduralBackground(ctx, equippedBg, w, h, focusX, now);
          if (equippedTheme.renderParams.arenaTint) {
            ctx.fillStyle = equippedTheme.renderParams.arenaTint;
            ctx.fillRect(0, 0, w, h);
          }

          const baseScale = Math.min(w / 1060, h / 580);
          const scale = Math.max(0.32, Math.min(1.15, baseScale));

          const shakeX = (Math.random() - 0.5) * shakeRef.current;
          const shakeY = (Math.random() - 0.5) * shakeRef.current;

          ctx.save();
          ctx.translate(w / 2 + shakeX, h * 0.52 + shakeY);
          ctx.scale(scale, scale);
          ctx.translate(-focusX * 0.38, -Math.min(180, Math.max(60, focusY)) * 0.18 - 60);

          // Blueprint Grid
          ctx.strokeStyle = arena.gridTint;
          ctx.lineWidth = 1.5;
          for (let gx = -900; gx <= 900; gx += 60) {
            ctx.beginPath();
            ctx.moveTo(gx, -420);
            ctx.lineTo(gx, 620);
            ctx.stroke();
          }
          for (let gy = -420; gy <= 600; gy += 60) {
            ctx.beginPath();
            ctx.moveTo(-900, gy);
            ctx.lineTo(900, gy);
            ctx.stroke();
          }

          // Ring-out pit warning glow
          const pitGrad = ctx.createLinearGradient(0, arena.fallY - 120, 0, arena.fallY + 80);
          pitGrad.addColorStop(0, 'rgba(232, 93, 42, 0)');
          pitGrad.addColorStop(1, 'rgba(232, 93, 42, 0.25)');
          ctx.fillStyle = pitGrad;
          ctx.fillRect(-1000, arena.fallY - 120, 2000, 220);

          // Draw Arena Platforms & Rails
          for (const plat of arena.platforms) {
            ctx.save();
            ctx.translate(plat.x, plat.y);
            ctx.rotate(plat.angle ?? 0);
            ctx.fillStyle = plat.isBouncePad
              ? '#10B981'
              : plat.isBumper
              ? '#D99B26'
              : arena.railColor;
            ctx.strokeStyle = '#161412';
            ctx.lineWidth = 3;
            ctx.fillRect(-plat.width / 2, -plat.height / 2, plat.width, plat.height);
            ctx.strokeRect(-plat.width / 2, -plat.height / 2, plat.width, plat.height);

            if (!plat.isBouncePad) {
              ctx.fillStyle = '#D99B26';
              for (let rx = -plat.width / 2 + 18; rx < plat.width / 2 - 12; rx += 46) {
                ctx.beginPath();
                ctx.arc(rx, 0, 3, 0, Math.PI * 2);
                ctx.fill();
              }
            }
            ctx.restore();
          }

          const emitBoostTrail = boostParticleAcc >= 0.04;
          if (emitBoostTrail) boostParticleAcc = 0;

          // Interpolate & Draw Vehicles + Riders
          for (const v of snap.vehicles) {
            const prev = interpRef.current.get(v.playerId) ?? {
              x: v.x,
              y: v.y,
              angle: v.angle,
              riderX: v.riderX,
              riderY: v.riderY,
              riderAngle: v.riderAngle,
            };
            const lerpAlpha = hitstopMsRef.current > 0 ? 0.05 : Math.min(1, dt * 18);
            const cur = {
              x: prev.x + (v.x - prev.x) * lerpAlpha,
              y: prev.y + (v.y - prev.y) * lerpAlpha,
              angle: prev.angle + Math.atan2(Math.sin(v.angle - prev.angle), Math.cos(v.angle - prev.angle)) * lerpAlpha,
              riderX: prev.riderX + (v.riderX - prev.riderX) * lerpAlpha,
              riderY: prev.riderY + (v.riderY - prev.riderY) * lerpAlpha,
              riderAngle: prev.riderAngle + (v.riderAngle - prev.riderAngle) * lerpAlpha,
            };
            interpRef.current.set(v.playerId, cur);

            // Boost trail customized per player!
            const trailDef = getTrailById(v.cosmetics.trailId);
            if (emitBoostTrail && v.boosting && !v.eliminated) {
              const tp = trailDef.renderParams;
              const pColor =
                tp.style === 'rainbow'
                  ? `hsl(${Math.round((now * 0.25) % 360)}, 85%, 62%)`
                  : tp.primaryColor;
              const sColor =
                tp.style === 'rainbow'
                  ? `hsl(${Math.round((now * 0.25 + 120) % 360)}, 85%, 62%)`
                  : tp.secondaryColor;
              const pShape: Particle['shape'] =
                tp.style === 'pixel' || tp.style === 'confetti'
                  ? 'square'
                  : tp.style === 'stars'
                  ? 'star'
                  : 'circle';
              spawnParticles(
                cur.x - v.facing * 32,
                cur.y + 18,
                pColor,
                Math.max(1, Math.round(2 * tp.density)),
                tp.particleSize,
                pShape
              );
              spawnParticles(cur.x - v.facing * 26, cur.y + 22, sColor, 1, tp.particleSize * 0.75, pShape);
            }

            const riderDef = RIDER_CATALOG.find((r) => r.id === v.cosmetics.riderId) ?? RIDER_CATALOG[0];
            const inkDef = COSMETIC_CATALOG.find((c) => c.id === v.cosmetics.inkStyleId) ?? COSMETIC_CATALOG[0];
            const wheelDef = COSMETIC_CATALOG.find((c) => c.id === v.cosmetics.wheelFinishId) ?? COSMETIC_CATALOG[8];
            const skinDef = getSkinById(v.cosmetics.skinId);
            const weaponDef = getWeaponById(v.cosmetics.weaponId);

            // Pre-rendered cached Skin sprite
            drawVehicleSkinSprite(ctx, skinDef, cur.x, cur.y, cur.angle, v.facing, now);

            ctx.save();
            ctx.translate(cur.x, cur.y);
            ctx.rotate(cur.angle);

            const scaleW = 128;
            const scaleH = 104;
            if (v.blueprint) {
              ctx.lineCap = 'round';
              ctx.lineJoin = 'round';
              ctx.strokeStyle = wheelDef.color;
              ctx.lineWidth = 10;
              for (const stroke of v.blueprint.strokes) {
                if (stroke.length < 2) continue;
                ctx.beginPath();
                ctx.moveTo((stroke[0].x - v.blueprint.centroid.x) * scaleW, (stroke[0].y - v.blueprint.centroid.y) * scaleH);
                for (let i = 1; i < stroke.length; i++) {
                  ctx.lineTo(
                    (stroke[i].x - v.blueprint.centroid.x) * scaleW,
                    (stroke[i].y - v.blueprint.centroid.y) * scaleH
                  );
                }
                ctx.stroke();
              }
              ctx.strokeStyle = inkDef.color;
              ctx.lineWidth = 5;
              for (const stroke of v.blueprint.strokes) {
                if (stroke.length < 2) continue;
                ctx.beginPath();
                ctx.moveTo((stroke[0].x - v.blueprint.centroid.x) * scaleW, (stroke[0].y - v.blueprint.centroid.y) * scaleH);
                for (let i = 1; i < stroke.length; i++) {
                  ctx.lineTo(
                    (stroke[i].x - v.blueprint.centroid.x) * scaleW,
                    (stroke[i].y - v.blueprint.centroid.y) * scaleH
                  );
                }
                ctx.stroke();
              }
              for (const tip of v.blueprint.stats.spikeTips) {
                ctx.fillStyle = '#E85D2A';
                ctx.beginPath();
                ctx.arc(tip.x * scaleW, tip.y * scaleH, 5.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }

            if (v.shieldActiveMs > 0) {
              ctx.strokeStyle = '#10B981';
              ctx.fillStyle = 'rgba(16, 185, 129, 0.16)';
              ctx.lineWidth = 3;
              ctx.beginPath();
              ctx.arc(0, -14, 72, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }

            ctx.restore();

            drawClockworkRider(
              ctx,
              {
                ...v,
                riderX: cur.riderX,
                riderY: cur.riderY,
                riderAngle: cur.riderAngle,
                angle: cur.angle,
              },
              skinDef.renderParams.primaryColor || riderDef.primaryColor,
              skinDef.renderParams.accentColor || riderDef.accentColor,
              skinDef.renderParams.visorColor || riderDef.visorColor,
              weaponDef
            );

            ctx.save();
            ctx.font = '700 12px "Plus Jakarta Sans", sans-serif';
            ctx.textAlign = 'center';
            const tag = v.isBot ? `${v.nickname}` : v.playerId === localPlayerId ? `YOU · ${v.nickname}` : v.nickname;
            ctx.fillStyle = v.playerId === localPlayerId ? '#E85D2A' : '#F5EFE6';
            ctx.strokeStyle = '#161412';
            ctx.lineWidth = 3;
            ctx.strokeText(tag, cur.riderX, cur.riderY - 34);
            ctx.fillText(tag, cur.riderX, cur.riderY - 34);
            ctx.restore();
          }

          // Render Half-Time Health Pickup (parachute drop -> glowing heart capsule + soft light beam)
          if (snap.healthPickup) {
            const pk = snap.healthPickup;
            const fadeAlpha =
              pk.state === 'fading' ? Math.max(0.12, Math.min(1, pk.ttlMs / 1200)) : 1;
            const hoverBob = pk.state === 'landed' ? Math.sin(now * 0.005) * 4 : 0;
            const drawX = pk.x;
            const drawY = pk.y + hoverBob;

            ctx.save();
            ctx.globalAlpha = fadeAlpha;

            // Soft emerald vertical light beam
            const beamGrad = ctx.createLinearGradient(drawX, drawY - 180, drawX, drawY + 60);
            beamGrad.addColorStop(0, 'rgba(16, 185, 129, 0)');
            beamGrad.addColorStop(0.55, 'rgba(16, 185, 129, 0.22)');
            beamGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
            ctx.fillStyle = beamGrad;
            ctx.fillRect(drawX - 24, drawY - 180, 48, 240);

            // Parachute canopy while falling
            if (pk.state === 'falling') {
              const sway = Math.sin(now * 0.004) * 3;
              ctx.strokeStyle = 'rgba(245, 239, 230, 0.7)';
              ctx.lineWidth = 1.5;
              ctx.beginPath();
              ctx.moveTo(drawX - 22 + sway, drawY - 34);
              ctx.lineTo(drawX - 6, drawY - 10);
              ctx.moveTo(drawX + 22 + sway, drawY - 34);
              ctx.lineTo(drawX + 6, drawY - 10);
              ctx.moveTo(drawX + sway, drawY - 38);
              ctx.lineTo(drawX, drawY - 10);
              ctx.stroke();

              ctx.fillStyle = '#F5EFE6';
              ctx.strokeStyle = '#10B981';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.arc(drawX + sway, drawY - 34, 24, Math.PI, 0);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
            }

            // Outer glowing halo
            const pulse = 1 + Math.sin(now * 0.007) * 0.1;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.28)';
            ctx.beginPath();
            ctx.arc(drawX, drawY, 24 * pulse, 0, Math.PI * 2);
            ctx.fill();

            // Health capsule body
            ctx.fillStyle = '#10B981';
            ctx.strokeStyle = '#ECFDF5';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.roundRect(drawX - 15, drawY - 15, 30, 30, 9);
            ctx.fill();
            ctx.stroke();

            // Heart icon inside capsule
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            ctx.moveTo(drawX, drawY + 7);
            ctx.bezierCurveTo(drawX - 11, drawY - 1, drawX - 8, drawY - 10, drawX, drawY - 4);
            ctx.bezierCurveTo(drawX + 8, drawY - 10, drawX + 11, drawY - 1, drawX, drawY + 7);
            ctx.fill();

            ctx.restore();
          }

          // Render Active FX Rings & Lightning Arcs
          for (let i = ringsRef.current.length - 1; i >= 0; i--) {
            const r = ringsRef.current[i];
            r.life -= dt;
            if (r.life <= 0) {
              ringsRef.current.splice(i, 1);
              continue;
            }
            const t = 1 - r.life / r.maxLife;
            ctx.save();
            ctx.globalAlpha = 1 - t;
            if (r.kind === 'thunder' && r.targetX !== undefined && r.targetY !== undefined) {
              ctx.strokeStyle = r.color;
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.moveTo(r.x, r.y);
              ctx.lineTo((r.x + r.targetX) / 2, (r.y + r.targetY) / 2 - 22);
              ctx.lineTo(r.targetX, r.targetY);
              ctx.stroke();
            } else {
              ctx.strokeStyle = r.color;
              ctx.lineWidth = 4;
              ctx.beginPath();
              ctx.arc(r.x, r.y, 18 + t * 120, 0, Math.PI * 2);
              ctx.stroke();
            }
            if (r.label) {
              ctx.font = r.kind === 'head_hit' ? '900 22px "Bricolage Grotesque", sans-serif' : '800 18px "Bricolage Grotesque", sans-serif';
              ctx.lineWidth = 4;
              ctx.strokeStyle = '#161412';
              ctx.textAlign = 'center';
              ctx.strokeText(r.label, r.x, r.y - 26 - t * 38);
              ctx.fillStyle = r.kind === 'head_hit' ? '#FDE047' : r.kind === 'heal' ? '#4ADE80' : '#E85D2A';
              ctx.fillText(r.label, r.x, r.y - 26 - t * 38);
            }
            ctx.restore();
          }

          // Render Particles
          for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            p.life -= dt;
            if (p.life <= 0) {
              particlesRef.current.splice(i, 1);
              continue;
            }
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.22;
            ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
            ctx.fillStyle = p.color;
            if (p.shape === 'square') {
              ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
            } else if (p.shape === 'star') {
              ctx.beginPath();
              for (let k = 0; k < 4; k++) {
                const ang = (k * Math.PI) / 2;
                ctx.lineTo(p.x + Math.cos(ang) * p.size * 1.4, p.y + Math.sin(ang) * p.size * 1.4);
                ctx.lineTo(
                  p.x + Math.cos(ang + Math.PI / 4) * p.size * 0.55,
                  p.y + Math.sin(ang + Math.PI / 4) * p.size * 0.55
                );
              }
              ctx.closePath();
              ctx.fill();
            } else {
              ctx.beginPath();
              ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
              ctx.fill();
            }
          }
          ctx.globalAlpha = 1;

          ctx.restore();

          // Screen-edge indicator arrow while health pickup is falling / off-screen above
          if (snap.healthPickup && snap.healthPickup.state === 'falling') {
            const camFocusX = focusX * 0.38;
            const camFocusY = Math.min(180, Math.max(60, focusY)) * 0.18 + 60;
            const screenX = w / 2 + (snap.healthPickup.x - camFocusX) * scale;
            const screenY = h * 0.52 + (snap.healthPickup.y - camFocusY) * scale;
            if (screenY < 62 || screenX < 28 || screenX > w - 28) {
              const clampedX = Math.max(36, Math.min(w - 36, screenX));
              const clampedY = Math.max(76, Math.min(h - 90, screenY));
              const ang = Math.atan2(screenY - clampedY, screenX - clampedX);
              ctx.save();
              ctx.translate(clampedX, clampedY);
              ctx.rotate(ang);
              ctx.fillStyle = '#10B981';
              ctx.strokeStyle = '#ECFDF5';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(13, 0);
              ctx.lineTo(-9, -8);
              ctx.lineTo(-5, 0);
              ctx.lineTo(-9, 8);
              ctx.closePath();
              ctx.fill();
              ctx.stroke();
              ctx.restore();
            }
          }
        }
      }

      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(rafId);
  }, [fxQueueRef, localPlayerId]);

  const localVehicle = snapshot.vehicles.find((v) => v.playerId === localPlayerId);
  const localWeapon = localVehicle?.weaponId
    ? ROOM_WEAPONS.find((w) => w.id === localVehicle.weaponId)
    : null;
  const weaponCooldownPct =
    localVehicle && localVehicle.weaponMaxCooldownMs > 0
      ? Math.round((localVehicle.weaponCooldownMs / localVehicle.weaponMaxCooldownMs) * 100)
      : 0;

  const activeControlScheme = resolveActiveControlScheme(deviceProfile, controlSettings.touchMode);
  const showTouchControls = activeControlScheme === 'mobile';

  const btnPx =
    controlSettings.controlSize === 'compact'
      ? 72
      : controlSettings.controlSize === 'large'
      ? 92
      : 80;

  const btnStyle: React.CSSProperties = {
    width: `${btnPx}px`,
    height: `${btnPx}px`,
  };

  const jumpCooldownMs = localVehicle?.jumpCooldownMs ?? 0;
  const jumpReadyPct = jumpCooldownMs <= 0 ? 1 : Math.max(0, 1 - jumpCooldownMs / 1200);
  const ringCircumference = 2 * Math.PI * 28;
  const ringDashOffset = ringCircumference * (1 - jumpReadyPct);

  const bindTouchButton = (
    action: 'move_left' | 'move_right' | 'boost' | 'jump' | 'lance_up' | 'lance_down' | 'special'
  ) => ({
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      inputManager.pointerDown(e.pointerId, action);
      if (action === 'boost') forgeAudio.playBoostWhoosh();
    },
    onPointerUp: (e: React.PointerEvent<HTMLButtonElement>) => {
      e.preventDefault();
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      inputManager.pointerUp(e.pointerId);
    },
    onPointerCancel: (e: React.PointerEvent<HTMLButtonElement>) => {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
      inputManager.pointerUp(e.pointerId);
    },
  });

  const moveCluster = (
    <div className="pointer-events-auto flex items-center gap-3">
      <button
        type="button"
        style={btnStyle}
        {...bindTouchButton('move_left')}
        className="rounded-2xl bg-[#161412]/70 active:bg-[#2E2823]/90 border border-[#D99B26]/35 flex flex-col items-center justify-center text-[#F5EFE6] touch-none select-none cursor-pointer"
        aria-label="Move left"
      >
        <ArrowLeft className="w-6 h-6 text-[#D99B26]" />
        <span className="text-[10px] font-bold mt-1 tracking-wide">LEFT</span>
      </button>
      <button
        type="button"
        style={btnStyle}
        {...bindTouchButton('move_right')}
        className="rounded-2xl bg-[#161412]/70 active:bg-[#2E2823]/90 border border-[#D99B26]/35 flex flex-col items-center justify-center text-[#F5EFE6] touch-none select-none cursor-pointer"
        aria-label="Move right"
      >
        <ArrowRight className="w-6 h-6 text-[#D99B26]" />
        <span className="text-[10px] font-bold mt-1 tracking-wide">RIGHT</span>
      </button>
    </div>
  );

  const lanceButtonsCluster = (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button
        type="button"
        style={{ width: `${btnPx}px`, height: `${Math.max(72, Math.round(btnPx * 0.9))}px` }}
        {...bindTouchButton('lance_up')}
        className="rounded-2xl bg-[#161412]/70 active:bg-[#2E2823]/90 border border-[#D99B26]/35 flex flex-col items-center justify-center text-[#F5EFE6] touch-none select-none cursor-pointer"
        aria-label="Aim lance up"
      >
        <ChevronUp className="w-5 h-5 text-[#D99B26]" />
        <span className="text-[10px] font-bold tracking-wide">LANCE UP</span>
      </button>
      <button
        type="button"
        style={{ width: `${btnPx}px`, height: `${Math.max(72, Math.round(btnPx * 0.9))}px` }}
        {...bindTouchButton('lance_down')}
        className="rounded-2xl bg-[#161412]/70 active:bg-[#2E2823]/90 border border-[#D99B26]/35 flex flex-col items-center justify-center text-[#F5EFE6] touch-none select-none cursor-pointer"
        aria-label="Aim lance down"
      >
        <span className="text-[10px] font-bold tracking-wide">LANCE DN</span>
        <ChevronDown className="w-5 h-5 text-[#D99B26]" />
      </button>
    </div>
  );

  const actionCluster = (
    <div className="pointer-events-auto flex flex-col items-end gap-3">
      {lanceButtonsCluster}
      <div className="flex items-end gap-3">
        {localWeapon && (
          <button
            type="button"
            style={btnStyle}
            {...bindTouchButton('special')}
            className="relative overflow-hidden rounded-2xl bg-[#161412]/75 active:bg-[#1E293B]/90 border border-[#38BDF8]/50 flex flex-col items-center justify-center text-[#F5EFE6] touch-none select-none cursor-pointer"
          >
            {weaponCooldownPct > 0 && (
              <div
                className="absolute bottom-0 left-0 right-0 bg-black/65"
                style={{ height: `${weaponCooldownPct}%` }}
              />
            )}
            <Zap className="w-6 h-6 text-[#38BDF8] relative z-10" />
            <span className="text-[10px] font-bold mt-1 relative z-10 whitespace-nowrap">
              {localWeapon.badgeText}
            </span>
          </button>
        )}

        <button
          type="button"
          style={btnStyle}
          {...bindTouchButton('jump')}
          className={`relative overflow-hidden rounded-2xl border flex flex-col items-center justify-center touch-none select-none cursor-pointer ${
            jumpCooldownMs > 0
              ? 'bg-[#161412]/75 border-white/20 text-[#C7BEB2]'
              : 'bg-[#10B981]/25 active:bg-[#10B981]/45 border-[#10B981]/60 text-[#F5EFE6]'
          }`}
          aria-label="Jump"
        >
          <svg
            viewBox="0 0 64 64"
            className="pointer-events-none absolute inset-1 w-[calc(100%-8px)] h-[calc(100%-8px)] -rotate-90"
            aria-hidden="true"
          >
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="4"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              fill="none"
              stroke={jumpCooldownMs > 0 ? '#D99B26' : '#10B981'}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={ringCircumference}
              strokeDashoffset={ringDashOffset}
            />
          </svg>
          <ArrowUp className="w-5 h-5 relative z-10 text-[#10B981]" />
          <span className="text-[10px] font-extrabold mt-0.5 relative z-10">
            {jumpCooldownMs > 0 ? `${(jumpCooldownMs / 1000).toFixed(1)}s` : 'JUMP'}
          </span>
        </button>

        <button
          type="button"
          style={btnStyle}
          {...bindTouchButton('boost')}
          className="relative overflow-hidden rounded-2xl bg-[#E85D2A]/75 active:bg-[#E85D2A]/95 border border-[#F5EFE6]/35 flex flex-col items-center justify-center text-white touch-none select-none cursor-pointer"
          aria-label="Boost dash"
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white/25"
            style={{ height: `${localVehicle?.boostEnergy ?? 100}%` }}
          />
          <Flame className="w-6 h-6 relative z-10" />
          <span className="text-[10px] font-extrabold mt-1 relative z-10">BOOST</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full overflow-hidden bg-[#161412] select-none touch-none"
    >
      {/* Isolated 60 FPS Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block touch-none select-none" />

      {/* Top Perimeter HUD (pointer-events-none wrapper, <=12% height) */}
      <div className="pointer-events-none absolute top-0 left-0 right-0 z-20 p-3 sm:p-4 flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 max-w-[75%]">
          {snapshot.vehicles.map((v) => {
            const hpPct = Math.max(0, Math.round((v.riderHp / Math.max(1, v.maxRiderHp)) * 100));
            const isMe = v.playerId === localPlayerId;
            return (
              <div
                key={v.playerId}
                className={`rounded-xl px-2.5 py-1.5 border ${
                  isMe
                    ? 'bg-[#161412]/90 border-[#E85D2A]/60'
                    : 'bg-[#161412]/85 border-[#D99B26]/25'
                } min-w-[116px]`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-[#F5EFE6] truncate max-w-[85px]">
                    {v.nickname}
                  </span>
                  <span className="font-mono tabular-nums text-[#D99B26] font-bold">
                    {v.roundWins}/{snapshot.roundsToWin}
                  </span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className={`h-full transition-[width] duration-100 ${
                      v.eliminated ? 'bg-red-600' : isMe ? 'bg-[#E85D2A]' : 'bg-[#10B981]'
                    }`}
                    style={{ width: `${v.eliminated ? 0 : hpPct}%` }}
                  />
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] font-mono tabular-nums text-[#C7BEB2]">
                  <span>HP</span>
                  <span>{v.eliminated ? 0 : v.riderHp}/{v.maxRiderHp}</span>
                </div>
                {!v.connected && (
                  <div className="text-[10px] text-amber-400 font-mono mt-0.5">
                    Reconnecting {v.reconnectRemainingSec ?? 10}s
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Top Right: Round, Timer, Settings, Mute, Pause */}
        <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
          {(() => {
            const totalSec = Math.max(0, Math.ceil(snapshot.phaseRemainingMs / 1000));
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            const timeLabel =
              snapshot.phase === 'FIGHTING' && !snapshot.suddenDeath
                ? `${mins}:${String(secs).padStart(2, '0')}`
                : `${totalSec}s`;
            return (
              <div
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-mono tabular-nums ${
                  snapshot.suddenDeath
                    ? 'bg-[#3F1515]/95 border-[#EF4444]/70 text-[#FEE2E2]'
                    : 'bg-[#161412]/90 border-[#D99B26]/30 text-[#F5EFE6]'
                }`}
              >
                <span>R{snapshot.roundIndex}</span>
                <span aria-hidden="true">·</span>
                <span className="font-bold">{timeLabel}</span>
              </div>
            );
          })()}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#161412]/90 hover:bg-[#24201D] border border-white/15 flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Control settings"
          >
            <Sliders className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={onToggleMute}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#161412]/90 hover:bg-[#24201D] border border-white/15 flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={() => setPaused(true)}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#161412]/90 hover:bg-[#24201D] border border-white/15 flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Pause match"
          >
            <Pause className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sudden Death Overtime Callout */}
      {snapshot.phase === 'FIGHTING' && snapshot.suddenDeath && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20 px-4 py-1.5 rounded-xl bg-[#7F1D1D]/90 border border-[#EF4444]/70 text-xs sm:text-sm font-extrabold tracking-wide text-[#FEE2E2] whitespace-nowrap shadow-md">
          SUDDEN DEATH · FIRST HEAD HIT WINS ({Math.max(1, Math.ceil(snapshot.phaseRemainingMs / 1000))}s)
        </div>
      )}

      {/* Health Pickup Incoming Callout */}
      {snapshot.phase === 'FIGHTING' && snapshot.healthPickup?.state === 'falling' && !snapshot.suddenDeath && (
        <div className="pointer-events-none absolute top-16 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-xl bg-[#064E3B]/90 border border-[#10B981]/70 text-xs sm:text-sm font-extrabold text-[#ECFDF5] whitespace-nowrap shadow-md">
          Health incoming! · Center Drop (+30% HP)
        </div>
      )}

      {/* Countdown / KO Center Callout */}
      {(snapshot.phase === 'COUNTDOWN' || snapshot.phase === 'ROUND_END') && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center p-4">
          <div className="rounded-2xl bg-[#161412]/90 border border-[#D99B26]/50 px-7 py-4 text-center">
            {snapshot.phase === 'COUNTDOWN' ? (
              <>
                <div className="text-xs font-medium text-[#D99B26]">Round {snapshot.roundIndex}</div>
                <div className="font-display text-4xl sm:text-5xl font-extrabold text-[#F5EFE6] tabular-nums">
                  {Math.max(1, Math.ceil(snapshot.phaseRemainingMs / 1000))}
                </div>
              </>
            ) : (
              <>
                <div className="text-xs font-medium text-[#E85D2A]">Round Complete</div>
                <div className="font-display text-2xl sm:text-3xl font-extrabold text-[#F5EFE6]">
                  {snapshot.koSummary || 'Clash Decided!'}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Desktop Keyboard Hint Strip (desktop / keyboard mode during fight) */}
      {snapshot.phase === 'FIGHTING' && !showTouchControls && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-xl bg-[#161412]/80 border border-white/10 flex items-center gap-4 text-xs font-mono text-[#D7CFC4] whitespace-nowrap">
          <span>A/D or ←/→: Move</span>
          <span>W/↑: Jump</span>
          <span>Space: Boost ({localVehicle?.boostEnergy ?? 100}%)</span>
          <span>Q/E: Lance</span>
          {localWeapon && <span>Shift/F: {localWeapon.name}</span>}
          <span>P/Esc: Pause</span>
        </div>
      )}

      {/* Multi-Touch Controls Layer (mobile / touch mode during fight) */}
      {snapshot.phase === 'FIGHTING' && showTouchControls && (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 pl-[max(16px,env(safe-area-inset-left))] pr-[max(16px,env(safe-area-inset-right))] pt-2 pb-[max(16px,env(safe-area-inset-bottom))] flex items-end justify-between gap-4 touch-none select-none"
        >
          {controlSettings.leftHanded ? (
            <>
              {actionCluster}
              {moveCluster}
            </>
          ) : (
            <>
              {moveCluster}
              {actionCluster}
            </>
          )}
        </div>
      )}

      {/* First-Match "How to Play" Overlay tailored to active Touch vs Keyboard profile */}
      {showHowToPlayOverlay && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/40 p-6 flex flex-col gap-5 text-center">
            <div>
              <div className="text-xs font-mono text-[#D99B26]">
                {showTouchControls ? 'TOUCH CONTROLS DETECTED' : 'KEYBOARD CONTROLS DETECTED'}
              </div>
              <h3 className="font-display text-2xl font-extrabold text-[#F5EFE6] mt-1">
                How to Control Your Rig
              </h3>
            </div>

            {showTouchControls ? (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1 text-[#D99B26]">
                    <ArrowLeft className="w-5 h-5" />
                    <ArrowRight className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold text-[#F5EFE6]">Move Pads</div>
                  <div className="text-[11px] text-[#C7BEB2]">Hold LEFT or RIGHT thumb pads to drive</div>
                </div>
                <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex flex-col items-center gap-2">
                  <Flame className="w-7 h-7 text-[#E85D2A]" />
                  <div className="text-xs font-bold text-[#F5EFE6]">Boost Pad</div>
                  <div className="text-[11px] text-[#C7BEB2]">Hold BOOST for a forward dash</div>
                </div>
                <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex flex-col items-center gap-2">
                  <Crosshair className="w-7 h-7 text-[#10B981]" />
                  <div className="text-xs font-bold text-[#F5EFE6]">Lance Pads</div>
                  <div className="text-[11px] text-[#C7BEB2]">Hold LANCE UP / DN to aim while moving</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex flex-col items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-[#221E1B] border border-[#D99B26]/40 text-xs font-mono font-bold text-[#D99B26]">
                    A / D
                  </span>
                  <div className="text-xs font-bold text-[#F5EFE6]">Move</div>
                  <div className="text-[11px] text-[#C7BEB2]">Hold A/D or ←/→ keys to drive</div>
                </div>
                <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex flex-col items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-[#221E1B] border border-[#E85D2A]/40 text-xs font-mono font-bold text-[#E85D2A]">
                    SPACE
                  </span>
                  <div className="text-xs font-bold text-[#F5EFE6]">Boost</div>
                  <div className="text-[11px] text-[#C7BEB2]">Hold Space for a forward dash</div>
                </div>
                <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex flex-col items-center gap-2">
                  <span className="px-2 py-1 rounded-md bg-[#221E1B] border border-[#10B981]/40 text-xs font-mono font-bold text-[#10B981]">
                    Q / E
                  </span>
                  <div className="text-xs font-bold text-[#F5EFE6]">Lance</div>
                  <div className="text-[11px] text-[#C7BEB2]">Hold Q/E to aim · P/Esc to pause</div>
                </div>
              </div>
            )}

            <p className="text-xs text-[#C7BEB2]">
              Your rig stays still until you move or jump. Watch the 3-2-1 countdown, then drive and joust!
              {showTouchControls ? ' Tap JUMP for a single hop (1.2s cooldown).' : ' Press W or ↑ to Jump (1.2s cooldown).'}
              {localWeapon && (showTouchControls ? ' Tap your Special pad for the room weapon.' : ' Press Shift or F for your room weapon.')}
            </p>

            <button
              type="button"
              onClick={onDismissHowToPlay}
              className="min-h-[48px] w-full rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] text-sm font-extrabold text-white cursor-pointer"
            >
              Got It — Let&apos;s Duel
            </button>
          </div>
        </div>
      )}

      {/* 15s Drawing Overlay */}
      {snapshot.phase === 'DRAWING' && !showHowToPlayOverlay && (
        <DrawingPad
          roundIndex={snapshot.roundIndex}
          remainingMs={snapshot.phaseRemainingMs}
          inkStyleId={localVehicle?.cosmetics.inkStyleId ?? 'ink_charcoal'}
          submitted={submittedRound === snapshot.roundIndex}
          onSubmit={(bp) => {
            setSubmittedRound(snapshot.roundIndex);
            onSubmitDrawing(bp);
          }}
        />
      )}

      {/* Pause Modal */}
      {paused && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#221E1B] border border-[#D99B26]/30 p-6 flex flex-col gap-3 text-center">
            <h3 className="font-display text-2xl font-extrabold text-[#F5EFE6]">Match Paused</h3>
            <p className="text-xs text-[#C7BEB2]">
              A/D Move · W/↑ Jump · Space Boost · Q/E Lance{localWeapon ? ' · Shift/F Weapon' : ''}
            </p>
            <button
              type="button"
              onClick={() => setPaused(false)}
              className="min-h-[46px] w-full rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] font-bold text-sm text-white cursor-pointer"
            >
              Resume Battle
            </button>
            <button
              type="button"
              onClick={() => {
                setPaused(false);
                setShowSettings(true);
              }}
              className="min-h-[46px] w-full rounded-xl bg-[#2C2621] hover:bg-[#38312B] font-semibold text-sm text-[#F5EFE6] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sliders className="w-4 h-4 text-[#D99B26]" />
              <span>Control Settings</span>
            </button>
            <button
              type="button"
              onClick={onExitMatch}
              className="min-h-[46px] w-full rounded-xl bg-[#2C2621] hover:bg-[#38312B] font-semibold text-sm text-[#F5EFE6] flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Leave Match</span>
            </button>
          </div>
        </div>
      )}

      {showSettings && (
        <ControlsSettingsModal
          settings={controlSettings}
          onChange={onUpdateControlSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};
