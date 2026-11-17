import { GEM_TO_COINS_RATE, MATCH_REWARD_CONFIG } from '../config/economyConfig.ts';
import { matchPromoCode } from '../config/promoCodes.ts';
import {
  createDailyMissions,
  createInitialAchievements,
  createWeeklyMissions,
  DAILY_LOGIN_REWARDS,
} from '../data/gameCatalog.ts';
import { mirrorUserInventoryToFirebase, mirrorUserProfileToFirebase } from '../net/userFirebaseSync.ts';
import type { AnyShopItem } from '../data/shopTypes.ts';
import type {
  AIDifficulty,
  CosmeticsEquipped,
  MatchRewardSummary,
  PlayerProfile,
  ShopCategory,
} from '../types/game.ts';

const STORAGE_KEY = 'ggo_forge_profile_v2';

function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getWeekKey(): string {
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

export function xpNeededForLevel(level: number): number {
  return MATCH_REWARD_CONFIG.xpBase + (level - 1) * MATCH_REWARD_CONFIG.xpPerLevel;
}

function createGuestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest_${crypto.randomUUID().slice(0, 12)}`;
  }
  return `guest_${Math.random().toString(36).slice(2, 14)}`;
}

export function createDefaultProfile(): PlayerProfile {
  const names = ['ClockworkFox', 'InkSquire', 'BrassKnight', 'QuillRider', 'AnvilSpark'];
  const nick = `${names[Math.floor(Math.random() * names.length)]}${Math.floor(100 + Math.random() * 9899)}`;
  return {
    playerId: createGuestId(),
    nickname: nick,
    avatarId: 'fox',
    xp: 0,
    level: 1,
    mmr: 1000,
    trophies: 0,
    rankedWins: 0,
    rankedLosses: 0,
    coins: 200,
    gems: 10,
    unlimitedCurrency: false,
    promoApplied: null,
    winStreak: 0,
    bestStreak: 0,
    totalWins: 0,
    totalMatches: 0,
    lastLoginClaimDate: null,
    loginStreakDay: 1,
    missionsResetDate: getTodayKey(),
    weeklyResetKey: getWeekKey(),
    missions: [...createDailyMissions(), ...createWeeklyMissions()],
    achievements: createInitialAchievements(),
    unlockedCosmetics: ['pip', 'ink_charcoal', 'lance_steel', 'wheel_ink', 'skin_starter'],
    unlockedWeapons: ['weapon_starter_lance'],
    unlockedBackgrounds: ['bg_starter_forge'],
    unlockedThemes: ['theme_soft_sand'],
    unlockedTrails: ['trail_starter_spark'],
    equipped: {
      riderId: 'pip',
      inkStyleId: 'ink_charcoal',
      lanceSkinId: 'lance_steel',
      wheelFinishId: 'wheel_ink',
      skinId: 'skin_starter',
      weaponId: 'weapon_starter_lance',
      backgroundId: 'bg_starter_forge',
      themeId: 'theme_soft_sand',
      trailId: 'trail_starter_spark',
    },
    campaignCleared: {
      easy: 0,
      normal: 0,
      hard: 0,
    },
    muted: false,
    hasSeenHowToPlay: false,
    controlSettings: {
      controlSize: 'standard',
      leftHanded: false,
      sensitivity: 1.0,
      touchMode: 'auto',
      botDifficulty: 'easy',
      roundDurationSec: 60,
    },
  };
}

export function loadProfile(): PlayerProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createDefaultProfile();
      saveProfile(fresh);
      return fresh;
    }
    const parsed = JSON.parse(raw) as PlayerProfile;
    const today = getTodayKey();
    const week = getWeekKey();

    let missions = Array.isArray(parsed.missions) ? parsed.missions : [...createDailyMissions(), ...createWeeklyMissions()];
    if (parsed.missionsResetDate !== today) {
      const weekly = missions.filter((m) => m.cadence === 'weekly');
      missions = [...createDailyMissions(), ...(weekly.length ? weekly : createWeeklyMissions())];
    }
    if (parsed.weeklyResetKey !== week) {
      const daily = missions.filter((m) => m.cadence === 'daily');
      missions = [...(daily.length ? daily : createDailyMissions()), ...createWeeklyMissions()];
    }

    const defaults = createDefaultProfile();
    const rawCleared = (parsed.campaignCleared ?? {}) as Record<string, number>;
    const migratedCleared: Record<AIDifficulty, number> = {
      easy: rawCleared.easy ?? rawCleared.apprentice ?? 0,
      normal: rawCleared.normal ?? rawCleared.forgemaster ?? 0,
      hard: rawCleared.hard ?? rawCleared.grand_gear ?? 0,
    };
    const rawDiff = parsed.controlSettings?.botDifficulty as string | undefined;
    const validDiff: AIDifficulty =
      rawDiff === 'normal' || rawDiff === 'hard' ? rawDiff : 'easy';

    const hydrated: PlayerProfile = {
      ...defaults,
      ...parsed,
      avatarId: typeof parsed.avatarId === 'string' && parsed.avatarId ? parsed.avatarId : defaults.avatarId,
      trophies: typeof parsed.trophies === 'number' ? Math.max(0, Math.round(parsed.trophies)) : 0,
      rankedWins: typeof parsed.rankedWins === 'number' ? Math.max(0, Math.round(parsed.rankedWins)) : 0,
      rankedLosses: typeof parsed.rankedLosses === 'number' ? Math.max(0, Math.round(parsed.rankedLosses)) : 0,
      unlimitedCurrency: Boolean(parsed.unlimitedCurrency),
      promoApplied: typeof parsed.promoApplied === 'string' ? parsed.promoApplied : null,
      unlockedCosmetics: Array.from(
        new Set([...defaults.unlockedCosmetics, ...(Array.isArray(parsed.unlockedCosmetics) ? parsed.unlockedCosmetics : [])])
      ),
      unlockedWeapons: Array.from(
        new Set([...defaults.unlockedWeapons, ...(Array.isArray(parsed.unlockedWeapons) ? parsed.unlockedWeapons : [])])
      ),
      unlockedBackgrounds: Array.from(
        new Set([...defaults.unlockedBackgrounds, ...(Array.isArray(parsed.unlockedBackgrounds) ? parsed.unlockedBackgrounds : [])])
      ),
      unlockedThemes: Array.from(
        new Set([...defaults.unlockedThemes, ...(Array.isArray(parsed.unlockedThemes) ? parsed.unlockedThemes : [])])
      ),
      unlockedTrails: Array.from(
        new Set([...defaults.unlockedTrails, ...(Array.isArray(parsed.unlockedTrails) ? parsed.unlockedTrails : [])])
      ),
      equipped: {
        ...defaults.equipped,
        ...(parsed.equipped ?? {}),
      },
      campaignCleared: migratedCleared,
      controlSettings: {
        ...defaults.controlSettings,
        ...(parsed.controlSettings ?? {}),
        botDifficulty: validDiff,
        roundDurationSec: parsed.controlSettings?.roundDurationSec === 300 ? 300 : 60,
      },
      missionsResetDate: today,
      weeklyResetKey: week,
      missions,
    };
    saveProfile(hydrated);
    return hydrated;
  } catch {
    return createDefaultProfile();
  }
}

export function saveProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
  void mirrorUserProfileToFirebase(profile);
}

export function exchangeGemsToCoins(
  profile: PlayerProfile,
  gemAmount: number
): { ok: boolean; profile: PlayerProfile; coinsAdded: number; error?: string } {
  const cleanAmount = Math.floor(gemAmount);
  if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
    return { ok: false, profile, coinsAdded: 0, error: 'Enter at least 1 Gem.' };
  }
  if (!profile.unlimitedCurrency && profile.gems < cleanAmount) {
    return { ok: false, profile, coinsAdded: 0, error: 'Not enough Gems for this exchange.' };
  }
  const coinsAdded = cleanAmount * GEM_TO_COINS_RATE;
  const updated: PlayerProfile = profile.unlimitedCurrency
    ? { ...profile }
    : {
        ...profile,
        gems: profile.gems - cleanAmount,
        coins: profile.coins + coinsAdded,
      };
  saveProfile(updated);
  return { ok: true, profile: updated, coinsAdded };
}

export function applyPromoCode(
  profile: PlayerProfile,
  rawInput: string
): { ok: boolean; profile: PlayerProfile; name?: string; message: string } {
  const matched = matchPromoCode(rawInput);
  if (!matched) {
    return {
      ok: false,
      profile,
      message: 'That promo code is not recognized. Check the spelling and try again.',
    };
  }
  const updated: PlayerProfile = {
    ...profile,
    unlimitedCurrency: true,
    promoApplied: matched.name,
  };
  saveProfile(updated);
  return {
    ok: true,
    profile: updated,
    name: matched.name,
    message: `Welcome ${matched.name}`,
  };
}

export function canClaimDailyReward(profile: PlayerProfile): boolean {
  return profile.lastLoginClaimDate !== getTodayKey();
}

export function claimDailyReward(profile: PlayerProfile): { profile: PlayerProfile; coins: number; gems: number; day: number } {
  const today = getTodayKey();
  if (profile.lastLoginClaimDate === today) {
    return { profile, coins: 0, gems: 0, day: profile.loginStreakDay };
  }
  const day = Math.min(7, Math.max(1, profile.loginStreakDay));
  const reward = DAILY_LOGIN_REWARDS[day - 1] ?? DAILY_LOGIN_REWARDS[0];
  const nextDay = day >= 7 ? 1 : day + 1;
  const updated: PlayerProfile = {
    ...profile,
    coins: profile.coins + reward.coins,
    gems: profile.gems + reward.gems,
    lastLoginClaimDate: today,
    loginStreakDay: nextDay,
  };
  saveProfile(updated);
  return { profile: updated, coins: reward.coins, gems: reward.gems, day };
}

export function applyMatchProgression(
  profile: PlayerProfile,
  params: {
    won: boolean;
    roundsWon: number;
    roundsLost: number;
    mode: 'solo' | 'quick_match' | 'online_room' | 'hotspot_room';
    isRealHumanQuickMatch?: boolean;
    spikyRounds: number;
    weaponsUsed: number;
    campaignDifficulty?: AIDifficulty;
    campaignLevel?: number;
    bonusCoins?: number;
    bonusGems?: number;
    bonusXp?: number;
  }
): { profile: PlayerProfile; summary: Omit<MatchRewardSummary, 'koReason' | 'isBotMatch'> } {
  const baseCoins = params.won ? MATCH_REWARD_CONFIG.winCoins : MATCH_REWARD_CONFIG.lossCoins;
  const newWinStreak = params.won ? profile.winStreak + 1 : 0;
  const streakBonusCoins =
    params.won && newWinStreak >= 2
      ? Math.min(
          MATCH_REWARD_CONFIG.streakBonusMaxCoins,
          (newWinStreak - 1) * MATCH_REWARD_CONFIG.streakBonusStepCoins
        )
      : 0;
  const coinsEarned = baseCoins + streakBonusCoins + (params.bonusCoins ?? 0);
  const gemsEarned =
    (params.won && newWinStreak % MATCH_REWARD_CONFIG.winStreakGemInterval === 0
      ? MATCH_REWARD_CONFIG.winStreakGems
      : 0) + (params.bonusGems ?? 0);
  const xpEarned =
    (params.won ? MATCH_REWARD_CONFIG.winXp : MATCH_REWARD_CONFIG.lossXp) +
    params.roundsWon * MATCH_REWARD_CONFIG.xpPerRoundWon +
    (params.bonusXp ?? 0);

  let xp = profile.xp + xpEarned;
  let level = profile.level;
  let leveledUp = false;
  while (xp >= xpNeededForLevel(level)) {
    xp -= xpNeededForLevel(level);
    level += 1;
    leveledUp = true;
  }

  const countsForRanked = params.mode === 'quick_match' && Boolean(params.isRealHumanQuickMatch);
  const mmrDelta = countsForRanked
    ? params.won
      ? MATCH_REWARD_CONFIG.mmrWinDelta
      : MATCH_REWARD_CONFIG.mmrLossDelta
    : 0;
  const nextMmr = Math.max(
    MATCH_REWARD_CONFIG.mmrMin,
    Math.min(MATCH_REWARD_CONFIG.mmrMax, profile.mmr + mmrDelta)
  );

  let nextTrophies = profile.trophies;
  let nextRankedWins = profile.rankedWins;
  let nextRankedLosses = profile.rankedLosses;
  let trophyDelta: number | undefined;
  let newTrophies: number | undefined;

  if (countsForRanked) {
    const rawTrophyDelta = params.won
      ? Math.min(MATCH_REWARD_CONFIG.rankedTrophyMaxDelta, MATCH_REWARD_CONFIG.rankedTrophyWin)
      : MATCH_REWARD_CONFIG.rankedTrophyLoss;
    nextTrophies = Math.max(0, profile.trophies + rawTrophyDelta);
    trophyDelta = nextTrophies - profile.trophies;
    newTrophies = nextTrophies;
    if (params.won) nextRankedWins += 1;
    else nextRankedLosses += 1;
  }

  const bestStreak = Math.max(profile.bestStreak, newWinStreak);

  const isRoom = params.mode === 'online_room' || params.mode === 'hotspot_room';
  const missions = profile.missions.map((m) => {
    if (m.claimed) return m;
    let delta = 0;
    if (m.metric === 'matches_played') delta = 1;
    if (m.metric === 'matches_won' && params.won) delta = 1;
    if (m.metric === 'rounds_won') delta = params.roundsWon;
    if (m.metric === 'room_matches' && isRoom) delta = 1;
    if (m.metric === 'weapons_used') delta = params.weaponsUsed;
    if (m.metric === 'draws_spiky') delta = params.spikyRounds;
    return { ...m, progress: Math.min(m.target, m.progress + delta) };
  });

  const campaignCleared = { ...profile.campaignCleared };
  if (params.won && params.campaignDifficulty && params.campaignLevel) {
    campaignCleared[params.campaignDifficulty] = Math.max(
      campaignCleared[params.campaignDifficulty] ?? 0,
      params.campaignLevel
    );
  }
  const maxClearedAny = Math.max(
    campaignCleared.easy,
    campaignCleared.normal,
    campaignCleared.hard
  );

  let achievementGems = 0;
  const achievements = profile.achievements.map((a) => {
    let progress = a.progress;
    if (a.id === 'ach_first_blood') progress = params.won ? Math.max(progress, 1) : progress;
    if (a.id === 'ach_streak_3') progress = Math.max(progress, newWinStreak);
    if (a.id === 'ach_vet_15') progress = profile.totalMatches + 1;
    if (a.id === 'ach_grand_campaign') progress = Math.max(progress, maxClearedAny);
    const unlocked = a.unlocked || progress >= a.target;
    if (!a.unlocked && unlocked) {
      achievementGems += a.rewardGems;
    }
    return { ...a, progress: Math.min(a.target, progress), unlocked };
  });

  const totalGemsEarned =
    gemsEarned + achievementGems + (leveledUp ? MATCH_REWARD_CONFIG.levelUpGems : 0);

  const updated: PlayerProfile = {
    ...profile,
    xp,
    level,
    mmr: nextMmr,
    trophies: nextTrophies,
    rankedWins: nextRankedWins,
    rankedLosses: nextRankedLosses,
    coins: profile.coins + coinsEarned,
    gems: profile.gems + totalGemsEarned,
    winStreak: newWinStreak,
    bestStreak,
    totalWins: profile.totalWins + (params.won ? 1 : 0),
    totalMatches: profile.totalMatches + 1,
    missions,
    achievements,
    campaignCleared,
  };

  saveProfile(updated);

  return {
    profile: updated,
    summary: {
      won: params.won,
      xpEarned,
      coinsEarned,
      gemsEarned: totalGemsEarned,
      streakBonusCoins,
      leveledUp,
      newLevel: level,
      roundsWon: params.roundsWon,
      roundsLost: params.roundsLost,
      trophyDelta,
      newTrophies,
    },
  };
}

export function updateCosmetics(profile: PlayerProfile, equipped: CosmeticsEquipped): PlayerProfile {
  const updated = { ...profile, equipped };
  saveProfile(updated);
  return updated;
}

function patchEquippedForCategory(
  equipped: CosmeticsEquipped,
  category: ShopCategory,
  itemId: string
): CosmeticsEquipped {
  if (category === 'skins') return { ...equipped, skinId: itemId };
  if (category === 'weapons') return { ...equipped, weaponId: itemId };
  if (category === 'backgrounds') return { ...equipped, backgroundId: itemId };
  if (category === 'themes') return { ...equipped, themeId: itemId };
  return { ...equipped, trailId: itemId };
}

export function equipShopItem(
  profile: PlayerProfile,
  category: ShopCategory,
  itemId: string
): PlayerProfile {
  const updated: PlayerProfile = {
    ...profile,
    equipped: patchEquippedForCategory(profile.equipped, category, itemId),
  };
  saveProfile(updated);
  void mirrorUserInventoryToFirebase(updated);
  return updated;
}

export function buyShopItem(
  profile: PlayerProfile,
  item: AnyShopItem
): { ok: boolean; profile: PlayerProfile; error?: string } {
  const alreadyOwned =
    item.starter ||
    item.price === 0 ||
    (item.category === 'skins' && profile.unlockedCosmetics.includes(item.id)) ||
    (item.category === 'weapons' && profile.unlockedWeapons.includes(item.id)) ||
    (item.category === 'backgrounds' && profile.unlockedBackgrounds.includes(item.id)) ||
    (item.category === 'themes' && profile.unlockedThemes.includes(item.id)) ||
    (item.category === 'trails' && profile.unlockedTrails.includes(item.id));

  if (alreadyOwned) {
    return { ok: true, profile: equipShopItem(profile, item.category, item.id) };
  }

  if (!profile.unlimitedCurrency) {
    if (item.currency === 'coins' && profile.coins < item.price) {
      return { ok: false, profile, error: `Not enough Coins (need ${item.price}).` };
    }
    if (item.currency === 'gems' && profile.gems < item.price) {
      return { ok: false, profile, error: `Not enough Gems (need ${item.price}).` };
    }
  }

  const nextCoins =
    profile.unlimitedCurrency || item.currency !== 'coins' ? profile.coins : profile.coins - item.price;
  const nextGems =
    profile.unlimitedCurrency || item.currency !== 'gems' ? profile.gems : profile.gems - item.price;

  const updated: PlayerProfile = {
    ...profile,
    coins: nextCoins,
    gems: nextGems,
    unlockedCosmetics:
      item.category === 'skins'
        ? Array.from(new Set([...profile.unlockedCosmetics, item.id]))
        : profile.unlockedCosmetics,
    unlockedWeapons:
      item.category === 'weapons'
        ? Array.from(new Set([...profile.unlockedWeapons, item.id]))
        : profile.unlockedWeapons,
    unlockedBackgrounds:
      item.category === 'backgrounds'
        ? Array.from(new Set([...profile.unlockedBackgrounds, item.id]))
        : profile.unlockedBackgrounds,
    unlockedThemes:
      item.category === 'themes'
        ? Array.from(new Set([...profile.unlockedThemes, item.id]))
        : profile.unlockedThemes,
    unlockedTrails:
      item.category === 'trails'
        ? Array.from(new Set([...profile.unlockedTrails, item.id]))
        : profile.unlockedTrails,
    equipped: patchEquippedForCategory(profile.equipped, item.category, item.id),
  };

  saveProfile(updated);
  void mirrorUserInventoryToFirebase(updated);
  return { ok: true, profile: updated };
}
