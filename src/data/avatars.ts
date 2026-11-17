export type AvatarArchetype =
  | 'animal_ears'
  | 'panda'
  | 'owl'
  | 'frog'
  | 'bunny'
  | 'robot'
  | 'knight'
  | 'ninja'
  | 'wizard'
  | 'astronaut'
  | 'pirate'
  | 'alien'
  | 'dragon'
  | 'clockwork'
  | 'crown';

export interface AvatarDef {
  id: string;
  name: string;
  bg: string;
  primary: string;
  secondary: string;
  accent: string;
  eyeColor: string;
  archetype: AvatarArchetype;
  feature?: 'glasses' | 'scar' | 'blush' | 'beard' | 'antenna' | 'horns' | 'crest' | 'none';
}

export const AVATARS: AvatarDef[] = [
  // Animals (16)
  { id: 'fox', name: 'Copper Fox', bg: '#3E2723', primary: '#E85D2A', secondary: '#F5EFE6', accent: '#D99B26', eyeColor: '#161412', archetype: 'animal_ears', feature: 'blush' },
  { id: 'cat', name: 'Soot Cat', bg: '#263238', primary: '#455A64', secondary: '#CFD8DC', accent: '#F5B041', eyeColor: '#10B981', archetype: 'animal_ears', feature: 'blush' },
  { id: 'wolf', name: 'Frost Wolf', bg: '#1E293B', primary: '#94A3B8', secondary: '#F1F5F9', accent: '#38BDF8', eyeColor: '#0F172A', archetype: 'animal_ears', feature: 'scar' },
  { id: 'panda', name: 'Ink Panda', bg: '#2D3A34', primary: '#F5EFE6', secondary: '#1F2937', accent: '#10B981', eyeColor: '#111827', archetype: 'panda', feature: 'blush' },
  { id: 'owl', name: 'Brass Owl', bg: '#2B241D', primary: '#A16207', secondary: '#FEF3C7', accent: '#F59E0B', eyeColor: '#1C1917', archetype: 'owl', feature: 'glasses' },
  { id: 'frog', name: 'Moss Frog', bg: '#1B3B2B', primary: '#34D399', secondary: '#D1FAE5', accent: '#F59E0B', eyeColor: '#064E3B', archetype: 'frog', feature: 'blush' },
  { id: 'bunny', name: 'Quill Bunny', bg: '#3B2C35', primary: '#F3E8FF', secondary: '#F9A8D4', accent: '#C084FC', eyeColor: '#3B0764', archetype: 'bunny', feature: 'blush' },
  { id: 'bear', name: 'Amber Bear', bg: '#332419', primary: '#B45309', secondary: '#FDE68A', accent: '#D97706', eyeColor: '#1C1917', archetype: 'animal_ears', feature: 'none' },
  { id: 'tiger', name: 'Forge Tiger', bg: '#3B2314', primary: '#F97316', secondary: '#FEF3C7', accent: '#1F2937', eyeColor: '#111827', archetype: 'animal_ears', feature: 'scar' },
  { id: 'raccoon', name: 'Bandit Raccoon', bg: '#27272A', primary: '#71717A', secondary: '#E4E4E7', accent: '#18181B', eyeColor: '#F59E0B', archetype: 'panda', feature: 'none' },
  { id: 'koala', name: 'Mist Koala', bg: '#22303C', primary: '#9CA3AF', secondary: '#F3F4F6', accent: '#4B5563', eyeColor: '#111827', archetype: 'animal_ears', feature: 'blush' },
  { id: 'lynx', name: 'Dusk Lynx', bg: '#2E2532', primary: '#C084FC', secondary: '#FAF5FF', accent: '#F59E0B', eyeColor: '#1E1B4B', archetype: 'animal_ears', feature: 'none' },
  { id: 'red_panda', name: 'Ember Panda', bg: '#3B2322', primary: '#DC2626', secondary: '#FEF2F2', accent: '#78350F', eyeColor: '#1C1917', archetype: 'panda', feature: 'blush' },
  { id: 'snow_owl', name: 'Ivory Owl', bg: '#1E293B', primary: '#E2E8F0', secondary: '#FFFFFF', accent: '#38BDF8', eyeColor: '#0F172A', archetype: 'owl', feature: 'none' },
  { id: 'toad', name: 'Jade Toad', bg: '#1F2937', primary: '#10B981', secondary: '#A7F3D0', accent: '#FBBF24', eyeColor: '#064E3B', archetype: 'frog', feature: 'crown' as never },
  { id: 'hare', name: 'Swift Hare', bg: '#2D2620', primary: '#D6D3D1', secondary: '#FDE68A', accent: '#E85D2A', eyeColor: '#292524', archetype: 'bunny', feature: 'scar' },

  // Robots & Clockwork (8)
  { id: 'bot_brass', name: 'Brass Bot', bg: '#26211B', primary: '#D99B26', secondary: '#FDE68A', accent: '#38BDF8', eyeColor: '#0EA5E9', archetype: 'robot', feature: 'antenna' },
  { id: 'bot_steel', name: 'Steel Automaton', bg: '#1F2937', primary: '#94A3B8', secondary: '#E2E8F0', accent: '#10B981', eyeColor: '#34D399', archetype: 'robot', feature: 'antenna' },
  { id: 'bot_crimson', name: 'Forge Droid', bg: '#2F1D1D', primary: '#EF4444', secondary: '#FECACA', accent: '#F59E0B', eyeColor: '#FDE047', archetype: 'robot', feature: 'glasses' },
  { id: 'bot_teal', name: 'Pulse Unit', bg: '#132E35', primary: '#14B8A6', secondary: '#CCFBF1', accent: '#F43F5E', eyeColor: '#2DD4BF', archetype: 'robot', feature: 'antenna' },
  { id: 'cog_tick', name: 'Tickwerk Gear', bg: '#2B231A', primary: '#B45309', secondary: '#FCD34D', accent: '#E85D2A', eyeColor: '#1C1917', archetype: 'clockwork', feature: 'glasses' },
  { id: 'cog_chrono', name: 'Chrono Core', bg: '#1E2433', primary: '#60A5FA', secondary: '#DBEAFE', accent: '#F59E0B', eyeColor: '#1E3A8A', archetype: 'clockwork', feature: 'antenna' },
  { id: 'cog_copper', name: 'Copper Valve', bg: '#332018', primary: '#EA580C', secondary: '#FFEDD5', accent: '#D99B26', eyeColor: '#431407', archetype: 'clockwork', feature: 'none' },
  { id: 'cog_noir', name: 'Noir Piston', bg: '#18181B', primary: '#52525B', secondary: '#E4E4E7', accent: '#F59E0B', eyeColor: '#FBBF24', archetype: 'clockwork', feature: 'scar' },

  // Knights, Ninjas, Wizards, Royals (8)
  { id: 'knight_iron', name: 'Iron Knight', bg: '#252A34', primary: '#9CA3AF', secondary: '#E5E7EB', accent: '#E85D2A', eyeColor: '#38BDF8', archetype: 'knight', feature: 'crest' },
  { id: 'knight_gold', name: 'Gilded Paladin', bg: '#2E2516', primary: '#F59E0B', secondary: '#FEF3C7', accent: '#EF4444', eyeColor: '#FFFBEB', archetype: 'knight', feature: 'crest' },
  { id: 'ninja_shadow', name: 'Shadow Ninja', bg: '#18181B', primary: '#27272A', secondary: '#FDE68A', accent: '#EF4444', eyeColor: '#F87171', archetype: 'ninja', feature: 'scar' },
  { id: 'ninja_mist', name: 'Mist Shinobi', bg: '#162B30', primary: '#0F766E', secondary: '#FED7AA', accent: '#38BDF8', eyeColor: '#FDBA74', archetype: 'ninja', feature: 'none' },
  { id: 'wizard_star', name: 'Star Wizard', bg: '#1E1B4B', primary: '#6366F1', secondary: '#E0E7FF', accent: '#FBBF24', eyeColor: '#FDE047', archetype: 'wizard', feature: 'beard' },
  { id: 'wizard_ember', name: 'Pyre Mage', bg: '#3B1818', primary: '#DC2626', secondary: '#FFEDD5', accent: '#F59E0B', eyeColor: '#FDE047', archetype: 'wizard', feature: 'beard' },
  { id: 'royal_sun', name: 'Sun Regent', bg: '#362417', primary: '#D99B26', secondary: '#FEF3C7', accent: '#E85D2A', eyeColor: '#1C1917', archetype: 'crown', feature: 'none' },
  { id: 'royal_jade', name: 'Jade Sovereign', bg: '#163026', primary: '#10B981', secondary: '#ECFDF5', accent: '#FBBF24', eyeColor: '#064E3B', archetype: 'crown', feature: 'glasses' },

  // Astronauts, Pirates, Aliens, Dragons (8)
  { id: 'astro_orbit', name: 'Orbit Pilot', bg: '#172554', primary: '#F8FAFC', secondary: '#38BDF8', accent: '#F97316', eyeColor: '#BAE6FD', archetype: 'astronaut', feature: 'antenna' },
  { id: 'astro_nova', name: 'Nova Voyager', bg: '#2E1065', primary: '#E2E8F0', secondary: '#A855F7', accent: '#F59E0B', eyeColor: '#E9D5FF', archetype: 'astronaut', feature: 'none' },
  { id: 'pirate_ink', name: 'Ink Corsair', bg: '#2D1E1B', primary: '#78350F', secondary: '#FDE68A', accent: '#EF4444', eyeColor: '#1C1917', archetype: 'pirate', feature: 'beard' },
  { id: 'pirate_sea', name: 'Tide Captain', bg: '#132A38', primary: '#0284C7', secondary: '#F5EFE6', accent: '#F59E0B', eyeColor: '#0F172A', archetype: 'pirate', feature: 'scar' },
  { id: 'alien_zeph', name: 'Zephyr Alien', bg: '#1A2E26', primary: '#4ADE80', secondary: '#DCFCE7', accent: '#38BDF8', eyeColor: '#052E16', archetype: 'alien', feature: 'antenna' },
  { id: 'alien_nebula', name: 'Nebula Visitor', bg: '#2B193D', primary: '#C084FC', secondary: '#F3E8FF', accent: '#2DD4BF', eyeColor: '#3B0764', archetype: 'alien', feature: 'antenna' },
  { id: 'dragon_cinder', name: 'Cinder Dragon', bg: '#381B18', primary: '#E85D2A', secondary: '#FDBA74', accent: '#FBBF24', eyeColor: '#FEF08A', archetype: 'dragon', feature: 'horns' },
  { id: 'dragon_cobalt', name: 'Cobalt Wyrm', bg: '#17253B', primary: '#3B82F6', secondary: '#93C5FD', accent: '#F59E0B', eyeColor: '#E0F2FE', archetype: 'dragon', feature: 'horns' },
];

export function getAvatarDef(avatarId: string | undefined | null): AvatarDef {
  return AVATARS.find((a) => a.id === avatarId) ?? AVATARS[0];
}
