import React, { useState } from 'react';
import { CheckCircle2, Sparkles, Ticket, X } from 'lucide-react';
import type { PlayerProfile } from '../types/game.ts';

interface PromoCodeModalProps {
  profile: PlayerProfile;
  onApplyCode: (input: string) => { ok: boolean; name?: string; message: string };
  onClose: () => void;
}

export const PromoCodeModal: React.FC<PromoCodeModalProps> = ({
  profile,
  onApplyCode,
  onClose,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    profile.unlimitedCurrency && profile.promoApplied
      ? { ok: true, text: `Welcome ${profile.promoApplied}` }
      : null
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const res = onApplyCode(codeInput);
    setFeedback({ ok: res.ok, text: res.message });
    if (res.ok) {
      setCodeInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 p-5 sm:p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-[#D99B26]" />
            <h2 className="font-display text-xl font-extrabold text-[#F5EFE6]">
              Promo Code
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close promo dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-[#C7BEB2]">
          Enter a workshop creator or VIP promo code to unlock unlimited Coins and Gems (∞).
        </p>

        {profile.unlimitedCurrency && (
          <div className="rounded-xl bg-[#10B981]/15 border border-[#10B981]/35 p-3 flex items-center gap-2.5 text-xs text-[#10B981] font-semibold">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span>
              Unlimited Forge Vault active{profile.promoApplied ? ` (${profile.promoApplied})` : ''}: ∞ Coins &amp; ∞ Gems
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              if (feedback && !feedback.ok) setFeedback(null);
            }}
            placeholder="Enter promo code..."
            autoFocus
            maxLength={40}
            className="w-full rounded-xl bg-[#161412] border border-white/15 px-3.5 py-3 text-sm font-semibold text-[#F5EFE6] placeholder:text-[#8C8377] focus:outline-none focus:border-[#D99B26]"
          />

          {feedback && (
            <div
              className={`rounded-xl px-3.5 py-2.5 text-xs font-semibold flex items-center gap-2 ${
                feedback.ok
                  ? 'bg-[#10B981]/15 border border-[#10B981]/40 text-[#10B981]'
                  : 'bg-red-950/60 border border-red-500/40 text-red-200'
              }`}
            >
              {feedback.ok && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              <span>{feedback.text}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!codeInput.trim()}
            className="min-h-[48px] w-full rounded-xl bg-[#D99B26] hover:bg-[#E5AA38] disabled:bg-[#2C2621] disabled:text-[#8C8377] text-sm font-extrabold text-[#161412] cursor-pointer"
          >
            Redeem Code
          </button>
        </form>
      </div>
    </div>
  );
};
