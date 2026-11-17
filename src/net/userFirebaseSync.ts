/**
 * Compatibility layer — all persistence now goes through Supabase.
 */

import type { LeaderboardEntry, PlayerProfile } from '../types/game.ts';
import { syncProfileToServer } from '../lib/authService.ts';
import { getSupabase } from '../lib/supabase.ts';

export async function mirrorUserProfileToFirebase(profile: PlayerProfile) {
  return syncProfileToServer(profile);
}

export async function mirrorUserInventoryToFirebase(profile: PlayerProfile) {
  return syncProfileToServer(profile);
}

export async function syncLeaderboardMetadata(_profile: PlayerProfile) {
  /* trophies live on profiles */
}

export async function writeOwnLeaderboardRecord(_profile: PlayerProfile) {
  /* no-op */
}

/** Fetch Top 100 from Supabase leaderboard view / profiles. */
export async function fetchTopLeaderboard(): Promise<LeaderboardEntry[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from('profiles')
    .select('id, username, nickname, avatar_id, trophies, ranked_wins, ranked_losses, updated_at')
    .order('trophies', { ascending: false })
    .limit(100);

  if (error || !data) {
    console.error('[leaderboard]', error);
    return [];
  }

  return data.map((row) => ({
    uid: String(row.id),
    name: String(row.nickname || row.username || 'Player'),
    trophies: Number(row.trophies) || 0,
    wins: Number(row.ranked_wins) || 0,
    losses: Number(row.ranked_losses) || 0,
    avatar: String(row.avatar_id || 'fox'),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
  }));
}
