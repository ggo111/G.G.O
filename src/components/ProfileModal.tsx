import React, { useState } from 'react';
import {
  Check,
  Coins,
  Edit3,
  Gem,
  Shield,
  Ticket,
  Trophy,
  User,
  X,
} from 'lucide-react';
import { AVATARS, getAvatarDef } from '../data/avatars.ts';
import type { PlayerProfile } from '../types/game.ts';
import { xpNeededForLevel } from '../utils/profileStore.ts';
import { AvatarBadge } from './AvatarBadge.tsx';

interface ProfileModalProps {
  profile: PlayerProfile;
  onSelectAvatar: (avatarId: string) => void;
  onUpdateNickname: (nick: string) => Promise<{ ok: boolean; error?: string }>;
  onOpenPromoCode: () => void;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  profile,
  onSelectAvatar,
  onUpdateNickname,
  onOpenPromoCode,
  onClose,
}) => {
  const [editingNick, setEditingNick] = useState(false);
  const [nickInput, setNickInput] = useState(profile.nickname);
  const [nickError, setNickError] = useState<string | null>(null);
  const [savingNick, setSavingNick] = useState(false);

  const xpCap = xpNeededForLevel(profile.level);
  const xpPct = Math.min(100, Math.round((profile.xp / xpCap) * 100));
  const currentAvatar = getAvatarDef(profile.avatarId);

  const saveNick = async () => {
    const clean = nickInput.trim().slice(0, 16);
    if (clean.length < 2) {
      setNickError('Nickname must be at least 2 characters.');
      return;
    }
    setSavingNick(true);
    setNickError(null);
    const res = await onUpdateNickname(clean);
    setSavingNick(false);
    if (!res.ok) {
      setNickError(res.error ?? 'Name already taken');
      return;
    }
    setEditingNick(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[92vh] rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <User className="w-5 h-5 text-[#D99B26]" />
            <h2 className="font-display text-xl font-extrabold text-[#F5EFE6]">
              Rider Profile &amp; Avatars
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-5 overflow-y-auto forge-scroll flex flex-col gap-5">
          {/* Top Identity & Stats Card */}
          <div className="rounded-2xl bg-[#161412] border border-white/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <AvatarBadge avatarId={profile.avatarId} size={64} />
              <div className="flex flex-col gap-1">
                {editingNick ? (
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        value={nickInput}
                        maxLength={16}
                        disabled={savingNick}
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
                        autoFocus
                        className="w-40 rounded-lg bg-[#221E1B] border border-[#E85D2A] px-2.5 py-1.5 text-sm font-bold text-[#F5EFE6] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={savingNick}
                        onClick={() => void saveNick()}
                        className="min-h-[36px] min-w-[36px] rounded-lg bg-[#10B981] text-[#161412] flex items-center justify-center cursor-pointer"
                        aria-label="Save nickname"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                    {nickError && <p className="text-[11px] font-semibold text-[#EF4444]">{nickError}</p>}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setNickInput(profile.nickname);
                      setNickError(null);
                      setEditingNick(true);
                    }}
                    className="flex items-center gap-1.5 text-base font-extrabold text-[#F5EFE6] hover:text-[#D99B26] cursor-pointer text-left"
                  >
                    <span>{profile.nickname}</span>
                    <Edit3 className="w-3.5 h-3.5 text-[#C7BEB2]" />
                  </button>
                )}

                <div className="text-xs text-[#C7BEB2] flex items-center gap-2">
                  <span>{currentAvatar.name}</span>
                  <span>·</span>
                  <span className="font-mono text-[#D99B26]">Lv.{profile.level}</span>
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-28 h-2 rounded-full bg-white/10 overflow-hidden">
                    <div className="h-full bg-[#D99B26]" style={{ width: `${xpPct}%` }} />
                  </div>
                  <span className="text-[11px] font-mono text-[#A39A8E]">
                    {profile.xp}/{xpCap} XP
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenPromoCode}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#2C2621] hover:bg-[#3A322C] border border-[#D99B26]/35 text-xs font-bold text-[#D99B26] flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
            >
              <Ticket className="w-4 h-4" />
              <span>Promo code</span>
            </button>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
              <div className="text-[11px] text-[#A39A8E] flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-[#F5B041]" /> Trophies
              </div>
              <div className="font-mono font-extrabold text-base text-[#F5EFE6] mt-0.5">
                {profile.trophies}
              </div>
            </div>
            <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
              <div className="text-[11px] text-[#A39A8E] flex items-center gap-1">
                <Shield className="w-3.5 h-3.5 text-[#10B981]" /> Ranked W / L
              </div>
              <div className="font-mono font-extrabold text-base text-[#F5EFE6] mt-0.5">
                {profile.rankedWins} / {profile.rankedLosses}
              </div>
            </div>
            <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
              <div className="text-[11px] text-[#A39A8E] flex items-center gap-1">
                <Coins className="w-3.5 h-3.5 text-[#F5B041]" /> Coins
              </div>
              <div className="font-mono font-extrabold text-base text-[#F5B041] mt-0.5">
                {profile.unlimitedCurrency ? '∞' : profile.coins}
              </div>
            </div>
            <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
              <div className="text-[11px] text-[#A39A8E] flex items-center gap-1">
                <Gem className="w-3.5 h-3.5 text-[#38BDF8]" /> Gems
              </div>
              <div className="font-mono font-extrabold text-base text-[#38BDF8] mt-0.5">
                {profile.unlimitedCurrency ? '∞' : profile.gems}
              </div>
            </div>
          </div>

          {/* Equipped Items Summary */}
          <div className="rounded-xl bg-[#161412] border border-white/10 p-3.5">
            <div className="text-xs font-bold text-[#F5EFE6] mb-2">Equipped Workshop Loadout</div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
              <div className="rounded-lg bg-[#221E1B] px-2.5 py-2 border border-white/5">
                <div className="text-[#8C8377]">Skin</div>
                <div className="font-semibold text-[#F5EFE6] truncate">
                  {profile.equipped.skinId ?? 'skin_starter'}
                </div>
              </div>
              <div className="rounded-lg bg-[#221E1B] px-2.5 py-2 border border-white/5">
                <div className="text-[#8C8377]">Weapon</div>
                <div className="font-semibold text-[#F5EFE6] truncate">
                  {profile.equipped.weaponId ?? 'weapon_starter_lance'}
                </div>
              </div>
              <div className="rounded-lg bg-[#221E1B] px-2.5 py-2 border border-white/5">
                <div className="text-[#8C8377]">Background</div>
                <div className="font-semibold text-[#F5EFE6] truncate">
                  {profile.equipped.backgroundId ?? 'bg_starter_forge'}
                </div>
              </div>
              <div className="rounded-lg bg-[#221E1B] px-2.5 py-2 border border-white/5">
                <div className="text-[#8C8377]">Theme</div>
                <div className="font-semibold text-[#F5EFE6] truncate">
                  {profile.equipped.themeId ?? 'theme_soft_sand'}
                </div>
              </div>
              <div className="rounded-lg bg-[#221E1B] px-2.5 py-2 border border-white/5">
                <div className="text-[#8C8377]">Trail</div>
                <div className="font-semibold text-[#F5EFE6] truncate">
                  {profile.equipped.trailId ?? 'trail_starter_spark'}
                </div>
              </div>
            </div>
          </div>

          {/* 40 SVG Avatar Picker */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#F5EFE6]">
                Choose Avatar ({AVATARS.length} Built-in Vector Avatars)
              </span>
              <span className="text-[11px] text-[#A39A8E]">Tap to select instantly</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
              {AVATARS.map((av) => {
                const selected = profile.avatarId === av.id;
                return (
                  <button
                    key={av.id}
                    type="button"
                    onClick={() => onSelectAvatar(av.id)}
                    title={av.name}
                    className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-colors ${
                      selected
                        ? 'bg-[#2C241D] border-[#D99B26]'
                        : 'bg-[#161412] border-white/10 hover:border-white/30'
                    }`}
                  >
                    <AvatarBadge avatarId={av.id} size={44} />
                    <span className="text-[9px] font-semibold text-[#C7BEB2] truncate w-full text-center">
                      {av.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
