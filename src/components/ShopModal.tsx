import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  Gem,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  X,
} from 'lucide-react';
import { BACKGROUNDS } from '../data/backgrounds.ts';
import {
  RARITY_COLORS,
  type AnyShopItem,
  type WeaponItem,
} from '../data/shopTypes.ts';
import { SKINS } from '../data/skins.ts';
import { THEMES } from '../data/themes.ts';
import { TRAILS } from '../data/trails.ts';
import { WEAPONS } from '../data/weapons.ts';
import type { CosmeticsEquipped, PlayerProfile, ShopCategory, ShopRarity } from '../types/game.ts';
import { ShopItemPreview } from './ShopItemPreview.tsx';

interface ShopModalProps {
  profile: PlayerProfile;
  onBuyAndEquip: (item: AnyShopItem) => { ok: boolean; error?: string };
  onEquipItem: (category: ShopCategory, itemId: string) => void;
  onOpenExchange: () => void;
  onClose: () => void;
}

const ITEMS_PER_PAGE = 24;

const TABS: { id: ShopCategory; label: string }[] = [
  { id: 'skins', label: 'Skins' },
  { id: 'weapons', label: 'Weapons' },
  { id: 'backgrounds', label: 'Backgrounds' },
  { id: 'themes', label: 'Themes' },
  { id: 'trails', label: 'Trails' },
];

const RARITIES: ('All' | ShopRarity)[] = ['All', 'Common', 'Rare', 'Epic', 'Legendary'];

function isItemOwned(profile: PlayerProfile, item: AnyShopItem): boolean {
  if (item.starter || item.price === 0) return true;
  if (item.category === 'skins') return profile.unlockedCosmetics.includes(item.id);
  if (item.category === 'weapons') return profile.unlockedWeapons.includes(item.id);
  if (item.category === 'backgrounds') return profile.unlockedBackgrounds.includes(item.id);
  if (item.category === 'themes') return profile.unlockedThemes.includes(item.id);
  return profile.unlockedTrails.includes(item.id);
}

function getEquippedId(equipped: CosmeticsEquipped, category: ShopCategory): string {
  if (category === 'skins') return equipped.skinId ?? 'skin_starter';
  if (category === 'weapons') return equipped.weaponId ?? 'weapon_starter_lance';
  if (category === 'backgrounds') return equipped.backgroundId ?? 'bg_starter_forge';
  if (category === 'themes') return equipped.themeId ?? 'theme_soft_sand';
  return equipped.trailId ?? 'trail_starter_spark';
}

export const ShopModal: React.FC<ShopModalProps> = ({
  profile,
  onBuyAndEquip,
  onEquipItem,
  onOpenExchange,
  onClose,
}) => {
  const [tab, setTab] = useState<ShopCategory>('skins');
  const [search, setSearch] = useState('');
  const [rarityFilter, setRarityFilter] = useState<'All' | ShopRarity>('All');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [confirmItem, setConfirmItem] = useState<AnyShopItem | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const catalogByTab: AnyShopItem[] = useMemo(() => {
    if (tab === 'skins') return SKINS;
    if (tab === 'weapons') return WEAPONS;
    if (tab === 'backgrounds') return BACKGROUNDS;
    if (tab === 'themes') return THEMES;
    return TRAILS;
  }, [tab]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogByTab.filter((item) => {
      if (rarityFilter !== 'All' && item.rarity !== rarityFilter) return false;
      if (ownedOnly && !isItemOwned(profile, item)) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [catalogByTab, rarityFilter, ownedOnly, search, profile]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const pagedItems = filtered.slice(
    safePage * ITEMS_PER_PAGE,
    (safePage + 1) * ITEMS_PER_PAGE
  );

  const equippedId = getEquippedId(profile.equipped, tab);

  const handleConfirmPurchase = () => {
    if (!confirmItem) return;
    const res = onBuyAndEquip(confirmItem);
    if (res.ok) {
      setConfirmItem(null);
      setBuyError(null);
    } else {
      setBuyError(res.error ?? 'Not enough currency.');
    }
  };

  const canAfford = (item: AnyShopItem): boolean => {
    if (profile.unlimitedCurrency || item.price === 0) return true;
    return item.currency === 'coins' ? profile.coins >= item.price : profile.gems >= item.price;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-2 sm:p-5">
      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-[#D99B26]" />
              <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[#F5EFE6]">
                Ink-Forge Shop
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums mt-1">
              <span className="flex items-center gap-1 text-[#F5B041] font-bold">
                <Coins className="w-3.5 h-3.5" /> {profile.unlimitedCurrency ? '∞' : profile.coins} Coins
              </span>
              <span className="flex items-center gap-1 text-[#38BDF8] font-bold">
                <Gem className="w-3.5 h-3.5" /> {profile.unlimitedCurrency ? '∞' : profile.gems} Gems
              </span>
              <button
                type="button"
                onClick={onOpenExchange}
                className="px-2 py-0.5 rounded-md bg-[#2C2621] hover:bg-[#38312B] border border-[#D99B26]/30 text-[11px] font-sans font-bold text-[#D99B26] flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Exchange Gems → Coins
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close shop"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Tabs */}
        <div className="px-4 sm:px-5 pt-3 flex gap-2 overflow-x-auto border-b border-white/5 pb-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                setPage(0);
              }}
              className={`min-h-[40px] px-4 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer ${
                tab === t.id ? 'bg-[#E85D2A] text-white' : 'bg-[#161412] text-[#C7BEB2] hover:text-[#F5EFE6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search & Filter Row */}
        <div className="px-4 sm:px-5 py-3 bg-[#1B1815] border-b border-white/10 flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 text-[#8C8377] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={`Search ${tab}...`}
              className="w-full rounded-xl bg-[#161412] border border-white/10 pl-9 pr-3 py-2 text-xs text-[#F5EFE6] placeholder:text-[#8C8377] focus:outline-none focus:border-[#D99B26]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {RARITIES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  setRarityFilter(r);
                  setPage(0);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                  rarityFilter === r
                    ? 'bg-[#D99B26] text-[#161412]'
                    : 'bg-[#161412] text-[#C7BEB2] hover:text-white'
                }`}
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setOwnedOnly((prev) => !prev);
                setPage(0);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer border ${
                ownedOnly
                  ? 'bg-[#10B981]/20 border-[#10B981]/50 text-[#10B981]'
                  : 'bg-[#161412] border-white/10 text-[#C7BEB2]'
              }`}
            >
              Owned
            </button>
          </div>
        </div>

        {/* Paged Grid */}
        <div className="flex-1 overflow-y-auto forge-scroll p-4 sm:p-5">
          {pagedItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#A39A8E]">
              No items match your current filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {pagedItems.map((item) => {
                const owned = isItemOwned(profile, item);
                const equipped = equippedId === item.id;
                const rarityStyle = RARITY_COLORS[item.rarity];
                const weaponStats = item.category === 'weapons' ? (item as WeaponItem).stats : null;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-3.5 border flex flex-col gap-2.5 ${
                      equipped
                        ? 'bg-[#2C241D] border-[#E85D2A]'
                        : `bg-[#161412] ${rarityStyle.border}`
                    }`}
                  >
                    <ShopItemPreview item={item} size="sm" />

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-display font-bold text-sm text-[#F5EFE6] truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-[#A39A8E] line-clamp-2 mt-0.5">
                          {item.description}
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${rarityStyle.badge}`}
                      >
                        {item.rarity}
                      </span>
                    </div>

                    {weaponStats && (
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-[#C7BEB2] pt-1 border-t border-white/5">
                        <div>
                          <div className="flex justify-between">
                            <span>Damage</span>
                            <span className="font-mono text-[#F5EFE6]">{Math.round(weaponStats.damage * 100)}%</span>
                          </div>
                          <div className="h-1 rounded bg-white/10 overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-[#E85D2A]"
                              style={{ width: `${Math.min(100, Math.round((weaponStats.damage / 1.6) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between">
                            <span>Impact</span>
                            <span className="font-mono text-[#F5EFE6]">{Math.round(weaponStats.impactForce * 100)}%</span>
                          </div>
                          <div className="h-1 rounded bg-white/10 overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-[#D99B26]"
                              style={{ width: `${Math.min(100, Math.round((weaponStats.impactForce / 1.7) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between">
                            <span>Speed</span>
                            <span className="font-mono text-[#F5EFE6]">{Math.round(weaponStats.speedModifier * 100)}%</span>
                          </div>
                          <div className="h-1 rounded bg-white/10 overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-[#10B981]"
                              style={{ width: `${Math.min(100, Math.round((weaponStats.speedModifier / 1.25) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between">
                            <span>Weight</span>
                            <span className="font-mono text-[#F5EFE6]">{weaponStats.weight.toFixed(2)}x</span>
                          </div>
                          <div className="h-1 rounded bg-white/10 overflow-hidden mt-0.5">
                            <div
                              className="h-full bg-[#38BDF8]"
                              style={{ width: `${Math.min(100, Math.round((weaponStats.weight / 1.55) * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div className="col-span-2 text-[10px] font-semibold text-[#D99B26] mt-0.5">
                          Trait: {weaponStats.specialLabel} · {weaponStats.tier}
                        </div>
                      </div>
                    )}

                    <div className="mt-auto pt-1 flex items-center justify-between gap-2">
                      {equipped ? (
                        <span className="w-full min-h-[38px] rounded-lg bg-[#10B981]/15 border border-[#10B981]/40 text-xs font-bold text-[#10B981] flex items-center justify-center gap-1">
                          <Check className="w-4 h-4" /> Equipped
                        </span>
                      ) : owned ? (
                        <button
                          type="button"
                          onClick={() => onEquipItem(item.category, item.id)}
                          className="w-full min-h-[38px] rounded-lg bg-[#2C2621] hover:bg-[#38312B] text-xs font-bold text-[#F5EFE6] cursor-pointer"
                        >
                          Owned · Equip
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBuyError(null);
                            setConfirmItem(item);
                          }}
                          className="w-full min-h-[38px] rounded-lg bg-[#D99B26] hover:bg-[#E5AA38] text-xs font-extrabold text-[#161412] flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {item.currency === 'coins' ? (
                            <Coins className="w-3.5 h-3.5" />
                          ) : (
                            <Gem className="w-3.5 h-3.5" />
                          )}
                          <span>
                            Buy · {item.price} {item.currency === 'coins' ? 'Coins' : 'Gems'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination Footer */}
        <div className="px-4 sm:px-5 py-3 border-t border-white/10 bg-[#1B1815] flex items-center justify-between text-xs text-[#C7BEB2]">
          <span>
            Showing {filtered.length} {tab}
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="min-h-[36px] px-2.5 rounded-lg bg-[#2C2621] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              <span className="font-mono">
                Page {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="min-h-[36px] px-2.5 rounded-lg bg-[#2C2621] disabled:opacity-40 flex items-center gap-1 cursor-pointer"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Purchase Confirmation Dialog */}
      {confirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#221E1B] border border-[#D99B26]/40 p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-extrabold text-[#F5EFE6]">
                Confirm Purchase
              </h3>
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="min-h-[36px] min-w-[36px] rounded-lg bg-[#2C2621] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ShopItemPreview item={confirmItem} size="lg" />

            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold text-base text-[#F5EFE6]">
                  {confirmItem.name}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${RARITY_COLORS[confirmItem.rarity].badge}`}>
                  {confirmItem.rarity}
                </span>
              </div>
              <p className="text-xs text-[#C7BEB2] mt-1">{confirmItem.description}</p>
            </div>

            {(!canAfford(confirmItem) || buyError) && (
              <div className="rounded-xl bg-red-950/60 border border-red-500/40 p-3 flex flex-col gap-2 text-xs text-red-200">
                <span>
                  {buyError ??
                    `Not enough ${confirmItem.currency === 'coins' ? 'Coins' : 'Gems'} (need ${confirmItem.price}).`}
                </span>
                {confirmItem.currency === 'coins' && !profile.unlimitedCurrency && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmItem(null);
                      onOpenExchange();
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-[#D99B26] text-[#161412] font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Convert Gems to Coins (1 Gem = 50 Coins)
                  </button>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmItem(null)}
                className="flex-1 min-h-[44px] rounded-xl bg-[#2C2621] text-xs font-bold text-[#F5EFE6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!canAfford(confirmItem)}
                onClick={handleConfirmPurchase}
                className="flex-1 min-h-[44px] rounded-xl bg-[#D99B26] disabled:bg-[#2C2621] disabled:text-[#8C8377] text-xs font-extrabold text-[#161412] flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>
                  {profile.unlimitedCurrency
                    ? 'Unlock & Equip (∞)'
                    : `Pay ${confirmItem.price} ${confirmItem.currency === 'coins' ? 'Coins' : 'Gems'}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
