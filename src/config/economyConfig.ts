/**
 * Centralized economy, match reward, and trophy configuration for G G O.
 */

export const GEM_TO_COINS_RATE = 50; // 1 Gem = 50 Coins (one-way)

export const MATCH_REWARD_CONFIG = {
  winCoins: 65,
  lossCoins: 28,
  streakBonusStepCoins: 15,
  streakBonusMaxCoins: 60,
  winStreakGemInterval: 3,
  winStreakGems: 2,
  levelUpGems: 3,
  winXp: 75,
  lossXp: 35,
  xpPerRoundWon: 15,
  xpBase: 120,
  xpPerLevel: 55,
  mmrWinDelta: 24,
  mmrLossDelta: -14,
  mmrMin: 600,
  mmrMax: 2800,
  rankedTrophyWin: 25,
  rankedTrophyLoss: -15,
  rankedTrophyMaxDelta: 40,
} as const;
