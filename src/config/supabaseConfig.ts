/**
 * Supabase configuration – all values from VITE_* env vars.
 */

export interface SupabaseEnvConfig {
  url: string;
  anonKey: string;
}

function readEnv(key: string): string {
  const val = (import.meta.env as Record<string, string | undefined> | undefined)?.[key];
  return typeof val === 'string' ? val.trim() : '';
}

export const SUPABASE_CONFIG: SupabaseEnvConfig = {
  url: readEnv('VITE_SUPABASE_URL'),
  anonKey: readEnv('VITE_SUPABASE_ANON_KEY'),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_CONFIG.url && SUPABASE_CONFIG.anonKey);
}

export const NETWORK_DEFAULTS = {
  rtcIceServers: (() => {
    const raw = readEnv('VITE_RTC_ICE_SERVERS');
    if (!raw) {
      return [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ] as RTCIceServer[];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter(
          (e): e is RTCIceServer => typeof e === 'object' && e !== null && 'urls' in e
        );
      }
    } catch {
      /* fall through */
    }
    return [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ] as RTCIceServer[];
  })(),
  reconnectGraceMs: 10_000,
  quickMatchBotFallbackMs: 20_000,
  snapshotRateHz: 20,
  appUrl: readEnv('VITE_APP_URL') || (typeof window !== 'undefined' ? window.location.origin : ''),
};
