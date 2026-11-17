import React, { useState } from 'react';
import { ArrowRight, Coins, Gem, Minus, Plus, RefreshCw, X } from 'lucide-react';
import { GEM_TO_COINS_RATE } from '../config/economyConfig.ts';
import type { PlayerProfile } from '../types/game.ts';

interface ExchangeModalProps {
  profile: PlayerProfile;
  onExchange: (gemsToSpend: number) => { ok: boolean; coinsAdded: number; error?: string };
  onClose: () => void;
}

export const ExchangeModal: React.FC<ExchangeModalProps> = ({
  profile,
  onExchange,
  onClose,
}) => {
  const [gemAmount, setGemAmount] = useState(1);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const maxSpendable = profile.unlimitedCurrency ? 999 : Math.max(1, profile.gems);
  const coinsToReceive = gemAmount * GEM_TO_COINS_RATE;
  const canAfford = profile.unlimitedCurrency || profile.gems >= gemAmount;

  const setSafeAmount = (val: number) => {
    const clean = Math.max(1, Math.min(999, Math.floor(val) || 1));
    setGemAmount(clean);
    setFeedback(null);
  };

  const handleConfirm = () => {
    const res = onExchange(gemAmount);
    if (res.ok) {
      setFeedback({
        ok: true,
        text: `Converted ${gemAmount} Gem${gemAmount === 1 ? '' : 's'} into ${res.coinsAdded} Coins!`,
      });
    } else {
      setFeedback({
        ok: false,
        text: res.error ?? 'Not enough Gems for this exchange.',
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-[#D99B26]" />
            <h2 className="font-display text-xl font-extrabold text-[#F5EFE6]">
              Forge Currency Exchange
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close exchange"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#C7BEB2]">
          One-way workshop exchange: convert Gems into Coins at the fixed rate of{' '}
          <span className="font-mono font-bold text-[#D99B26]">1 Gem = {GEM_TO_COINS_RATE} Coins</span>.
        </p>

        {/* Current Balances */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex items-center justify-between">
            <span className="text-xs text-[#C7BEB2]">Gems</span>
            <span className="font-mono font-bold text-[#38BDF8] flex items-center gap-1">
              <Gem className="w-4 h-4" />
              {profile.unlimitedCurrency ? '∞' : profile.gems}
            </span>
          </div>
          <div className="rounded-xl bg-[#161412] border border-white/10 p-3 flex items-center justify-between">
            <span className="text-xs text-[#C7BEB2]">Coins</span>
            <span className="font-mono font-bold text-[#F5B041] flex items-center gap-1">
              <Coins className="w-4 h-4" />
              {profile.unlimitedCurrency ? '∞' : profile.coins}
            </span>
          </div>
        </div>

        {/* Amount Stepper */}
        <div className="rounded-xl bg-[#161412] border border-[#D99B26]/25 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-[#C7BEB2]">
            <span>Gems to Convert</span>
            <div className="flex gap-1.5">
              {[1, 5, 10].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSafeAmount(preset)}
                  className="px-2 py-1 rounded-md bg-[#221E1B] hover:bg-[#2E2925] font-mono text-[11px] font-bold text-[#D99B26] cursor-pointer"
                >
                  {preset}
                </button>
              ))}
              {!profile.unlimitedCurrency && profile.gems > 0 && (
                <button
                  type="button"
                  onClick={() => setSafeAmount(maxSpendable)}
                  className="px-2 py-1 rounded-md bg-[#221E1B] hover:bg-[#2E2925] font-mono text-[11px] font-bold text-[#38BDF8] cursor-pointer"
                >
                  MAX
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => setSafeAmount(gemAmount - 1)}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
              aria-label="Decrease gems"
            >
              <Minus className="w-4 h-4" />
            </button>
            <input
              type="number"
              min={1}
              max={999}
              value={gemAmount}
              onChange={(e) => setSafeAmount(Number(e.target.value))}
              className="w-24 text-center rounded-xl bg-[#221E1B] border border-white/15 py-2.5 text-lg font-mono font-bold text-[#F5EFE6] focus:outline-none focus:border-[#D99B26]"
            />
            <button
              type="button"
              onClick={() => setSafeAmount(gemAmount + 1)}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
              aria-label="Increase gems"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-center gap-3 pt-2 border-t border-white/10 text-sm font-mono font-bold">
            <span className="text-[#38BDF8] flex items-center gap-1">
              <Gem className="w-4 h-4" /> {gemAmount}
            </span>
            <ArrowRight className="w-4 h-4 text-[#C7BEB2]" />
            <span className="text-[#F5B041] flex items-center gap-1">
              <Coins className="w-4 h-4" /> {coinsToReceive}
            </span>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold text-center ${
              feedback.ok
                ? 'bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981]'
                : 'bg-red-950/60 border border-red-500/40 text-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <button
          type="button"
          disabled={!canAfford}
          onClick={handleConfirm}
          className="min-h-[48px] w-full rounded-xl bg-[#D99B26] hover:bg-[#E5AA38] disabled:bg-[#2C2621] disabled:text-[#8C8377] text-sm font-extrabold text-[#161412] cursor-pointer"
        >
          {canAfford
            ? `Convert ${gemAmount} Gem${gemAmount === 1 ? '' : 's'} → ${coinsToReceive} Coins`
            : 'Not Enough Gems'}
        </button>
      </div>
    </div>
  );
};
