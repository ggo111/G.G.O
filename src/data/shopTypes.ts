import type { CurrencyType, ShopCategory, ShopRarity } from '../types/game.ts';

export type SkinBodyStyle =
  | 'cart'
  | 'wheel'
  | 'sled'
  | 'beetle'
  | 'rocket_pod'
  | 'ship'
  | 'mech'
  | 'dragon'
  | 'monowheel'
  | 'crawler'
  | 'catamaran'
  | 'clockwork_walker'
  | 'drill_ram';

export type SkinPattern = 'stripes' | 'dots' | 'camo' | 'gradient' | 'metal' | 'glow';

export type SkinAccessory =
  | 'none'
  | 'flags'
  | 'horns'
  | 'wings'
  | 'armor'
  | 'ribbons'
  | 'antenna'
  | 'crown';

export interface SkinRenderParams {
  bodyStyle: SkinBodyStyle;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: SkinPattern;
  accessory: SkinAccessory;
  visorColor: string;
}

export type WeaponArchetype = 'lance' | 'spear' | 'hammer' | 'shield' | 'blade';
export type WeaponSpecialEffect =
  | 'none'
  | 'agile_poke'
  | 'pierce_shield'
  | 'heavy_crush'
  | 'guard_absorb'
  | 'shock';
export type WeaponTier = 'Starter' | 'Standard' | 'Advanced' | 'Elite' | 'Legendary';

export interface WeaponRenderParams {
  archetype: WeaponArchetype;
  shaftColor: string;
  headColor: string;
  accentColor: string;
  lengthScale: number;
  headScale: number;
  glow?: boolean;
}

export interface WeaponStats {
  tier: WeaponTier;
  damage: number; // 0.65 .. 1.55 multiplier
  impactForce: number; // 0.65 .. 1.65 knockback multiplier
  speedModifier: number; // 0.78 .. 1.18 rig move speed multiplier
  weight: number; // 0.70 .. 1.50 mass multiplier
  cooldownMs: number; // hit/swing recovery in ms (350 .. 1100)
  specialEffect: WeaponSpecialEffect;
  specialLabel: string;
  blocksHead?: boolean;
  blockReduction?: number; // 0..1 damage reduction when blocking the head
}

export type BackgroundTemplate =
  | 'meadow'
  | 'desert'
  | 'snow'
  | 'city'
  | 'space'
  | 'reef'
  | 'forest'
  | 'volcano'
  | 'clouds'
  | 'cyber'
  | 'garden'
  | 'beach'
  | 'castle'
  | 'minimal';

export type BackgroundTimeOfDay = 'dawn' | 'day' | 'dusk' | 'night';
export type BackgroundWeather = 'clear' | 'breeze' | 'mist' | 'sparks' | 'snowfall';

export interface BackgroundRenderParams {
  template: BackgroundTemplate;
  skyTop: string;
  skyBottom: string;
  hillFar: string;
  hillNear: string;
  accentColor: string;
  timeOfDay: BackgroundTimeOfDay;
  weather: BackgroundWeather;
  seed: number;
}

export interface ThemeRenderParams {
  bgPrimary: string;
  bgSurface: string;
  bgSurfaceAlt: string;
  accentPrimary: string;
  accentSecondary: string;
  textPrimary: string;
  textMuted: string;
  borderColor: string;
  buttonStyle: 'rounded' | 'chamfer' | 'soft';
  fontFamily: string;
  arenaTint: string;
  particleStyle: 'sparks' | 'ink' | 'leaves' | 'stars' | 'snow';
}

export type TrailStyle =
  | 'spark'
  | 'flame'
  | 'frost'
  | 'rainbow'
  | 'ink'
  | 'stars'
  | 'smoke'
  | 'lightning'
  | 'petals'
  | 'bubbles'
  | 'confetti'
  | 'shadow'
  | 'gold'
  | 'plasma'
  | 'pixel';

export interface TrailRenderParams {
  style: TrailStyle;
  primaryColor: string;
  secondaryColor: string;
  particleSize: number;
  density: number;
  hitRingColor: string;
}

export interface ShopItemBase<TParams = Record<string, unknown>> {
  id: string;
  name: string;
  category: ShopCategory;
  rarity: ShopRarity;
  price: number;
  currency: CurrencyType;
  description: string;
  starter?: boolean;
  renderParams: TParams;
}

export type SkinItem = ShopItemBase<SkinRenderParams> & { category: 'skins' };
export type WeaponItem = ShopItemBase<WeaponRenderParams> & {
  category: 'weapons';
  stats: WeaponStats;
};
export type BackgroundItem = ShopItemBase<BackgroundRenderParams> & { category: 'backgrounds' };
export type ThemeItem = ShopItemBase<ThemeRenderParams> & { category: 'themes' };
export type TrailItem = ShopItemBase<TrailRenderParams> & { category: 'trails' };

export type AnyShopItem = SkinItem | WeaponItem | BackgroundItem | ThemeItem | TrailItem;

export const RARITY_COLORS: Record<ShopRarity, { badge: string; border: string; text: string }> = {
  Common: {
    badge: 'bg-[#2C2621] text-[#D7CFC4]',
    border: 'border-white/15',
    text: '#D7CFC4',
  },
  Rare: {
    badge: 'bg-[#172554] text-[#60A5FA]',
    border: 'border-[#3B82F6]/45',
    text: '#60A5FA',
  },
  Epic: {
    badge: 'bg-[#3B0764] text-[#C084FC]',
    border: 'border-[#A855F7]/50',
    text: '#C084FC',
  },
  Legendary: {
    badge: 'bg-[#451A03] text-[#FBBF24]',
    border: 'border-[#F59E0B]/65',
    text: '#FBBF24',
  },
};
