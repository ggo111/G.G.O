import type { CurrencyType, ShopRarity } from '../types/game.ts';
import type {
  SkinAccessory,
  SkinBodyStyle,
  SkinItem,
  SkinPattern,
} from './shopTypes.ts';

interface SkinPalette {
  prefix: string;
  primary: string;
  secondary: string;
  accent: string;
  visor: string;
  themeLabel: string;
}

const BODY_STYLES: { style: SkinBodyStyle; noun: string; rarityWeight: number }[] = [
  { style: 'cart', noun: 'Cart', rarityWeight: 0 },
  { style: 'wheel', noun: 'Wheelchair', rarityWeight: 0 },
  { style: 'sled', noun: 'Sled', rarityWeight: 0 },
  { style: 'beetle', noun: 'Beetle', rarityWeight: 1 },
  { style: 'crawler', noun: 'Crawler', rarityWeight: 1 },
  { style: 'monowheel', noun: 'Monowheel', rarityWeight: 1 },
  { style: 'ship', noun: 'Galleon', rarityWeight: 2 },
  { style: 'catamaran', noun: 'Catamaran', rarityWeight: 2 },
  { style: 'rocket_pod', noun: 'Rocket Pod', rarityWeight: 2 },
  { style: 'clockwork_walker', noun: 'Walker', rarityWeight: 2 },
  { style: 'mech', noun: 'Mech', rarityWeight: 3 },
  { style: 'drill_ram', noun: 'Drill Ram', rarityWeight: 3 },
  { style: 'dragon', noun: 'Dragon', rarityWeight: 4 },
];

const PALETTES: SkinPalette[] = [
  // Minimal / Classic
  { prefix: 'Sandstone', primary: '#D6C7B2', secondary: '#2C2621', accent: '#D99B26', visor: '#FFFBEB', themeLabel: 'Minimal' },
  { prefix: 'Charcoal', primary: '#3F3F46', secondary: '#18181B', accent: '#A1A1AA', visor: '#F4F4F5', themeLabel: 'Minimal' },
  // Cute / Pastel
  { prefix: 'Blossom', primary: '#F472B6', secondary: '#500724', accent: '#FBCFE8', visor: '#FDF2F8', themeLabel: 'Cute' },
  { prefix: 'Mint', primary: '#34D399', secondary: '#064E3B', accent: '#A7F3D0', visor: '#ECFDF5', themeLabel: 'Cute' },
  { prefix: 'Honey', primary: '#FBBF24', secondary: '#451A03', accent: '#FEF08A', visor: '#FFFBEB', themeLabel: 'Cute' },
  // Cool / Steel
  { prefix: 'Cobalt', primary: '#2563EB', secondary: '#1E293B', accent: '#38BDF8', visor: '#E0F2FE', themeLabel: 'Cool' },
  { prefix: 'Glacier', primary: '#7DD3FC', secondary: '#0C4A6E', accent: '#F0F9FF', visor: '#FFFFFF', themeLabel: 'Cool' },
  { prefix: 'Teal', primary: '#14B8A6', secondary: '#134E4A', accent: '#5EEAD4', visor: '#CCFBF1', themeLabel: 'Cool' },
  // Dark / Obsidian
  { prefix: 'Obsidian', primary: '#27272A', secondary: '#09090B', accent: '#EF4444', visor: '#FCA5A5', themeLabel: 'Dark' },
  { prefix: 'Shadow', primary: '#312E81', secondary: '#0F172A', accent: '#818CF8', visor: '#C7D2FE', themeLabel: 'Dark' },
  // Fantasy / Arcane
  { prefix: 'Amethyst', primary: '#9333EA', secondary: '#2E1065', accent: '#E879F9', visor: '#FAF5FF', themeLabel: 'Fantasy' },
  { prefix: 'Crimson', primary: '#DC2626', secondary: '#450A0A', accent: '#FBBF24', visor: '#FEF2F2', themeLabel: 'Fantasy' },
  // Sci-Fi / Neon
  { prefix: 'Plasma', primary: '#06B6D4', secondary: '#083344', accent: '#F43F5E', visor: '#ECFEFF', themeLabel: 'Sci-Fi' },
  { prefix: 'Cyber', primary: '#8B5CF6', secondary: '#1E1B4B', accent: '#2DD4BF', visor: '#F5F3FF', themeLabel: 'Sci-Fi' },
  // Nature / Forest
  { prefix: 'Moss', primary: '#4D7C0F', secondary: '#1A2E05', accent: '#BEF264', visor: '#F7FEE7', themeLabel: 'Nature' },
  { prefix: 'Amberwood', primary: '#B45309', secondary: '#292524', accent: '#F59E0B', visor: '#FEF3C7', themeLabel: 'Nature' },
  // Retro / Arcade
  { prefix: 'Tangerine', primary: '#EA580C', secondary: '#431407', accent: '#FDE047', visor: '#FFEDD5', themeLabel: 'Retro' },
  { prefix: 'Brass', primary: '#CA8A04', secondary: '#1C1917', accent: '#E85D2A', visor: '#FEF9C3', themeLabel: 'Retro' },
];

const PATTERNS: { pattern: SkinPattern; tag: string; weight: number }[] = [
  { pattern: 'stripes', tag: 'Striped', weight: 0 },
  { pattern: 'dots', tag: 'Spotted', weight: 0 },
  { pattern: 'camo', tag: 'Marbled', weight: 1 },
  { pattern: 'gradient', tag: 'Faded', weight: 1 },
  { pattern: 'metal', tag: 'Riveted', weight: 2 },
  { pattern: 'glow', tag: 'Radiant', weight: 3 },
];

const ACCESSORIES: { accessory: SkinAccessory; tag: string; weight: number }[] = [
  { accessory: 'none', tag: '', weight: 0 },
  { accessory: 'flags', tag: 'Banner', weight: 1 },
  { accessory: 'antenna', tag: 'Signal', weight: 1 },
  { accessory: 'ribbons', tag: 'Ribbon', weight: 1 },
  { accessory: 'armor', tag: 'Armored', weight: 2 },
  { accessory: 'horns', tag: 'Horned', weight: 2 },
  { accessory: 'wings', tag: 'Winged', weight: 3 },
  { accessory: 'crown', tag: 'Crowned', weight: 4 },
];

function computeSkinPricing(score: number, idx: number): {
  rarity: ShopRarity;
  price: number;
  currency: CurrencyType;
} {
  if (score <= 2) {
    return {
      rarity: 'Common',
      price: 110 + ((idx * 23) % 190), // 110..299 Coins
      currency: 'coins',
    };
  }
  if (score <= 5) {
    return {
      rarity: 'Rare',
      price: 420 + ((idx * 47) % 470), // 420..889 Coins
      currency: 'coins',
    };
  }
  if (score <= 8) {
    if (idx % 2 === 0) {
      return {
        rarity: 'Epic',
        price: 1600 + ((idx * 173) % 2300), // 1600..3899 Coins
        currency: 'coins',
      };
    }
    return {
      rarity: 'Epic',
      price: 32 + ((idx * 7) % 48), // 32..79 Gems
      currency: 'gems',
    };
  }
  return {
    rarity: 'Legendary',
    price: 110 + ((idx * 19) % 185), // 110..294 Gems
    currency: 'gems',
  };
}

function generateProceduralSkins(): SkinItem[] {
  const list: SkinItem[] = [
    {
      id: 'skin_starter',
      name: 'Ink-Forge Standard',
      category: 'skins',
      rarity: 'Common',
      price: 0,
      currency: 'coins',
      starter: true,
      description: 'Free starter brass-and-charcoal clockwork carriage.',
      renderParams: {
        bodyStyle: 'cart',
        primaryColor: '#D99B26',
        secondaryColor: '#2C2621',
        accentColor: '#E85D2A',
        pattern: 'stripes',
        accessory: 'none',
        visorColor: '#F5EFE6',
      },
    },
  ];

  const usedNames = new Set<string>(['Ink-Forge Standard']);
  let idx = 0;

  for (let b = 0; b < BODY_STYLES.length; b++) {
    const body = BODY_STYLES[b];
    for (let p = 0; p < PALETTES.length; p++) {
      // Combine deterministically across 13 styles × 18 palettes = 234 total, cap/keep ~220+ distinct
      const palette = PALETTES[p];
      const pat = PATTERNS[(b * 5 + p * 3 + idx) % PATTERNS.length];
      const acc = ACCESSORIES[(b * 3 + p * 7 + idx) % ACCESSORIES.length];

      const nameParts = [
        palette.prefix,
        acc.tag || pat.tag,
        body.noun,
      ].filter(Boolean);
      let name = nameParts.join(' ');
      if (usedNames.has(name)) {
        name = `${palette.prefix} ${pat.tag} ${body.noun}`;
      }
      if (usedNames.has(name)) {
        name = `${palette.prefix} ${pat.tag} ${acc.tag || 'Mk'} ${body.noun}`;
      }
      usedNames.add(name);

      const score = body.rarityWeight + pat.weight + acc.weight;
      const pricing = computeSkinPricing(score, idx);

      list.push({
        id: `skin_${body.style}_${palette.prefix.toLowerCase()}_${idx}`,
        name,
        category: 'skins',
        rarity: pricing.rarity,
        price: pricing.price,
        currency: pricing.currency,
        description: `${palette.themeLabel} ${body.noun.toLowerCase()} with ${pat.pattern} finish${
          acc.accessory !== 'none' ? ` and ${acc.accessory}` : ''
        }.`,
        renderParams: {
          bodyStyle: body.style,
          primaryColor: palette.primary,
          secondaryColor: palette.secondary,
          accentColor: palette.accent,
          pattern: pat.pattern,
          accessory: acc.accessory,
          visorColor: palette.visor,
        },
      });
      idx += 1;
    }
  }

  return list;
}

export const SKINS: SkinItem[] = generateProceduralSkins();

export function getSkinById(id: string | undefined): SkinItem {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
}
