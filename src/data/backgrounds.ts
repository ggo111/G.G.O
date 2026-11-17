import type { CurrencyType, ShopRarity } from '../types/game.ts';
import type {
  BackgroundItem,
  BackgroundTemplate,
  BackgroundTimeOfDay,
  BackgroundWeather,
} from './shopTypes.ts';

interface BgPalette {
  name: string;
  skyTop: string;
  skyBottom: string;
  hillFar: string;
  hillNear: string;
  accent: string;
  timeOfDay: BackgroundTimeOfDay;
}

const TEMPLATES: { template: BackgroundTemplate; label: string; rarityBase: number }[] = [
  { template: 'meadow', label: 'Meadow', rarityBase: 0 },
  { template: 'desert', label: 'Dunes', rarityBase: 0 },
  { template: 'beach', label: 'Shore', rarityBase: 0 },
  { template: 'minimal', label: 'Draft', rarityBase: 0 },
  { template: 'forest', label: 'Woods', rarityBase: 1 },
  { template: 'snow', label: 'Peaks', rarityBase: 1 },
  { template: 'clouds', label: 'Skyline', rarityBase: 1 },
  { template: 'garden', label: 'Terrace', rarityBase: 1 },
  { template: 'city', label: 'Spire', rarityBase: 2 },
  { template: 'reef', label: 'Lagoon', rarityBase: 2 },
  { template: 'castle', label: 'Citadel', rarityBase: 2 },
  { template: 'volcano', label: 'Caldera', rarityBase: 3 },
  { template: 'cyber', label: 'Grid', rarityBase: 3 },
  { template: 'space', label: 'Nebula', rarityBase: 4 },
];

const BG_PALETTES: BgPalette[] = [
  { name: 'Morning Sage', skyTop: '#1A2E2B', skyBottom: '#2B4C43', hillFar: '#3B665A', hillNear: '#1D352E', accent: '#6EE7B7', timeOfDay: 'dawn' },
  { name: 'Sunlit Ochre', skyTop: '#2E2218', skyBottom: '#573B23', hillFar: '#784F2A', hillNear: '#3B2818', accent: '#FBBF24', timeOfDay: 'day' },
  { name: 'Twilight Plum', skyTop: '#1F162B', skyBottom: '#432B5C', hillFar: '#5B3A7D', hillNear: '#271936', accent: '#E879F9', timeOfDay: 'dusk' },
  { name: 'Midnight Cobalt', skyTop: '#0B1324', skyBottom: '#1B2D4F', hillFar: '#274270', hillNear: '#111E36', accent: '#38BDF8', timeOfDay: 'night' },
  { name: 'Rosewood Dawn', skyTop: '#2C1821', skyBottom: '#5E2D3C', hillFar: '#7A3D4F', hillNear: '#381B25', accent: '#FDA4AF', timeOfDay: 'dawn' },
  { name: 'Glacier Mist', skyTop: '#13222E', skyBottom: '#2B4659', hillFar: '#466A82', hillNear: '#1E3342', accent: '#BAE6FD', timeOfDay: 'day' },
  { name: 'Copper Forge', skyTop: '#1C1410', skyBottom: '#452719', hillFar: '#6E3A21', hillNear: '#291A13', accent: '#F97316', timeOfDay: 'dusk' },
  { name: 'Emerald Vale', skyTop: '#0D2419', skyBottom: '#1C4B34', hillFar: '#2A6E4D', hillNear: '#133324', accent: '#34D399', timeOfDay: 'day' },
  { name: 'Slate Horizon', skyTop: '#181B20', skyBottom: '#313742', hillFar: '#4B5563', hillNear: '#1F242D', accent: '#CBD5E1', timeOfDay: 'dusk' },
  { name: 'Aurora Deep', skyTop: '#0B1A26', skyBottom: '#163E4D', hillFar: '#1F5C63', hillNear: '#0E2930', accent: '#2DD4BF', timeOfDay: 'night' },
  { name: 'Amber Dusk', skyTop: '#26170E', skyBottom: '#5C3418', hillFar: '#854B20', hillNear: '#331E10', accent: '#FDE047', timeOfDay: 'dusk' },
  { name: 'Velvet Indigo', skyTop: '#110F29', skyBottom: '#272159', hillFar: '#3B3280', hillNear: '#19153D', accent: '#A78BFA', timeOfDay: 'night' },
  { name: 'Coral Breeze', skyTop: '#291B20', skyBottom: '#5C3742', hillFar: '#824B5A', hillNear: '#362128', accent: '#FB7185', timeOfDay: 'dawn' },
  { name: 'Obsidian Ember', skyTop: '#141112', skyBottom: '#331819', hillFar: '#542323', hillNear: '#1F1314', accent: '#EF4444', timeOfDay: 'night' },
  { name: 'Ivory Parchment', skyTop: '#26211B', skyBottom: '#4A4034', hillFar: '#665949', hillNear: '#2E2820', accent: '#F5EFE6', timeOfDay: 'day' },
];

const WEATHERS: { weather: BackgroundWeather; tag: string; weight: number }[] = [
  { weather: 'clear', tag: 'Calm', weight: 0 },
  { weather: 'breeze', tag: 'Breezy', weight: 0 },
  { weather: 'mist', tag: 'Misty', weight: 1 },
  { weather: 'snowfall', tag: 'Drifting', weight: 2 },
  { weather: 'sparks', tag: 'Radiant', weight: 2 },
];

function computeBgPricing(score: number, idx: number): {
  rarity: ShopRarity;
  price: number;
  currency: CurrencyType;
} {
  if (score <= 1) {
    return {
      rarity: 'Common',
      price: 100 + ((idx * 29) % 195), // 100..294 Coins
      currency: 'coins',
    };
  }
  if (score <= 3) {
    return {
      rarity: 'Rare',
      price: 410 + ((idx * 53) % 480), // 410..889 Coins
      currency: 'coins',
    };
  }
  if (score <= 4) {
    if (idx % 2 === 0) {
      return {
        rarity: 'Epic',
        price: 1550 + ((idx * 197) % 2350), // 1550..3899 Coins
        currency: 'coins',
      };
    }
    return {
      rarity: 'Epic',
      price: 30 + ((idx * 9) % 50), // 30..79 Gems
      currency: 'gems',
    };
  }
  return {
    rarity: 'Legendary',
    price: 105 + ((idx * 17) % 190), // 105..294 Gems
    currency: 'gems',
  };
}

function generateProceduralBackgrounds(): BackgroundItem[] {
  const list: BackgroundItem[] = [
    {
      id: 'bg_starter_forge',
      name: 'Ink-Forge Dusk',
      category: 'backgrounds',
      rarity: 'Common',
      price: 0,
      currency: 'coins',
      starter: true,
      description: 'Free starter warm charcoal drafting horizon.',
      renderParams: {
        template: 'minimal',
        skyTop: '#161412',
        skyBottom: '#241E1A',
        hillFar: '#2E2620',
        hillNear: '#1E1915',
        accentColor: '#D99B26',
        timeOfDay: 'dusk',
        weather: 'clear',
        seed: 1,
      },
    },
  ];

  const usedNames = new Set<string>(['Ink-Forge Dusk']);
  let idx = 0;

  for (let t = 0; t < TEMPLATES.length; t++) {
    const tpl = TEMPLATES[t];
    for (let p = 0; p < BG_PALETTES.length; p++) {
      const pal = BG_PALETTES[p];
      const w = WEATHERS[(t * 3 + p * 2 + idx) % WEATHERS.length];
      let name = `${pal.name} ${tpl.label}`;
      if (usedNames.has(name)) {
        name = `${w.tag} ${pal.name} ${tpl.label}`;
      }
      usedNames.add(name);

      const score = tpl.rarityBase + w.weight;
      const pricing = computeBgPricing(score, idx);

      list.push({
        id: `bg_${tpl.template}_${p}_${idx}`,
        name,
        category: 'backgrounds',
        rarity: pricing.rarity,
        price: pricing.price,
        currency: pricing.currency,
        description: `${w.tag} ${pal.timeOfDay} ${tpl.template} horizon with layered parallax silhouettes.`,
        renderParams: {
          template: tpl.template,
          skyTop: pal.skyTop,
          skyBottom: pal.skyBottom,
          hillFar: pal.hillFar,
          hillNear: pal.hillNear,
          accentColor: pal.accent,
          timeOfDay: pal.timeOfDay,
          weather: w.weather,
          seed: idx + 10,
        },
      });
      idx += 1;
    }
  }

  return list;
}

export const BACKGROUNDS: BackgroundItem[] = generateProceduralBackgrounds();

export function getBackgroundById(id: string | undefined): BackgroundItem {
  return BACKGROUNDS.find((b) => b.id === id) ?? BACKGROUNDS[0];
}
