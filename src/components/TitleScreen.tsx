import React, { useRef, useState } from 'react';
import {
  Award,
  Check,
  Coins,
  Edit3,
  Flame,
  Gem,
  Gift,
  RefreshCw,
  ShoppingBag,
  Sliders,
  Swords,
  Ticket,
  Trophy,
  User,
  Users,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { getWeaponById } from '../data/weapons.ts';
import type { PlayerProfile } from '../types/game.ts';
import { openDebugPanel } from '../utils/debugLog.ts';
import { xpNeededForLevel } from '../utils/profileStore.ts';
import { AvatarBadge } from './AvatarBadge.tsx';

interface TitleScreenProps {
  profile: PlayerProfile;
  backendReady: boolean;
  dailyAvailable: boolean;
  unclaimedMissionsCount: number;
  onUpdateNickname: (nick: string) => Promise<{ ok: boolean; error?: string }>;
  onClaimDaily: () => void;
  onToggleMute: () => void;
  onOpenQuickMatch: () => void;
  onOpenSolo: () => void;
  onOpenPrivateRoom: () => void;
  onOpenArmory: () => void;
  onOpenLoadout: () => void;
  onOpenExchange: () => void;
  onOpenPromoCode: () => void;
  onOpenProfile: () => void;
  onOpenLeaderboard: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  profile,
  backendReady,
  dailyAvailable,
  unclaimedMissionsCount,
  onUpdateNickname,
  onClaimDaily,
  onToggleMute,
  onOpenQuickMatch,
  onOpenSolo,
  onOpenPrivateRoom,
  onOpenArmory,
  onOpenLoadout,
  onOpenExchange,
  onOpenPromoCode,
  onOpenProfile,
  onOpenLeaderboard,
  onOpenMissions,
  onOpenSettings,
}) => {
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState(profile.nickname);
  const [nickError, setNickError] = useState<string | null>(null);
  const [savingNick, setSavingNick] = useState(false);
  const titleTapRef = useRef<{ count: number; lastAt: number }>({ count: 0, lastAt: 0 });

  const xpCap = xpNeededForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / xpCap) * 100));
  const equippedWeapon = getWeaponById(profile.equipped.weaponId);

  const handleTitleTap = () => {
    const now = performance.now();
    if (now - titleTapRef.current.lastAt > 2000) {
      titleTapRef.current.count = 0;
    }
    titleTapRef.current.count += 1;
    titleTapRef.current.lastAt = now;
    if (titleTapRef.current.count >= 5) {
      titleTapRef.current.count = 0;
      openDebugPanel(true);
    }
  };

  const saveNick = async () => {
    const clean = nickInput.trim().slice(0, 16);
    if (clean.length < 2) {
      setNickInput(profile.nickname);
      setNickError(null);
      setEditingNick(false);
      return;
    }
    setSavingNick(true);
    setNickError(null);
    const res = await onUpdateNickname(clean);
    setSavingNick(false);
    if (!res.ok) {
      setNickError(res.error || 'Name already taken');
      return;
    }
    setEditingNick(false);
  };

  return (
    <div
      className="relative w-full h-full overflow-y-auto forge-scroll flex flex-col justify-between"
      style={{ backgroundColor: 'var(--ggo-bg-primary)' }}
    >
      {/* Full-Viewport Key Art Backdrop */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <img
          src="/src/assets/images/title_ink_forge_backdrop_1794653016408.jpg"
          alt="Grand Ink-Forge Arena"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center opacity-50"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, var(--ggo-bg-primary) 0%, color-mix(in srgb, var(--ggo-bg-primary) 82%, transparent) 55%, color-mix(in srgb, var(--ggo-bg-primary) 42%, transparent) 100%)',
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(0deg, var(--ggo-bg-primary) 0%, transparent 50%, color-mix(in srgb, var(--ggo-bg-primary) 70%, transparent) 100%)',
          }}
        />
      </div>

      {/* Compact Top Guest Bar */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-4 pt-3 sm:pt-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenProfile}
            className="rounded-full p-0.5 border border-[#D99B26]/50 hover:border-[#D99B26] bg-[#221E1B] shrink-0 cursor-pointer transition-transform active:scale-95"
            title="Open Profile & Avatars"
            aria-label="Open Profile & Avatars"
          >
            <AvatarBadge avatarId={profile.avatarId} size={44} />
          </button>
          <div>
            {editingNick ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  <input
                    value={nickInput}
                    onChange={(e) => {
                      setNickInput(e.target.value);
                      if (nickError) setNickError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void saveNick();
                      if (e.key === 'Escape') {
                        setNickError(null);
                        setEditingNick(false);
                      }
                    }}
                    maxLength={16}
                    disabled={savingNick}
                    autoFocus
                    className="w-36 rounded-lg bg-[#221E1B] border border-[#E85D2A] px-2.5 py-1 text-sm font-semibold text-[#F5EFE6] focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={savingNick}
                    onClick={() => void saveNick()}
                    className="min-h-[36px] min-w-[36px] rounded-lg bg-[#10B981] text-[#161412] flex items-center justify-center cursor-pointer disabled:opacity-60"
                    aria-label="Save nickname"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
                {nickError && (
                  <p className="text-[11px] font-semibold text-[#EF4444]">{nickError}</p>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setNickInput(profile.nickname);
                  setNickError(null);
                  setEditingNick(true);
                }}
                className="flex items-center gap-1.5 text-sm font-bold text-[#F5EFE6] hover:text-[#D99B26] cursor-pointer"
              >
                <span>{profile.nickname}</span>
                <Edit3 className="w-3.5 h-3.5 text-[#C7BEB2]" />
              </button>
            )}
            <div className="flex items-center gap-2 text-xs text-[#C7BEB2] mt-0.5">
              <span className="font-mono tabular-nums text-[#D99B26]">Lv.{profile.level}</span>
              <span aria-hidden="true">·</span>
              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full bg-[#D99B26]" style={{ width: `${xpPct}%` }} />
              </div>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">MMR {profile.mmr}</span>
            </div>
          </div>
        </div>

        {/* Currencies & Utility Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#221E1B]/90 border border-[#D99B26]/25 text-xs font-mono tabular-nums">
            <span className="flex items-center gap-1 text-[#F5B041] font-bold">
              <Coins className="w-4 h-4" />
              {profile.unlimitedCurrency ? '∞' : profile.coins}
            </span>
            <span className="text-white/20">/</span>
            <span className="flex items-center gap-1 text-[#38BDF8] font-bold">
              <Gem className="w-4 h-4" />
              {profile.unlimitedCurrency ? '∞' : profile.gems}
            </span>
            {profile.winStreak >= 2 && (
              <>
                <span className="text-white/20">/</span>
                <span className="flex items-center gap-1 text-[#E85D2A] font-bold">
                  <Flame className="w-4 h-4" />
                  {profile.winStreak}
                </span>
              </>
            )}
            <button
              type="button"
              onClick={onOpenExchange}
              className="ml-1 px-2 py-1 rounded-lg bg-[#2C2621] hover:bg-[#3A322C] border border-[#D99B26]/30 text-[11px] font-sans font-bold text-[#D99B26] flex items-center gap-1 cursor-pointer"
              title="Convert Gems to Coins (1 Gem = 50 Coins)"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Exchange</span>
            </button>
          </div>

          {dailyAvailable && (
            <button
              type="button"
              onClick={onClaimDaily}
              className="min-h-[44px] px-3 rounded-xl bg-[#D99B26] hover:bg-[#E5AA38] text-[#161412] text-xs font-extrabold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Gift className="w-4 h-4" />
              <span>Daily Gift</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMute}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#221E1B]/90 hover:bg-[#2E2925] border border-white/10 flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label={profile.muted ? 'Unmute sound' : 'Mute sound'}
          >
            {profile.muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Main Hero Lockup + Mode Launchers */}
      <main className="relative z-10 w-full max-w-6xl mx-auto px-4 py-6 sm:py-10 flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        {/* Left Calm Negative Space: Bespoke SVG Lockup + Control Hint */}
        <div className="max-w-lg flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/arena_crest_emblem_1794653017587.jpg"
              alt="Ink-Forge Guild Crest"
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-xl border border-[#D99B26]/40 object-cover"
            />
            <span className="text-xs font-medium text-[#D99B26]">
              Ink-Forge Physics Jousting · Best of 3
            </span>
          </div>

          {/* Bespoke SVG Title Lockup (5 taps opens Debug Diagnostics) */}
          <svg
            viewBox="0 0 360 92"
            onClick={handleTitleTap}
            className="w-64 sm:w-80 h-auto overflow-visible select-none cursor-pointer"
            aria-label="G G O"
          >
            <defs>
              <linearGradient id="ggoBrass" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#F5EFE6" />
                <stop offset="55%" stopColor="#D99B26" />
                <stop offset="100%" stopColor="#E85D2A" />
              </linearGradient>
            </defs>
            <text
              x="0"
              y="72"
              fill="url(#ggoBrass)"
              stroke="#161412"
              strokeWidth="4"
              paintOrder="stroke"
              style={{
                fontFamily: '"Bricolage Grotesque", sans-serif',
                fontWeight: 800,
                fontSize: '78px',
                letterSpacing: '0.08em',
              }}
            >
              G G O
            </text>
            <line x1="2" y1="84" x2="275" y2="84" stroke="#E85D2A" strokeWidth="4" strokeLinecap="round" />
          </svg>

          <p className="text-sm sm:text-base text-[#D7CFC4] leading-relaxed">
            Sketch any machine in 15 seconds, mount your clockwork lance, and smash rivals off the drafting rail.
          </p>

          <p className="text-xs text-[#A39A8E] font-mono">
            Draw 15s · Move L/R · Boost Dash · Aim Lance · Touch &amp; Keyboard
          </p>

          {/* Secondary Progression Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenArmory}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-[var(--ggo-border)] text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-4 h-4 text-[var(--ggo-accent-primary)]" />
              <span>Shop</span>
            </button>
            <button
              type="button"
              onClick={onOpenLoadout}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-[var(--ggo-border)] text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Swords className="w-4 h-4 text-[var(--ggo-accent-secondary)]" />
              <span>Loadout: {equippedWeapon.name}</span>
            </button>
            <button
              type="button"
              onClick={onOpenMissions}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-[var(--ggo-border)] text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Award className="w-4 h-4 text-[#10B981]" />
              <span>Missions &amp; Quests</span>
              {unclaimedMissionsCount > 0 && (
                <span className="ml-1 font-mono text-xs font-bold text-[#E85D2A]">
                  ({unclaimedMissionsCount})
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={onOpenSettings}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-white/15 text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Sliders className="w-4 h-4 text-[var(--ggo-text-muted)]" />
              <span>Controls</span>
            </button>
            <button
              type="button"
              onClick={onOpenLeaderboard}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-[var(--ggo-border)] text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Trophy className="w-4 h-4 text-[#F5B041]" />
              <span>Leaderboard</span>
            </button>
            <button
              type="button"
              onClick={onOpenProfile}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-[var(--ggo-border)] text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <User className="w-4 h-4 text-[#38BDF8]" />
              <span>Profile</span>
            </button>
            <button
              type="button"
              onClick={onOpenPromoCode}
              className="min-h-[44px] px-4 rounded-xl bg-[var(--ggo-bg-surface)]/95 hover:bg-[var(--ggo-bg-surface-alt)] border border-[var(--ggo-border)] text-sm font-semibold text-[var(--ggo-text-primary)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
            >
              <Ticket className="w-4 h-4 text-[var(--ggo-accent-primary)]" />
              <span>Promo code</span>
            </button>
          </div>
        </div>

        {/* Right: 3 Primary Game Modes */}
        <div className="w-full lg:max-w-md flex flex-col gap-3">
          {/* Primary CTA: Quick Match */}
          <button
            type="button"
            onClick={onOpenQuickMatch}
            className="group w-full rounded-2xl bg-[#E85D2A] hover:bg-[#F26A38] p-4 sm:p-5 text-left transition-transform active:scale-[0.99] cursor-pointer border border-white/15"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-black/20 flex items-center justify-center text-white shrink-0">
                  <Swords className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-display text-xl font-extrabold text-white">Quick Match</div>
                  <div className="text-xs text-white/85 mt-0.5">
                    Online skill-matched duel · 20s bot fallback
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-white/90 flex items-center gap-1 shrink-0">
                <Wifi className="w-3.5 h-3.5" />
                {backendReady ? 'LIVE P2P' : 'BOT MODE'}
              </span>
            </div>
          </button>

          {/* Solo Offline Campaign */}
          <button
            type="button"
            onClick={onOpenSolo}
            className="w-full rounded-2xl bg-[#221E1B]/95 hover:bg-[#2B2622] p-4 sm:p-5 text-left transition-colors border border-[#D99B26]/30 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#D99B26]/15 flex items-center justify-center text-[#D99B26] shrink-0">
                  <Flame className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-display text-lg font-bold text-[#F5EFE6]">Solo Campaign</div>
                  <div className="text-xs text-[#C7BEB2] mt-0.5">
                    Offline AI · 3 difficulties · 6 progressive arenas
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-[#10B981] shrink-0">OFFLINE OK</span>
            </div>
          </button>

          {/* Private Room (Online & Hotspot) */}
          <button
            type="button"
            onClick={onOpenPrivateRoom}
            className="w-full rounded-2xl bg-[#221E1B]/95 hover:bg-[#2B2622] p-4 sm:p-5 text-left transition-colors border border-[#D99B26]/30 cursor-pointer"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-[#38BDF8]/15 flex items-center justify-center text-[#38BDF8] shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-display text-lg font-bold text-[#F5EFE6]">Private Room</div>
                  <div className="text-xs text-[#C7BEB2] mt-0.5">
                    2–5 friends · Online code or Offline Hotspot QR · Room Weapons
                  </div>
                </div>
              </div>
              <span className="text-xs font-mono text-[#38BDF8] shrink-0">2–5 PLR</span>
            </div>
          </button>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-6xl mx-auto px-4 pb-4 text-xs text-[#8C8377] flex items-center justify-between">
        <span>Original Clockwork Cast: Pip · Cogsworth · Vespera · Bramble · Gideon</span>
        <span className="font-mono tabular-nums">60 FPS Physics</span>
      </footer>
    </div>
  );
};
