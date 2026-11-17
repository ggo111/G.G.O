import React from 'react';
import { Check, Shield, Swords, X } from 'lucide-react';
import { RARITY_COLORS } from '../data/shopTypes.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { PlayerProfile } from '../types/game.ts';
import { ShopItemPreview } from './ShopItemPreview.tsx';

interface LoadoutModalProps {
  profile: PlayerProfile;
  onSelectWeapon: (weaponId: string) => void;
  onOpenShop: () => void;
  onClose: () => void;
}

export const LoadoutModal: React.FC<LoadoutModalProps> = ({
  profile,
  onSelectWeapon,
  onOpenShop,
  onClose,
}) => {
  const unlockedSet = new Set(profile.unlockedWeapons);
  const ownedWeapons = WEAPONS.filter((w) => w.starter || w.price === 0 || unlockedSet.has(w.id));
  const equippedId = profile.equipped.weaponId ?? 'weapon_starter_lance';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 flex flex-col overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-[#D99B26]" />
              <h2 className="font-display text-xl font-extrabold text-[#F5EFE6]">
                Battle Weapon Loadout
              </h2>
            </div>
            <p className="text-xs text-[#C7BEB2] mt-0.5">
              Hammers crush Spears · Spears pierce Shields · Shields absorb Hammers
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close loadout"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto forge-scroll p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ownedWeapons.map((w) => {
            const equipped = equippedId === w.id;
            const rStyle = RARITY_COLORS[w.rarity];
            return (
              <div
                key={w.id}
                className={`rounded-xl border p-3.5 flex flex-col gap-2.5 ${
                  equipped ? 'bg-[#2C241D] border-[#E85D2A]' : `bg-[#161412] ${rStyle.border}`
                }`}
              >
                <ShopItemPreview item={w} size="sm" />
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-display font-bold text-sm text-[#F5EFE6]">{w.name}</div>
                    <div className="text-[11px] text-[#D99B26] font-semibold">
                      {w.stats.tier} · {w.stats.specialLabel}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rStyle.badge}`}>
                    {w.rarity}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#C7BEB2]">
                  <div>Damage: <span className="font-mono text-[#F5EFE6]">{Math.round(w.stats.damage * 100)}%</span></div>
                  <div>Impact: <span className="font-mono text-[#F5EFE6]">{Math.round(w.stats.impactForce * 100)}%</span></div>
                  <div>Speed: <span className="font-mono text-[#F5EFE6]">{Math.round(w.stats.speedModifier * 100)}%</span></div>
                  <div>Weight: <span className="font-mono text-[#F5EFE6]">{w.stats.weight.toFixed(2)}x</span></div>
                </div>

                {equipped ? (
                  <div className="min-h-[38px] rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-bold text-[#10B981] flex items-center justify-center gap-1 mt-auto">
                    <Check className="w-4 h-4" /> Equipped for Battle
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectWeapon(w.id)}
                    className="min-h-[38px] rounded-lg bg-[#2C2621] hover:bg-[#38312B] text-xs font-bold text-[#F5EFE6] cursor-pointer mt-auto"
                  >
                    Equip Weapon
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-white/10 bg-[#1B1815] flex items-center justify-between gap-3">
          <span className="text-xs text-[#A39A8E] flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#D99B26]" />
            {ownedWeapons.length} / {WEAPONS.length} weapons unlocked
          </span>
          <button
            type="button"
            onClick={onOpenShop}
            className="min-h-[40px] px-4 rounded-xl bg-[#D99B26] hover:bg-[#E5AA38] text-xs font-extrabold text-[#161412] cursor-pointer"
          >
            Browse All 60 Weapons in Shop
          </button>
        </div>
      </div>
    </div>
  );
};
