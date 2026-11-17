/**
 * Compatibility re-export.
 * Online networking now runs on Supabase Realtime + WebRTC.
 * See src/net/supabaseOnline.ts for the implementation.
 */
export { onlineRtc } from './supabaseOnline.ts';
export { RIDER_CATALOG } from '../data/gameCatalog.ts';
export type { AIDifficulty } from '../types/game.ts';
