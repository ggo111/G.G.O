export interface DebugLogEntry {
  id: number;
  time: string;
  tag: string;
  message: string;
  data?: string;
}

export interface DebugStatusState {
  authOk: boolean | null;
  authUid: string | null;
  firebaseDbOk: boolean | null;
  queueState: string;
  connectionState: string;
  iceConnectionState: string;
  dataChannelState: string;
  pingMs: number | null;
}

const MAX_LOG_LINES = 200;
let seq = 0;
let entries: DebugLogEntry[] = [];
let status: DebugStatusState = {
  authOk: null,
  authUid: null,
  firebaseDbOk: null,
  queueState: 'idle',
  connectionState: 'idle',
  iceConnectionState: 'idle',
  dataChannelState: 'idle',
  pingMs: null,
};

const logListeners = new Set<() => void>();
const statusListeners = new Set<() => void>();
const panelOpenListeners = new Set<(open: boolean) => void>();

function formatTimestamp(d: Date): string {
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

function serializeData(data: unknown): string | undefined {
  if (data === undefined) return undefined;
  if (data instanceof Error) {
    const extra = data as Error & { code?: unknown };
    return JSON.stringify({
      name: data.name,
      message: data.message,
      ...(extra.code !== undefined ? { code: extra.code } : {}),
    });
  }
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

export function log(tag: string, message: string, data?: unknown): void {
  const serialized = serializeData(data);
  if (data !== undefined) {
    console.log(`[GGO] [${tag}] ${message}`, data);
  } else {
    console.log(`[GGO] [${tag}] ${message}`);
  }

  seq += 1;
  const entry: DebugLogEntry = {
    id: seq,
    time: formatTimestamp(new Date()),
    tag,
    message,
    data: serialized,
  };

  entries = entries.length >= MAX_LOG_LINES ? [...entries.slice(entries.length - MAX_LOG_LINES + 1), entry] : [...entries, entry];
  logListeners.forEach((fn) => fn());
}

export function updateDebugStatus(patch: Partial<DebugStatusState>): void {
  let changed = false;
  for (const key of Object.keys(patch) as (keyof DebugStatusState)[]) {
    if (status[key] !== patch[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  status = { ...status, ...patch };
  statusListeners.forEach((fn) => fn());
}

export function getDebugLogs(): DebugLogEntry[] {
  return entries;
}

export function getDebugStatus(): DebugStatusState {
  return status;
}

export function clearDebugLogs(): void {
  entries = [];
  logListeners.forEach((fn) => fn());
}

export function openDebugPanel(open = true): void {
  panelOpenListeners.forEach((fn) => fn(open));
}

export function subscribeDebugLogs(fn: () => void): () => void {
  logListeners.add(fn);
  return () => {
    logListeners.delete(fn);
  };
}

export function subscribeDebugStatus(fn: () => void): () => void {
  statusListeners.add(fn);
  return () => {
    statusListeners.delete(fn);
  };
}

export function subscribeDebugPanelOpen(fn: (open: boolean) => void): () => void {
  panelOpenListeners.add(fn);
  return () => {
    panelOpenListeners.delete(fn);
  };
}

export function formatDebugDump(): string {
  const s = status;
  const header = [
    `Auth: ${s.authOk === true ? `OK (${s.authUid ?? ''})` : s.authOk === false ? 'FAIL' : 'PENDING'}`,
    `Firebase DB: ${s.firebaseDbOk === true ? 'OK' : s.firebaseDbOk === false ? 'FAIL' : 'PENDING'}`,
    `Queue: ${s.queueState}`,
    `RTC: ${s.connectionState} (ICE: ${s.iceConnectionState})`,
    `DataChannel: ${s.dataChannelState}`,
    `Ping: ${s.pingMs !== null ? `${s.pingMs}ms` : '--'}`,
  ].join(' | ');

  const lines = entries.map(
    (e) => `${e.time} [${e.tag}] ${e.message}${e.data ? ` ${e.data}` : ''}`
  );
  return `${header}\n${'-'.repeat(60)}\n${lines.join('\n')}`;
}

let hooksInstalled = false;
export function installGlobalErrorHooks(): void {
  if (hooksInstalled || typeof window === 'undefined') return;
  hooksInstalled = true;

  window.addEventListener('error', (ev) => {
    const errMsg = ev.error instanceof Error ? ev.error.message : ev.message || 'Unknown window error';
    log('WINDOW_ERROR', errMsg, {
      filename: ev.filename,
      lineno: ev.lineno,
      colno: ev.colno,
    });
  });

  window.addEventListener('unhandledrejection', (ev) => {
    const reason = ev.reason;
    const msg =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
        ? reason
        : 'Unhandled Promise Rejection';
    log('UNHANDLED_REJECTION', msg, reason);
  });
}

installGlobalErrorHooks();
