export type GameScreen =
  | 'TITLE'
  | 'SOLO_SETUP'
  | 'QUICK_SEARCH'
  | 'PRIVATE_HUB'
  | 'ROOM_LOBBY'
  | 'IN_MATCH';

export type MatchMode = 'solo' | 'quick_match' | 'online_room' | 'hotspot_room';

export type BattleFormat = '1v1' | 'ffa' | 'teams';

export type AIDifficulty = 'easy' | 'normal' | 'hard';

export type RoomWeaponId =
  | 'thunder_lance'
  | 'hammer_wheel'
  | 'shield_dome'
  | 'magnet_ram'
  | 'bounce_boots';

export type MatchPhase =
  | 'DRAWING'
  | 'COUNTDOWN'
  | 'FIGHTING'
  | 'ROUND_END'
  | 'MATCH_OVER';

export interface Point2D {
  x: number;
  y: number;
}

export interface ShapeStats {
  mass: number;
  friction: number;
  restitution: number;
  speedRating: number; // 1..10
  spikePower: number; // 1..10
  armorHp: number;
  inkUsed: number; // 0..100
  spikeCount: number;
  spikeTips: Point2D[]; // Normalized -0.5..0.5 relative to centroid
}

export interface DrawnBlueprint {
  strokes: Point2D[][]; // Normalized 0..1 inside drafting box
  hullParts: Point2D[][]; // Relative -0.5..0.5 simplified convex/capsule polygons
  centroid: Point2D;
  bounds: { width: number; height: number };
  stats: ShapeStats;
}

export type ShopRarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';
export type ShopCategory = 'skins' | 'weapons' | 'backgrounds' | 'themes' | 'trails';
export type CurrencyType = 'coins' | 'gems';

export interface LeaderboardEntry {
  uid: string;
  name: string;
  trophies: number;
  wins: number;
  losses: number;
  avatar: string;
  updatedAt?: number;
}

export interface CosmeticsEquipped {
  riderId: string;
  inkStyleId: string;
  lanceSkinId: string;
  wheelFinishId: string;
  skinId?: string;
  weaponId?: string;
  backgroundId?: string;
  themeId?: string;
  trailId?: string;
}

export interface RiderCatalogItem {
  id: string;
  name: string;
  title: string;
  primaryColor: string;
  accentColor: string;
  visorColor: string;
  shape: 'beetle' | 'sentinel' | 'duelist' | 'scout' | 'champion';
  costCoins: number;
  costGems: number;
}

export interface CosmeticItem {
  id: string;
  category: 'ink' | 'lance' | 'wheel';
  name: string;
  description: string;
  color: string;
  glowColor?: string;
  costCoins: number;
  costGems: number;
}

export interface RoomWeaponDef {
  id: RoomWeaponId;
  name: string;
  shortDesc: string;
  cooldownSec: number;
  accentColor: string;
  badgeText: string;
}

export interface ArenaPlatformDef {
  x: number; // World coordinates centered around 0 (-600..600)
  y: number;
  width: number;
  height: number;
  angle?: number;
  isBumper?: boolean;
  isBouncePad?: boolean;
}

export interface ArenaDef {
  id: string;
  name: string;
  subtitle: string;
  tier: number;
  worldWidth: number;
  fallY: number;
  skyTint: string;
  gridTint: string;
  railColor: string;
  platforms: ArenaPlatformDef[];
  spawnPoints: { x: number; y: number; facing: 1 | -1 }[];
}

export interface CampaignLevelDef {
  level: number;
  arenaId: string;
  rivalName: string;
  rivalTitle: string;
  rivalRiderId: string;
  archetype: 'wheel' | 'wedge' | 'sled' | 'spiker' | 'hammer' | 'titan';
  rewardCoins: number;
  rewardGems: number;
  rewardXp: number;
}

export interface MissionItem {
  id: string;
  cadence: 'daily' | 'weekly';
  title: string;
  metric: 'matches_played' | 'matches_won' | 'rounds_won' | 'room_matches' | 'weapons_used' | 'draws_spiky';
  target: number;
  progress: number;
  rewardCoins: number;
  rewardGems: number;
  rewardXp: number;
  claimed: boolean;
}

export interface AchievementItem {
  id: string;
  title: string;
  description: string;
  target: number;
  progress: number;
  rewardGems: number;
  unlocked: boolean;
}

export type ControlSize = 'compact' | 'standard' | 'large';
export type TouchMode = 'auto' | 'always' | 'off';
export type RoundDurationSec = 60 | 300;

export interface ControlSettings {
  controlSize: ControlSize;
  leftHanded: boolean;
  sensitivity: number; // 0.6 .. 1.5
  touchMode: TouchMode;
  botDifficulty: AIDifficulty;
  roundDurationSec: RoundDurationSec;
}

export interface PlayerProfile {
  playerId: string;
  nickname: string;
  avatarId: string;
  xp: number;
  level: number;
  mmr: number;
  trophies: number;
  rankedWins: number;
  rankedLosses: number;
  coins: number;
  gems: number;
  unlimitedCurrency: boolean;
  promoApplied: string | null;
  winStreak: number;
  bestStreak: number;
  totalWins: number;
  totalMatches: number;
  lastLoginClaimDate: string | null;
  loginStreakDay: number; // 1..7
  missionsResetDate: string;
  weeklyResetKey: string;
  missions: MissionItem[];
  achievements: AchievementItem[];
  unlockedCosmetics: string[];
  unlockedWeapons: string[];
  unlockedBackgrounds: string[];
  unlockedThemes: string[];
  unlockedTrails: string[];
  equipped: CosmeticsEquipped;
  campaignCleared: Record<AIDifficulty, number>; // highest level cleared
  muted: boolean;
  hasSeenHowToPlay: boolean;
  controlSettings: ControlSettings;
}

export interface PlayerInputState {
  move: number; // -1..1 (left/right drive)
  boost: boolean;
  jump: boolean;
  lanceDir: number; // -1..1
  special: boolean;
}

export interface LobbyPlayer {
  id: string;
  nickname: string;
  level: number;
  mmr: number;
  ready: boolean;
  isHost: boolean;
  isBot: boolean;
  teamId: 1 | 2;
  roomWeapon: RoomWeaponId | null;
  cosmetics: CosmeticsEquipped;
  connected: boolean;
  reconnectExpiresAt?: number | null;
}

export interface RoomState {
  roomId: string;
  code: string;
  subMode: 'online_room' | 'hotspot_room' | 'quick_match';
  hostId: string;
  maxPlayers: number;
  battleFormat: BattleFormat;
  arenaId: string;
  roundDurationSec?: RoundDurationSec;
  status: 'lobby' | 'in_match';
  players: LobbyPlayer[];
}

export interface VehicleSnapshot {
  playerId: string;
  nickname: string;
  isBot: boolean;
  teamId: 1 | 2;
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  riderX: number;
  riderY: number;
  riderAngle: number;
  headHitX?: number;
  headHitY?: number;
  headRadius?: number;
  headFlashMs?: number;
  lanceAngle: number;
  lanceTipX: number;
  lanceTipY: number;
  facing: 1 | -1;
  riderHp: number;
  maxRiderHp: number;
  chassisHp: number;
  maxChassisHp: number;
  boostEnergy: number; // 0..100
  boosting: boolean;
  jumpCooldownMs: number;
  weaponId: RoomWeaponId | null;
  weaponCooldownMs: number;
  weaponMaxCooldownMs: number;
  shieldActiveMs: number;
  eliminated: boolean;
  eliminationReason?: string;
  roundWins: number;
  cosmetics: CosmeticsEquipped;
  blueprint: DrawnBlueprint | null;
  connected: boolean;
  reconnectRemainingSec?: number;
}

export interface HealthPickupSnapshot {
  id: string;
  x: number;
  y: number;
  state: 'falling' | 'landed' | 'fading';
  ttlMs: number;
  maxTtlMs: number;
}

export interface VisualEffectEvent {
  id: string;
  kind:
    | 'impact'
    | 'head_hit'
    | 'heal'
    | 'pickup_spawn'
    | 'ko'
    | 'thunder'
    | 'hammer'
    | 'shield'
    | 'magnet'
    | 'bounce';
  x: number;
  y: number;
  targetX?: number;
  targetY?: number;
  color: string;
  intensity: number;
  label?: string;
  damage?: number;
}

export interface MatchSnapshot {
  matchId: string;
  mode: MatchMode;
  battleFormat: BattleFormat;
  arenaId: string;
  roundIndex: number; // 1..3 (or tiebreaker)
  roundsToWin: number; // 2
  phase: MatchPhase;
  phaseRemainingMs: number;
  roundDurationMs?: number;
  suddenDeath?: boolean;
  healthPickup?: HealthPickupSnapshot | null;
  serverTime: number;
  vehicles: VehicleSnapshot[];
  roundWinnerIds: string[];
  matchWinnerIds: string[];
  koSummary?: string;
}

export interface MatchRewardSummary {
  won: boolean;
  xpEarned: number;
  coinsEarned: number;
  gemsEarned: number;
  streakBonusCoins: number;
  leveledUp: boolean;
  newLevel: number;
  roundsWon: number;
  roundsLost: number;
  koReason: string;
  isBotMatch: boolean;
  trophyDelta?: number;
  newTrophies?: number;
}

export type ClientNetMessage =
  | {
      type: 'hello';
      playerId: string;
      nickname: string;
      level: number;
      mmr: number;
      cosmetics: CosmeticsEquipped;
    }
  | { type: 'update_profile'; nickname: string; cosmetics: CosmeticsEquipped }
  | { type: 'quick_match:join' }
  | { type: 'quick_match:cancel' }
  | {
      type: 'room:create';
      maxPlayers: number;
      battleFormat: BattleFormat;
      arenaId: string;
    }
  | { type: 'room:join'; code: string }
  | { type: 'room:leave' }
  | {
      type: 'room:config';
      maxPlayers?: number;
      battleFormat?: BattleFormat;
      arenaId?: string;
    }
  | {
      type: 'room:ready';
      ready: boolean;
      roomWeapon: RoomWeaponId;
      teamId?: 1 | 2;
    }
  | { type: 'room:start' }
  | { type: 'room:rematch' }
  | { type: 'match:draw_submit'; blueprint: DrawnBlueprint }
  | { type: 'match:input'; input: PlayerInputState }
  | { type: 'session:resume'; playerId: string; roomId?: string; matchId?: string };

export type ServerNetMessage =
  | { type: 'welcome'; playerId: string; activeRoom?: RoomState; activeMatchId?: string }
  | { type: 'error'; message: string }
  | { type: 'quick_match:searching'; elapsedMs: number }
  | { type: 'quick_match:matched'; matchId: string; isBot: boolean; opponentName: string }
  | { type: 'room:state'; room: RoomState }
  | { type: 'match:snapshot'; snapshot: MatchSnapshot }
  | { type: 'match:fx'; events: VisualEffectEvent[] }
  | { type: 'match:reconnecting'; playerId: string; nickname: string; remainingSec: number }
  | { type: 'match:resumed'; snapshot: MatchSnapshot };
