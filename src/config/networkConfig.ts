/**
 * Compatibility layer while migrating from Firebase to Supabase.
 * New code should import from supabaseConfig / lib/supabase.
 */

import { isSupabaseConfigured, NETWORK_DEFAULTS, SUPABASE_CONFIG } from './supabaseConfig.ts';

export { isSupabaseConfigured, NETWORK_DEFAULTS, SUPABASE_CONFIG };

/** @deprecated Use isSupabaseConfigured */
export const isFirebaseConfigured = isSupabaseConfigured;

export const NETWORK_CONFIG = {
  get rtcIceServers() {
    return NETWORK_DEFAULTS.rtcIceServers;
  },
  get reconnectGraceMs() {
    return NETWORK_DEFAULTS.reconnectGraceMs;
  },
  get quickMatchBotFallbackMs() {
    return NETWORK_DEFAULTS.quickMatchBotFallbackMs;
  },
  get snapshotRateHz() {
    return NETWORK_DEFAULTS.snapshotRateHz;
  },
  get appUrl() {
    return NETWORK_DEFAULTS.appUrl;
  },
  firebase: {
    apiKey: '',
    authDomain: '',
    databaseURL: '',
    projectId: '',
    appId: '',
  },
};
