import React from 'react';
import { Bot, Coins, Flame, Gem, Home, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import type { MatchMode, MatchRewardSummary } from '../types/game.ts';

interface MatchSummaryModalProps {
  mode: MatchMode;
  summary: MatchRewardSummary;
  onPlayAgain: () => void;
  onBackHome: () => void;
}

export const MatchSummaryModal: React.FC<MatchSummaryModalProps> = ({
  mode,
  summary,
  onPlayAgain,
  onBackHome,
}) => {
  const isRoom = mode === 'online_room' || mode === 'hotspot_room';

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/40 p-6 flex flex-col gap-5 text-center">
        <div className="flex flex-col items-center gap-2">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              summary.won
                ? 'bg-[#D99B26]/20 border border-[#D99B26]/50 text-[#D99B26]'
                : 'bg-[#2C2621] border border-white/10 text-[#C7BEB2]'
            }`}
          >
            <Trophy className="w-7 h-7" />
          </div>
          <div className="text-xs font-mono text-[#D99B26]">
            ROUND SCORE {summary.roundsWon} – {summary.roundsLost}
          </div>
          <h2 className="font-display text-3xl font-extrabold text-[#F5EFE6]">
            {summary.won ? 'Forge Victory!' : 'Defeated in the Clash'}
          </h2>
          <p className="text-xs text-[#C7BEB2]">{summary.koReason}</p>
          {summary.isBotMatch && (
            <span className="inline-flex items-center gap-1 text-[11px] font-mono text-[#38BDF8] mt-0.5">
              <Bot className="w-3.5 h-3.5" />
              Bot Match (Fallback Opponent)
            </span>
          )}
        </div>

        {/* Rewards Breakdown */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
            <div className="text-[11px] text-[#C7BEB2]">Coins</div>
            <div className="font-mono tabular-nums text-base font-bold text-[#F5B041] flex items-center justify-center gap-1 mt-0.5">
              <Coins className="w-4 h-4" />+{summary.coinsEarned}
            </div>
          </div>
          <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
            <div className="text-[11px] text-[#C7BEB2]">Gems</div>
            <div className="font-mono tabular-nums text-base font-bold text-[#38BDF8] flex items-center justify-center gap-1 mt-0.5">
              <Gem className="w-4 h-4" />+{summary.gemsEarned}
            </div>
          </div>
          <div className="rounded-xl bg-[#161412] border border-white/10 p-3">
            <div className="text-[11px] text-[#C7BEB2]">Forge XP</div>
            <div className="font-mono tabular-nums text-base font-bold text-[#10B981] flex items-center justify-center gap-1 mt-0.5">
              <Sparkles className="w-4 h-4" />+{summary.xpEarned}
            </div>
          </div>
        </div>

        {(summary.streakBonusCoins > 0 || summary.leveledUp || summary.trophyDelta !== undefined) && (
          <div className="rounded-xl bg-[#2A2118] border border-[#D99B26]/35 px-4 py-2.5 text-xs text-[#F5EFE6] flex flex-col gap-1">
            {summary.trophyDelta !== undefined && (
              <div
                className={`flex items-center justify-center gap-1.5 font-bold ${
                  summary.trophyDelta >= 0 ? 'text-[#F5B041]' : 'text-[#EF4444]'
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>
                  Ranked Trophies: {summary.trophyDelta >= 0 ? `+${summary.trophyDelta}` : summary.trophyDelta} (Total {summary.newTrophies})
                </span>
              </div>
            )}
            {summary.streakBonusCoins > 0 && (
              <div className="flex items-center justify-center gap-1.5 text-[#E85D2A] font-bold">
                <Flame className="w-4 h-4" />
                Win Streak Bonus: +{summary.streakBonusCoins} Coins
              </div>
            )}
            {summary.leveledUp && (
              <div className="font-bold text-[#10B981]">
                Level Up! Reached Forge Level {summary.newLevel} (+3 Gems)
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onPlayAgain}
            className="flex-1 min-h-[48px] px-4 rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] text-sm font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>{isRoom ? 'Quick Rematch' : 'Play Again'}</span>
          </button>
          <button
            type="button"
            onClick={onBackHome}
            className="min-h-[48px] px-4 rounded-xl bg-[#2C2621] hover:bg-[#38312B] text-sm font-semibold text-[#F5EFE6] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Forge Menu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
