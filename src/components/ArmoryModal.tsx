import React, { useState } from 'react';
import { Check, Coins, Gem, Lock, X } from 'lucide-react';
import { COSMETIC_CATALOG, RIDER_CATALOG } from '../data/gameCatalog.ts';
import type { CosmeticsEquipped, PlayerProfile } from '../types/game.ts';

interface ArmoryModalProps {
  profile: PlayerProfile;
  onUnlockAndEquip: (itemId: string, costCoins: number, costGems: number, patch: Partial<CosmeticsEquipped>) => void;
  onEquip: (patch: Partial<CosmeticsEquipped>) => void;
  onClose: () => void;
}

type TabKey = 'riders' | 'ink' | 'lance' | 'wheel';

export const ArmoryModal: React.FC<ArmoryModalProps> = ({
  profile,
  onUnlockAndEquip,
  onEquip,
  onClose,
}) => {
  const [tab, setTab] = useState<TabKey>('riders');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#F5EFE6]">
              Clockwork Workshop &amp; Skins
            </h2>
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums mt-1">
              <span className="flex items-center gap-1 text-[#F5B041]">
                <Coins className="w-3.5 h-3.5" /> {profile.unlimitedCurrency ? '∞' : profile.coins} Coins
              </span>
              <span className="flex items-center gap-1 text-[#38BDF8]">
                <Gem className="w-3.5 h-3.5" /> {profile.unlimitedCurrency ? '∞' : profile.gems} Gems
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close workshop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-4 sm:px-5 pt-3 flex gap-2 overflow-x-auto">
          {(
            [
              { id: 'riders', label: 'Riders' },
              { id: 'ink', label: 'Ink Trails' },
              { id: 'lance', label: 'Lances' },
              { id: 'wheel', label: 'Chassis Finishes' },
            ] as { id: TabKey; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                tab === t.id ? 'bg-[#E85D2A] text-white' : 'bg-[#161412] text-[#C7BEB2]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="p-4 sm:p-5 overflow-y-auto forge-scroll grid grid-cols-1 sm:grid-cols-2 gap-3">
          {tab === 'riders'
            ? RIDER_CATALOG.map((rider) => {
                const unlocked = profile.unlockedCosmetics.includes(rider.id);
                const equipped = profile.equipped.riderId === rider.id;
                const affordable =
                  profile.unlimitedCurrency ||
                  (profile.coins >= rider.costCoins && profile.gems >= rider.costGems);
                return (
                  <div
                    key={rider.id}
                    className={`rounded-xl p-4 border flex items-center justify-between gap-3 ${
                      equipped ? 'bg-[#2C241D] border-[#E85D2A]' : 'bg-[#161412] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full border-2 border-[#161412] shrink-0 flex items-center justify-center"
                        style={{ backgroundColor: rider.primaryColor }}
                      >
                        <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: rider.visorColor }} />
                      </div>
                      <div>
                        <div className="font-display font-bold text-[#F5EFE6]">{rider.name}</div>
                        <div className="text-xs text-[#C7BEB2]">{rider.title}</div>
                      </div>
                    </div>
                    {equipped ? (
                      <span className="text-xs font-bold text-[#10B981] flex items-center gap-1">
                        <Check className="w-4 h-4" /> Equipped
                      </span>
                    ) : unlocked ? (
                      <button
                        type="button"
                        onClick={() => onEquip({ riderId: rider.id })}
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#2C2621] hover:bg-[#38312B] text-xs font-bold text-[#F5EFE6] cursor-pointer"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() =>
                          onUnlockAndEquip(rider.id, rider.costCoins, rider.costGems, { riderId: rider.id })
                        }
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#D99B26] disabled:bg-[#2C2621] disabled:text-[#8C8377] text-xs font-extrabold text-[#161412] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {rider.costCoins > 0 ? `${rider.costCoins}c` : `${rider.costGems}g`}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })
            : COSMETIC_CATALOG.filter((c) => c.category === tab).map((item) => {
                const unlocked = profile.unlockedCosmetics.includes(item.id);
                const patchKey =
                  item.category === 'ink'
                    ? 'inkStyleId'
                    : item.category === 'lance'
                    ? 'lanceSkinId'
                    : 'wheelFinishId';
                const equipped = profile.equipped[patchKey] === item.id;
                const affordable =
                  profile.unlimitedCurrency ||
                  (profile.coins >= item.costCoins && profile.gems >= item.costGems);
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-4 border flex items-center justify-between gap-3 ${
                      equipped ? 'bg-[#2C241D] border-[#E85D2A]' : 'bg-[#161412] border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl border border-white/20 shrink-0"
                        style={{ backgroundColor: item.color }}
                      />
                      <div>
                        <div className="font-display font-bold text-[#F5EFE6]">{item.name}</div>
                        <div className="text-xs text-[#C7BEB2]">{item.description}</div>
                      </div>
                    </div>
                    {equipped ? (
                      <span className="text-xs font-bold text-[#10B981] flex items-center gap-1">
                        <Check className="w-4 h-4" /> Equipped
                      </span>
                    ) : unlocked ? (
                      <button
                        type="button"
                        onClick={() => onEquip({ [patchKey]: item.id })}
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#2C2621] hover:bg-[#38312B] text-xs font-bold text-[#F5EFE6] cursor-pointer"
                      >
                        Equip
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!affordable}
                        onClick={() =>
                          onUnlockAndEquip(item.id, item.costCoins, item.costGems, { [patchKey]: item.id })
                        }
                        className="min-h-[40px] px-3.5 rounded-lg bg-[#D99B26] disabled:bg-[#2C2621] disabled:text-[#8C8377] text-xs font-extrabold text-[#161412] flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Lock className="w-3.5 h-3.5" />
                        <span>
                          {item.costCoins > 0 ? `${item.costCoins}c` : `${item.costGems}g`}
                        </span>
                      </button>
                    )}
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
};
