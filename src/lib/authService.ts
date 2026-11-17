/**
 * Simple name-based identity for G G O.
 * - First visit → user types a name
 * - We create an anonymous Supabase session under the hood
 * - Claim unique username + create profile
 * - No passwords, no email, no OAuth – perfect for kids & casual players
 */

import type { User } from '@supabase/supabase-js';
import { getSupabase } from './supabase.ts';
import type { PlayerProfile } from '../types/game.ts';
import { createDefaultProfile } from '../utils/profileStore.ts';

const LOCAL_UID_KEY = 'ggo_supabase_uid';
const LOCAL_PROFILE_KEY = 'ggo_forge_profile_v2';

export type AuthResult =
  | { ok: true; user: User; profile: PlayerProfile; isNew: boolean }
  | { ok: false; error: string };

function sanitizeUsername(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
}

export function loadLocalProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(LOCAL_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PlayerProfile;
  } catch {
    return null;
  }
}

export function saveLocalProfile(profile: PlayerProfile): void {
  try {
    localStorage.setItem(LOCAL_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    /* quota / private mode */
  }
}

/**
 * Ensure we have a Supabase anonymous session.
 * Returns the current user or signs in anonymously.
 */
export async function ensureSession(): Promise<User | null> {
  const sb = getSupabase();
  if (!sb) return null;

  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    localStorage.setItem(LOCAL_UID_KEY, session.user.id);
    return session.user;
  }

  const { data, error } = await sb.auth.signInAnonymously();
  if (error || !data.user) {
    console.error('[auth] anonymous sign-in failed', error);
    return null;
  }
  localStorage.setItem(LOCAL_UID_KEY, data.user.id);
  return data.user;
}

/**
 * Claim a username and create / load the profile.
 * Called when the player first enters their name.
 */
export async function claimNameAndCreateProfile(desiredName: string): Promise<AuthResult> {
  const sb = getSupabase();
  if (!sb) {
    // Offline / no backend – pure local profile
    const profile = createDefaultProfile();
    profile.nickname = desiredName.trim().slice(0, 20) || profile.nickname;
    profile.playerId = profile.playerId || `local_${Date.now()}`;
    saveLocalProfile(profile);
    return { ok: true, user: { id: profile.playerId } as User, profile, isNew: true };
  }

  const user = await ensureSession();
  if (!user) {
    return { ok: false, error: 'تعذر الاتصال. حاول مرة أخرى.' };
  }

  const username = sanitizeUsername(desiredName);
  if (username.length < 2) {
    return { ok: false, error: 'الاسم يجب أن يكون حرفين على الأقل.' };
  }

  // 1. Claim username via RPC (atomic)
  const { data: claimResult, error: claimErr } = await sb.rpc('claim_username', {
    p_username: username,
  });

  if (claimErr) {
    console.error('[auth] claim_username error', claimErr);
    return { ok: false, error: 'حدث خطأ. حاول اسماً آخر.' };
  }

  const claim = claimResult as { ok: boolean; error?: string; username?: string };
  if (!claim?.ok) {
    if (claim?.error === 'taken') {
      return { ok: false, error: 'هذا الاسم مستخدم بالفعل. جرب اسماً آخر.' };
    }
    return { ok: false, error: 'الاسم غير صالح. استخدم حروف وأرقام فقط.' };
  }

  // 2. Check if profile already exists (rare – e.g. page refresh mid-flow)
  const { data: existing } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (existing) {
    const profile = mapDbProfileToLocal(existing);
    saveLocalProfile(profile);
    return { ok: true, user, profile, isNew: false };
  }

  // 3. Create fresh profile
  const base = createDefaultProfile();
  const profile: PlayerProfile = {
    ...base,
    playerId: user.id,
    nickname: desiredName.trim().slice(0, 20) || username,
  };

  const { error: insertErr } = await sb.from('profiles').insert({
    id: user.id,
    username,
    nickname: profile.nickname,
    avatar_id: profile.avatarId,
    xp: profile.xp,
    level: profile.level,
    mmr: profile.mmr,
    trophies: profile.trophies,
    ranked_wins: profile.rankedWins,
    ranked_losses: profile.rankedLosses,
    coins: profile.coins,
    gems: profile.gems,
    total_wins: profile.totalWins,
    total_matches: profile.totalMatches,
    win_streak: profile.winStreak,
    best_streak: profile.bestStreak,
    inventory: {
      unlockedCosmetics: profile.unlockedCosmetics,
      unlockedWeapons: profile.unlockedWeapons,
      unlockedBackgrounds: profile.unlockedBackgrounds,
      unlockedThemes: profile.unlockedThemes,
      unlockedTrails: profile.unlockedTrails,
    },
    equipped: profile.equipped,
    campaign: profile.campaignCleared,
    missions: profile.missions,
    achievements: profile.achievements,
    settings: {
      muted: profile.muted,
      hasSeenHowToPlay: profile.hasSeenHowToPlay,
      controlSettings: profile.controlSettings,
    },
  });

  if (insertErr) {
    console.error('[auth] profile insert failed', insertErr);
    return { ok: false, error: 'تعذر إنشاء الحساب. حاول مرة أخرى.' };
  }

  saveLocalProfile(profile);
  return { ok: true, user, profile, isNew: true };
}

/**
 * Restore session + profile on app start.
 * If we have a valid session and profile → ready.
 * If session exists but no profile → need name claim.
 * If nothing → show name screen.
 */
export async function restoreSession(): Promise<{
  user: User | null;
  profile: PlayerProfile | null;
  needsName: boolean;
}> {
  const sb = getSupabase();
  const local = loadLocalProfile();

  if (!sb) {
    return { user: null, profile: local, needsName: !local };
  }

  const user = await ensureSession();
  if (!user) {
    return { user: null, profile: local, needsName: !local };
  }

  // Prefer server profile
  const { data: row } = await sb
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (row) {
    const profile = mapDbProfileToLocal(row);
    // Merge any fresher local progress if needed (simple: server wins for now)
    saveLocalProfile(profile);
    return { user, profile, needsName: false };
  }

  // Session exists but no profile yet → need name
  if (local && local.playerId === user.id) {
    return { user, profile: local, needsName: false };
  }

  return { user, profile: null, needsName: true };
}

/** Push local profile changes to Supabase (fire-and-forget safe). */
export async function syncProfileToServer(profile: PlayerProfile): Promise<void> {
  const sb = getSupabase();
  if (!sb || !profile.playerId) return;

  try {
    await sb
      .from('profiles')
      .update({
        nickname: profile.nickname,
        avatar_id: profile.avatarId,
        xp: profile.xp,
        level: profile.level,
        mmr: profile.mmr,
        trophies: profile.trophies,
        ranked_wins: profile.rankedWins,
        ranked_losses: profile.rankedLosses,
        coins: profile.coins,
        gems: profile.gems,
        total_wins: profile.totalWins,
        total_matches: profile.totalMatches,
        win_streak: profile.winStreak,
        best_streak: profile.bestStreak,
        inventory: {
          unlockedCosmetics: profile.unlockedCosmetics,
          unlockedWeapons: profile.unlockedWeapons,
          unlockedBackgrounds: profile.unlockedBackgrounds,
          unlockedThemes: profile.unlockedThemes,
          unlockedTrails: profile.unlockedTrails,
        },
        equipped: profile.equipped,
        campaign: profile.campaignCleared,
        missions: profile.missions,
        achievements: profile.achievements,
        settings: {
          muted: profile.muted,
          hasSeenHowToPlay: profile.hasSeenHowToPlay,
          controlSettings: profile.controlSettings,
        },
        last_seen_at: new Date().toISOString(),
      })
      .eq('id', profile.playerId);
  } catch (err) {
    console.warn('[auth] syncProfile failed', err);
  }
}

function mapDbProfileToLocal(row: Record<string, unknown>): PlayerProfile {
  const inv = (row.inventory as Record<string, unknown>) || {};
  const settings = (row.settings as Record<string, unknown>) || {};
  const base = createDefaultProfile();

  return {
    ...base,
    playerId: String(row.id),
    nickname: String(row.nickname || row.username || 'Player'),
    avatarId: String(row.avatar_id || 'fox'),
    xp: Number(row.xp) || 0,
    level: Number(row.level) || 1,
    mmr: Number(row.mmr) || 1000,
    trophies: Number(row.trophies) || 0,
    rankedWins: Number(row.ranked_wins) || 0,
    rankedLosses: Number(row.ranked_losses) || 0,
    coins: Number(row.coins) || 0,
    gems: Number(row.gems) || 0,
    totalWins: Number(row.total_wins) || 0,
    totalMatches: Number(row.total_matches) || 0,
    winStreak: Number(row.win_streak) || 0,
    bestStreak: Number(row.best_streak) || 0,
    unlockedCosmetics: (inv.unlockedCosmetics as string[]) || base.unlockedCosmetics,
    unlockedWeapons: (inv.unlockedWeapons as string[]) || base.unlockedWeapons,
    unlockedBackgrounds: (inv.unlockedBackgrounds as string[]) || base.unlockedBackgrounds,
    unlockedThemes: (inv.unlockedThemes as string[]) || base.unlockedThemes,
    unlockedTrails: (inv.unlockedTrails as string[]) || base.unlockedTrails,
    equipped: (row.equipped as PlayerProfile['equipped']) || base.equipped,
    campaignCleared: (row.campaign as PlayerProfile['campaignCleared']) || base.campaignCleared,
    missions: (row.missions as PlayerProfile['missions']) || base.missions,
    achievements: (row.achievements as PlayerProfile['achievements']) || base.achievements,
    muted: Boolean(settings.muted),
    hasSeenHowToPlay: Boolean(settings.hasSeenHowToPlay),
    controlSettings: (settings.controlSettings as PlayerProfile['controlSettings']) || base.controlSettings,
  };
}
