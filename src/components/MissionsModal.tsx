import React from 'react';
import { Award, Check, Gift, Trophy, X } from 'lucide-react';
import { DAILY_LOGIN_REWARDS } from '../data/gameCatalog.ts';
import type { PlayerProfile } from '../types/game.ts';

interface MissionsModalProps {
  profile: PlayerProfile;
  dailyAvailable: boolean;
  onClaimDaily: () => void;
  onClaimMission: (missionId: string) => void;
  onClose: () => void;
}

export const MissionsModal: React.FC<MissionsModalProps> = ({
  profile,
  dailyAvailable,
  onClaimDaily,
  onClaimMission,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#F5EFE6]">
              Missions, Login Streak &amp; Honors
            </h2>
            <p className="text-xs text-[#C7BEB2] mt-0.5">
              Earn Coins, Gems, and XP through fair play — zero real-money purchases.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close missions"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto forge-scroll flex flex-col gap-6">
          {/* 7-Day Login Streak */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-base font-bold text-[#F5EFE6] flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#D99B26]" />
                7-Day Login Forge Streak
              </h3>
              {dailyAvailable && (
                <button
                  type="button"
                  onClick={onClaimDaily}
                  className="min-h-[38px] px-3.5 rounded-lg bg-[#D99B26] text-[#161412] text-xs font-extrabold cursor-pointer"
                >
                  Claim Day {profile.loginStreakDay}
                </button>
              )}
            </div>
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {DAILY_LOGIN_REWARDS.map((r) => {
                const isToday = r.day === profile.loginStreakDay;
                const passed = r.day < profile.loginStreakDay;
                return (
                  <div
                    key={r.day}
                    className={`rounded-xl p-2 text-center border ${
                      isToday && dailyAvailable
                        ? 'bg-[#2E251B] border-[#D99B26]'
                        : passed
                        ? 'bg-[#161412] border-[#10B981]/35 opacity-75'
                        : 'bg-[#161412] border-white/10'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-[#C7BEB2]">D{r.day}</div>
                    <div className="text-xs font-mono font-bold text-[#F5B041] mt-1">{r.coins}c</div>
                    <div className="text-[10px] font-mono text-[#38BDF8]">{r.gems}g</div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Daily & Weekly Missions */}
          <section className="flex flex-col gap-2.5">
            <h3 className="font-display text-base font-bold text-[#F5EFE6] flex items-center gap-2">
              <Award className="w-4 h-4 text-[#10B981]" />
              Daily &amp; Weekly Quests
            </h3>
            {profile.missions.map((m) => {
              const ready = m.progress >= m.target && !m.claimed;
              const pct = Math.min(100, Math.round((m.progress / m.target) * 100));
              return (
                <div
                  key={m.id}
                  className="rounded-xl bg-[#161412] border border-white/10 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono uppercase text-[#D99B26]">{m.cadence}</span>
                      <span className="text-white/20">·</span>
                      <span className="font-mono text-[#C7BEB2]">
                        +{m.rewardCoins}c / +{m.rewardGems}g / +{m.rewardXp}xp
                      </span>
                    </div>
                    <div className="text-sm font-semibold text-[#F5EFE6] mt-0.5">{m.title}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-[#10B981]" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-mono tabular-nums text-[#C7BEB2]">
                        {m.progress}/{m.target}
                      </span>
                    </div>
                  </div>

                  {m.claimed ? (
                    <span className="text-xs font-semibold text-[#10B981] flex items-center gap-1 shrink-0">
                      <Check className="w-4 h-4" /> Claimed
                    </span>
                  ) : ready ? (
                    <button
                      type="button"
                      onClick={() => onClaimMission(m.id)}
                      className="min-h-[40px] px-4 rounded-xl bg-[#10B981] text-[#161412] text-xs font-extrabold cursor-pointer shrink-0"
                    >
                      Claim
                    </button>
                  ) : (
                    <span className="text-xs font-mono text-[#8C8377] shrink-0">In Progress</span>
                  )}
                </div>
              );
            })}
          </section>

          {/* Achievements */}
          <section className="flex flex-col gap-2.5">
            <h3 className="font-display text-base font-bold text-[#F5EFE6] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#E85D2A]" />
              Forge Achievements
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {profile.achievements.map((a) => (
                <div
                  key={a.id}
                  className={`rounded-xl p-3.5 border ${
                    a.unlocked
                      ? 'bg-[#262119] border-[#D99B26]/45'
                      : 'bg-[#161412] border-white/10 opacity-80'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#F5EFE6]">{a.title}</span>
                    <span className="font-mono text-[#38BDF8]">+{a.rewardGems}g</span>
                  </div>
                  <p className="text-xs text-[#C7BEB2] mt-1">{a.description}</p>
                  <div className="mt-2 text-[11px] font-mono tabular-nums text-[#D99B26]">
                    {a.unlocked ? 'Unlocked' : `${a.progress}/${a.target}`}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
