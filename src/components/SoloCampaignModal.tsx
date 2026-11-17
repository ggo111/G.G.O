import React from 'react';
import { ArrowLeft, CheckCircle2, Clock, Lock, Shield, Swords } from 'lucide-react';
import { ARENAS, CAMPAIGN_LEVELS, RIDER_CATALOG } from '../data/gameCatalog.ts';
import type { AIDifficulty, CampaignLevelDef, PlayerProfile, RoundDurationSec } from '../types/game.ts';

interface SoloCampaignModalProps {
  profile: PlayerProfile;
  onSelectDifficulty: (difficulty: AIDifficulty) => void;
  onSelectRoundDuration: (roundDurationSec: RoundDurationSec) => void;
  onStartLevel: (level: CampaignLevelDef, difficulty: AIDifficulty) => void;
  onBack: () => void;
}

const DIFFICULTIES: { id: AIDifficulty; label: string; desc: string; multiplier: string }[] = [
  { id: 'easy', label: 'Easy', desc: 'Slow reactions, frequent misses & rare boosts', multiplier: '1.0x Rewards' },
  { id: 'normal', label: 'Normal', desc: 'Moderate reactions & balanced jousting', multiplier: '1.4x Rewards' },
  { id: 'hard', label: 'Hard', desc: 'Faster reactions & assertive lance timing', multiplier: '1.8x Rewards' },
];

export const SoloCampaignModal: React.FC<SoloCampaignModalProps> = ({
  profile,
  onSelectDifficulty,
  onSelectRoundDuration,
  onStartLevel,
  onBack,
}) => {
  const difficulty: AIDifficulty = profile.controlSettings.botDifficulty ?? 'easy';
  const roundDurationSec: RoundDurationSec =
    profile.controlSettings.roundDurationSec === 300 ? 300 : 60;
  const clearedCount = profile.campaignCleared[difficulty] ?? 0;

  return (
    <div className="w-full h-full overflow-y-auto forge-scroll bg-[#161412] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#221E1B] hover:bg-[#2E2925] border border-white/10 text-sm font-semibold text-[#F5EFE6] flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="text-right">
            <div className="text-xs font-mono text-[#10B981]">OFFLINE READY</div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F5EFE6]">
              Solo Ink-Forge Campaign
            </h1>
          </div>
        </div>

        {/* Difficulty Selector (Easy / Normal / Hard, persisted in localStorage) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {DIFFICULTIES.map((d) => {
            const active = difficulty === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => onSelectDifficulty(d.id)}
                className={`rounded-2xl p-4 text-left border transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#2B241E] border-[#E85D2A]'
                    : 'bg-[#221E1B] border-white/10 hover:border-[#D99B26]/40'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-display text-lg font-bold text-[#F5EFE6]">{d.label}</span>
                  <span className="text-xs font-mono text-[#D99B26]">{d.multiplier}</span>
                </div>
                <p className="text-xs text-[#C7BEB2] mt-1">{d.desc}</p>
              </button>
            );
          })}
        </div>

        {/* Round Time Selector (1 Minute / 5 Minutes) */}
        <div className="rounded-2xl bg-[#221E1B] border border-white/10 p-3.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#C7BEB2]">
            <Clock className="w-4 h-4 text-[#D99B26]" />
            <span className="font-semibold text-[#F5EFE6]">Round Time</span>
            <span className="text-[#8C8377] hidden sm:inline">· Higher HP wins or 15s Sudden Death on tie</span>
          </div>
          <div className="flex gap-2">
            {(
              [
                { sec: 60, label: '1 Minute' },
                { sec: 300, label: '5 Minutes' },
              ] as { sec: RoundDurationSec; label: string }[]
            ).map((opt) => (
              <button
                key={opt.sec}
                type="button"
                onClick={() => onSelectRoundDuration(opt.sec)}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold border cursor-pointer ${
                  roundDurationSec === opt.sec
                    ? 'bg-[#D99B26] border-[#F5EFE6]/30 text-[#161412]'
                    : 'bg-[#161412] border-white/10 text-[#C7BEB2]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6 Progressive Arenas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {CAMPAIGN_LEVELS.map((lvl) => {
            const arena = ARENAS.find((a) => a.id === lvl.arenaId) ?? ARENAS[0];
            const rivalRider = RIDER_CATALOG.find((r) => r.id === lvl.rivalRiderId) ?? RIDER_CATALOG[0];
            const unlocked = lvl.level <= clearedCount + 1;
            const cleared = lvl.level <= clearedCount;

            return (
              <div
                key={lvl.level}
                className={`rounded-2xl p-5 border flex flex-col justify-between gap-4 ${
                  unlocked
                    ? 'bg-[#221E1B] border-[#D99B26]/25'
                    : 'bg-[#1B1815] border-white/5 opacity-60'
                }`}
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#D99B26] font-bold">STAGE 0{lvl.level}</span>
                    {cleared ? (
                      <span className="flex items-center gap-1 text-[#10B981] font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Cleared
                      </span>
                    ) : !unlocked ? (
                      <span className="flex items-center gap-1 text-[#8C8377]">
                        <Lock className="w-3.5 h-3.5" />
                        Locked
                      </span>
                    ) : (
                      <span className="text-[#E85D2A] font-semibold">Next Rival</span>
                    )}
                  </div>

                  <h3 className="font-display text-xl font-extrabold text-[#F5EFE6]">
                    {arena.name}
                  </h3>
                  <p className="text-xs text-[#C7BEB2]">{arena.subtitle}</p>

                  <div className="mt-2 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full inline-block"
                        style={{ backgroundColor: rivalRider.primaryColor }}
                      />
                      <span className="font-semibold text-[#F5EFE6]">{lvl.rivalName}</span>
                    </div>
                    <span className="text-[#A39A8E] flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5" />
                      {lvl.archetype}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-2">
                  <div className="text-xs font-mono tabular-nums text-[#C7BEB2]">
                    +{lvl.rewardCoins}c / +{lvl.rewardGems}g
                  </div>
                  <button
                    type="button"
                    disabled={!unlocked}
                    onClick={() => onStartLevel(lvl, difficulty)}
                    className="min-h-[44px] px-4 rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] disabled:bg-[#2C2621] disabled:text-[#8C8377] text-sm font-bold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    <Swords className="w-4 h-4" />
                    <span>Challenge</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
