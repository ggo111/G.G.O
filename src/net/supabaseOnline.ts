/**
 * G G O — Professional Online layer (Supabase Realtime + WebRTC)
 *
 * Architecture:
 * - Identity: Supabase Anonymous Auth (via authService)
 * - Matchmaking: match_queue table + Realtime
 * - Rooms: rooms table + Realtime channel `room:{id}`
 * - Signaling: broadcast events on the room channel (offer / answer / ice)
 * - Game state: Host-authoritative Matter.js sim → snapshots over WebRTC DataChannel
 *
 * Public API mirrors the previous onlineRtc so App.tsx stays stable.
 */

import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { NETWORK_DEFAULTS } from '../config/supabaseConfig.ts';
import { ARENAS } from '../data/gameCatalog.ts';
import { GGOArenaSimulation } from '../engine/physicsArena.ts';
import { ensureSession } from '../lib/authService.ts';
import { getSupabase, isOnlineBackendReady } from '../lib/supabase.ts';
import type {
  BattleFormat,
  CosmeticsEquipped,
  DrawnBlueprint,
  LobbyPlayer,
  MatchSnapshot,
  PlayerInputState,
  PlayerProfile,
  RoomState,
  RoomWeaponId,
  RoundDurationSec,
  VisualEffectEvent,
} from '../types/game.ts';
import { log, updateDebugStatus } from '../utils/debugLog.ts';

// ---------------------------------------------------------------------------
// Packet types (DataChannel)
// ---------------------------------------------------------------------------

type OnlineDataPacket =
  | { kind: 'dc_ready' }
  | {
      kind: 'start';
      matchId: string;
      mode: 'quick_match' | 'online_room';
      arenaId: string;
      round: number;
      seed: number;
      roundDurationSec: number;
    }
  | { kind: 'draw_submit'; playerId: string; blueprint: DrawnBlueprint }
  | { kind: 'input'; playerId: string; input: PlayerInputState }
  | { kind: 'snapshot'; snapshot: MatchSnapshot }
  | { kind: 'fx'; events: VisualEffectEvent[] }
  | { kind: 'ping'; t: number }
  | { kind: 'pong'; t: number }
  | { kind: 'rematch' };

// ---------------------------------------------------------------------------
// Signaling messages (Realtime broadcast)
// ---------------------------------------------------------------------------

type SignalMsg =
  | { type: 'offer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; from: string; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; from: string; candidate: RTCIceCandidateInit }
  | { type: 'lobby_sync'; room: RoomState }
  | { type: 'peer_left'; playerId: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function iceConfig(): RTCConfiguration {
  return { iceServers: NETWORK_DEFAULTS.rtcIceServers };
}

function mapRowToRoomState(row: Record<string, unknown>): RoomState {
  const players = (Array.isArray(row.players) ? row.players : []) as LobbyPlayer[];
  return {
    roomId: String(row.id),
    code: String(row.id),
    subMode: (row.config as any)?.subMode === 'quick_match' ? 'quick_match' : 'online_room',
    hostId: String(row.host_id),
    maxPlayers: Number(row.max_players) || 2,
    battleFormat: (row.battle_format as BattleFormat) || '1v1',
    arenaId: String(row.arena_id || 'forge_arena'),
    roundDurationSec: (Number(row.round_duration) as RoundDurationSec) || 60,
    status: row.status === 'playing' || row.status === 'in_match' ? 'in_match' : 'lobby',
    players,
  };
}

function profileToLobbyPlayer(
  profile: PlayerProfile,
  opts: { isHost: boolean; ready?: boolean; teamId?: 1 | 2 }
): LobbyPlayer {
  return {
    id: profile.playerId,
    nickname: profile.nickname,
    level: profile.level,
    mmr: profile.mmr,
    ready: opts.ready ?? opts.isHost,
    isHost: opts.isHost,
    isBot: false,
    teamId: opts.teamId ?? 1,
    roomWeapon: null,
    cosmetics: profile.equipped,
    connected: true,
  };
}

// ---------------------------------------------------------------------------
// Manager
// ---------------------------------------------------------------------------

class SupabaseOnlineManager {
  private uid: string | null = null;
  private isHost = false;
  private currentRoomId: string | null = null;
  private currentRoom: RoomState | null = null;
  private channel: RealtimeChannel | null = null;

  // WebRTC
  private hostPeers = new Map<
    string,
    {
      pc: RTCPeerConnection;
      dc: RTCDataChannel | null;
      connected: boolean;
      remoteReady: boolean;
    }
  >();
  private guestPc: RTCPeerConnection | null = null;
  private guestDc: RTCDataChannel | null = null;
  private guestRemoteReady = false;

  // Simulation (host only)
  private sim: GGOArenaSimulation | null = null;
  private simTimer: number | null = null;
  private inputReader: (() => PlayerInputState) | null = null;
  private lastSnapshotAt = 0;

  // Quick match
  private botFallbackTimer: number | null = null;
  private quickMatchAborted = false;
  private queueChannel: RealtimeChannel | null = null;

  // Callbacks (same surface as old onlineRtc)
  public onAuthUid?: (uid: string) => void;
  public onNicknameAssigned?: (nickname: string) => void;
  public onRoomUpdate?: (room: RoomState | null) => void;
  public onQuickMatched?: (info: { matchId: string; isBot: boolean; opponentName: string }) => void;
  public onSnapshot?: (snapshot: MatchSnapshot) => void;
  public onFx?: (events: VisualEffectEvent[]) => void;
  public onError?: (message: string) => void;
  public onPeerReconnectNotice?: (playerId: string, nickname: string, remainingSec: number) => void;

  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  public async initAuth(): Promise<string | null> {
    try {
      const user = await ensureSession();
      if (!user) {
        updateDebugStatus({ authOk: false });
        return null;
      }
      this.uid = user.id;
      updateDebugStatus({ authOk: true, authUid: user.id });
      this.onAuthUid?.(user.id);
      return user.id;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Auth failed';
      log('AUTH_ERROR', msg, err);
      this.onError?.(msg);
      return null;
    }
  }

  public getUid(): string | null {
    return this.uid;
  }

  public setInputReader(reader: (() => PlayerInputState) | null) {
    this.inputReader = reader;
  }

  /** Nickname is claimed via authService; these exist for API compatibility. */
  public async reserveNickname(
    nick: string,
    _current?: string
  ): Promise<{ ok: boolean; error?: string; nickname?: string }> {
    const clean = nick.trim().slice(0, 20);
    if (clean.length < 2) return { ok: false, error: 'الاسم قصير جداً' };
    this.onNicknameAssigned?.(clean);
    return { ok: true, nickname: clean };
  }

  public async ensureUniqueNickname(
    profile: PlayerProfile
  ): Promise<{ nickname: string; changed: boolean }> {
    return { nickname: profile.nickname, changed: false };
  }

  // -------------------------------------------------------------------------
  // Quick Match
  // -------------------------------------------------------------------------

  public async joinQuickMatch(profile: PlayerProfile, onLocalBotFallback: () => void): Promise<void> {
    await this.leaveAll();
    this.quickMatchAborted = false;

    const uid = (await this.initAuth()) || profile.playerId;
    this.uid = uid;

    const sb = getSupabase();
    if (!sb || !isOnlineBackendReady()) {
      // Offline / no backend → bot fallback after short delay
      this.botFallbackTimer = window.setTimeout(() => {
        if (!this.quickMatchAborted) onLocalBotFallback();
      }, 1500);
      return;
    }

    try {
      // Upsert into queue
      await sb.from('match_queue').upsert(
        {
          user_id: uid,
          nickname: profile.nickname,
          mmr: profile.mmr,
          avatar_id: profile.avatarId || 'fox',
        },
        { onConflict: 'user_id' }
      );

      // Listen for room assignment via a personal channel + poll
      this.queueChannel = sb.channel(`queue:${uid}`);
      this.queueChannel
        .on('broadcast', { event: 'matched' }, (payload) => {
          const data = payload.payload as { roomId: string; isHost: boolean; opponentName: string };
          void this.enterMatchedRoom(profile, data.roomId, data.isHost, data.opponentName);
        })
        .subscribe();

      // Simple matchmaker: look for another waiting player
      void this.tryPairQuickMatch(profile);

      // Bot fallback
      this.botFallbackTimer = window.setTimeout(() => {
        if (!this.quickMatchAborted && !this.currentRoomId) {
          void this.cancelQuickMatch();
          onLocalBotFallback();
        }
      }, NETWORK_DEFAULTS.quickMatchBotFallbackMs);
    } catch (err) {
      log('QM_ERROR', 'joinQuickMatch failed', err);
      this.onError?.(err instanceof Error ? err.message : 'تعذر دخول قائمة الانتظار');
      onLocalBotFallback();
    }
  }

  private async tryPairQuickMatch(profile: PlayerProfile) {
    const sb = getSupabase();
    if (!sb || !this.uid || this.quickMatchAborted) return;

    // Find oldest other player in queue
    const { data: candidates } = await sb
      .from('match_queue')
      .select('*')
      .neq('user_id', this.uid)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!candidates?.length) {
      // Retry shortly
      window.setTimeout(() => void this.tryPairQuickMatch(profile), 1200);
      return;
    }

    const opponent = candidates[0];
    const roomId = generateRoomCode();

    // Create room (we become host)
    const hostPlayer = profileToLobbyPlayer(profile, { isHost: true, ready: true, teamId: 1 });
    const guestPlayer: LobbyPlayer = {
      id: opponent.user_id,
      nickname: opponent.nickname,
      level: 1,
      mmr: opponent.mmr ?? 1000,
      ready: true,
      isHost: false,
      isBot: false,
      teamId: 2,
      roomWeapon: null,
      cosmetics: profile.equipped, // placeholder until lobby_sync
      connected: true,
    };

    const { error } = await sb.from('rooms').insert({
      id: roomId,
      host_id: this.uid,
      status: 'lobby',
      max_players: 2,
      battle_format: '1v1',
      arena_id: ARENAS[0]?.id || 'forge_arena',
      round_duration: 60,
      players: [hostPlayer, guestPlayer],
      config: { subMode: 'quick_match' },
    });

    if (error) {
      log('QM_ERROR', 'create room failed', error);
      window.setTimeout(() => void this.tryPairQuickMatch(profile), 1500);
      return;
    }

    // Remove both from queue
    await sb.from('match_queue').delete().in('user_id', [this.uid, opponent.user_id]);

    // Notify opponent via their queue channel
    const oppCh = sb.channel(`queue:${opponent.user_id}`);
    await oppCh.subscribe();
    await oppCh.send({
      type: 'broadcast',
      event: 'matched',
      payload: { roomId, isHost: false, opponentName: profile.nickname },
    });
    void sb.removeChannel(oppCh);

    // Enter as host
    await this.enterMatchedRoom(profile, roomId, true, opponent.nickname);
  }

  private async enterMatchedRoom(
    profile: PlayerProfile,
    roomId: string,
    asHost: boolean,
    opponentName: string
  ) {
    if (this.quickMatchAborted || this.currentRoomId) return;
    this.clearBotTimer();
    this.quickMatchAborted = true;

    this.onQuickMatched?.({ matchId: roomId, isBot: false, opponentName });

    if (asHost) {
      await this.attachAsHost(profile, roomId, 'quick_match');
      // Auto-start after short delay (both considered ready)
      window.setTimeout(() => {
        if (this.currentRoomId === roomId && this.isHost) {
          void this.startOnlineRoomMatch();
        }
      }, 800);
    } else {
      await this.attachAsGuest(profile, roomId);
    }
  }

  public async cancelQuickMatch(): Promise<void> {
    this.quickMatchAborted = true;
    this.clearBotTimer();
    const sb = getSupabase();
    if (sb && this.uid) {
      await sb.from('match_queue').delete().eq('user_id', this.uid).catch(() => {});
    }
    if (this.queueChannel) {
      const sb2 = getSupabase();
      if (sb2) void sb2.removeChannel(this.queueChannel);
      this.queueChannel = null;
    }
  }

  private clearBotTimer() {
    if (this.botFallbackTimer) {
      clearTimeout(this.botFallbackTimer);
      this.botFallbackTimer = null;
    }
  }

  // -------------------------------------------------------------------------
  // Private Rooms
  // -------------------------------------------------------------------------

  public async createOnlineRoom(
    profile: PlayerProfile,
    maxPlayers: number,
    battleFormat: BattleFormat,
    arenaId: string,
    roundDurationSec: RoundDurationSec
  ): Promise<void> {
    await this.leaveAll();
    const uid = (await this.initAuth()) || profile.playerId;
    this.uid = uid;

    const sb = getSupabase();
    if (!sb) {
      this.onError?.('الخادم غير متصل');
      return;
    }

    const code = generateRoomCode();
    const hostPlayer = profileToLobbyPlayer(profile, { isHost: true, ready: true, teamId: 1 });

    const { error } = await sb.from('rooms').insert({
      id: code,
      host_id: uid,
      status: 'lobby',
      max_players: Math.min(4, Math.max(2, maxPlayers)),
      battle_format: battleFormat,
      arena_id: arenaId,
      round_duration: roundDurationSec,
      players: [hostPlayer],
      config: { subMode: 'online_room' },
    });

    if (error) {
      log('ROOM_ERROR', 'create failed', error);
      this.onError?.(error.message || 'فشل إنشاء الغرفة');
      return;
    }

    await this.attachAsHost(profile, code, 'online_room');
  }

  public async joinOnlineRoom(profile: PlayerProfile, rawCode: string): Promise<void> {
    await this.leaveAll();
    const uid = (await this.initAuth()) || profile.playerId;
    this.uid = uid;

    const code = rawCode.trim().toUpperCase();
    if (code.length < 4) {
      this.onError?.('كود الغرفة غير صالح');
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      this.onError?.('الخادم غير متصل');
      return;
    }

    const { data: row, error } = await sb.from('rooms').select('*').eq('id', code).maybeSingle();
    if (error || !row) {
      this.onError?.('الغرفة غير موجودة');
      return;
    }
    if (row.status !== 'lobby') {
      this.onError?.('المباراة بدأت بالفعل');
      return;
    }

    const players = (Array.isArray(row.players) ? row.players : []) as LobbyPlayer[];
    if (players.length >= (row.max_players || 2)) {
      this.onError?.('الغرفة ممتلئة');
      return;
    }
    if (players.some((p) => p.id === uid)) {
      // already in
      await this.attachAsGuest(profile, code);
      return;
    }

    const teamId: 1 | 2 = players.length % 2 === 0 ? 1 : 2;
    const me = profileToLobbyPlayer(profile, { isHost: false, ready: false, teamId });
    const nextPlayers = [...players, me];

    const { error: upErr } = await sb
      .from('rooms')
      .update({ players: nextPlayers })
      .eq('id', code);

    if (upErr) {
      this.onError?.(upErr.message || 'فشل الانضمام');
      return;
    }

    await this.attachAsGuest(profile, code);
  }

  public async updateRoomConfig(patch: {
    maxPlayers?: number;
    battleFormat?: BattleFormat;
    arenaId?: string;
    roundDurationSec?: RoundDurationSec;
  }): Promise<void> {
    if (!this.isHost || !this.currentRoomId) return;
    const sb = getSupabase();
    if (!sb) return;

    const updates: Record<string, unknown> = {};
    if (patch.maxPlayers != null) updates.max_players = patch.maxPlayers;
    if (patch.battleFormat) updates.battle_format = patch.battleFormat;
    if (patch.arenaId) updates.arena_id = patch.arenaId;
    if (patch.roundDurationSec) updates.round_duration = patch.roundDurationSec;

    await sb.from('rooms').update(updates).eq('id', this.currentRoomId);
    // Channel will push lobby_sync from postgres_changes or we broadcast
    await this.broadcastLobby();
  }

  public async updateLocalReady(
    ready: boolean,
    roomWeapon: RoomWeaponId,
    teamId: 1 | 2
  ): Promise<void> {
    if (!this.uid || !this.currentRoomId || !this.currentRoom) return;
    const sb = getSupabase();
    if (!sb) return;

    const players = this.currentRoom.players.map((p) =>
      p.id === this.uid
        ? { ...p, ready, roomWeapon, teamId, connected: true }
        : p
    );

    await sb.from('rooms').update({ players }).eq('id', this.currentRoomId);
    this.currentRoom = { ...this.currentRoom, players };
    this.onRoomUpdate?.(this.currentRoom);
    await this.broadcastLobby();
  }

  public async startOnlineRoomMatch(): Promise<void> {
    if (!this.isHost || !this.currentRoom || !this.currentRoomId) return;

    const readyCount = this.currentRoom.players.filter((p) => p.ready && p.connected).length;
    if (readyCount < 2 && this.currentRoom.subMode === 'online_room') {
      this.onError?.('تحتاج لاعبين جاهزين على الأقل');
      return;
    }

    const sb = getSupabase();
    if (sb) {
      await sb.from('rooms').update({ status: 'playing' }).eq('id', this.currentRoomId);
    }

    this.currentRoom = { ...this.currentRoom, status: 'in_match' };
    this.onRoomUpdate?.(this.currentRoom);
    await this.broadcastLobby();
    this.beginHostSimulation(
      this.currentRoom.subMode === 'quick_match' ? 'quick_match' : 'online_room'
    );
  }

  // -------------------------------------------------------------------------
  // Attach host / guest + Realtime channel
  // -------------------------------------------------------------------------

  private async attachAsHost(
    profile: PlayerProfile,
    roomId: string,
    subMode: 'quick_match' | 'online_room'
  ) {
    this.isHost = true;
    this.currentRoomId = roomId;
    this.uid = this.uid || profile.playerId;

    const sb = getSupabase();
    if (!sb) return;

    // Load current room state
    const { data: row } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (row) {
      this.currentRoom = mapRowToRoomState({ ...row, config: { ...(row.config as object), subMode } });
    } else {
      this.currentRoom = {
        roomId,
        code: roomId,
        subMode,
        hostId: this.uid,
        maxPlayers: 2,
        battleFormat: '1v1',
        arenaId: ARENAS[0]?.id || 'forge_arena',
        roundDurationSec: 60,
        status: 'lobby',
        players: [profileToLobbyPlayer(profile, { isHost: true, ready: true })],
      };
    }

    this.onRoomUpdate?.(this.currentRoom);
    await this.subscribeRoomChannel(roomId);

    // For each non-host player, create WebRTC offer
    for (const p of this.currentRoom.players) {
      if (p.id !== this.uid && !p.isBot) {
        void this.hostConnectToPeer(p.id);
      }
    }
  }

  private async attachAsGuest(profile: PlayerProfile, roomId: string) {
    this.isHost = false;
    this.currentRoomId = roomId;
    this.uid = this.uid || profile.playerId;

    const sb = getSupabase();
    if (!sb) return;

    const { data: row } = await sb.from('rooms').select('*').eq('id', roomId).maybeSingle();
    if (row) {
      this.currentRoom = mapRowToRoomState(row);
      this.onRoomUpdate?.(this.currentRoom);
    }

    await this.subscribeRoomChannel(roomId);
    // Guest waits for offer via broadcast
  }

  private async subscribeRoomChannel(roomId: string) {
    const sb = getSupabase();
    if (!sb) return;

    if (this.channel) {
      void sb.removeChannel(this.channel);
      this.channel = null;
    }

    this.channel = sb.channel(`room:${roomId}`, {
      config: { broadcast: { self: false } },
    });

    this.channel
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        void this.handleSignal(payload as SignalMsg);
      })
      .on('broadcast', { event: 'lobby' }, ({ payload }) => {
        const room = payload as RoomState;
        this.currentRoom = room;
        this.onRoomUpdate?.(room);

        // Host: connect to any new peers
        if (this.isHost && room.status === 'lobby') {
          for (const p of room.players) {
            if (p.id !== this.uid && !p.isBot && !this.hostPeers.has(p.id)) {
              void this.hostConnectToPeer(p.id);
            }
          }
        }

        // Auto-start already handled by host
        if (!this.isHost && room.status === 'in_match' && !this.guestDc) {
          // wait for offer
        }
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
        (payload) => {
          if (payload.new && typeof payload.new === 'object') {
            const room = mapRowToRoomState(payload.new as Record<string, unknown>);
            this.currentRoom = room;
            this.onRoomUpdate?.(room);
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          log('ROOM', 'Realtime channel subscribed', { roomId });
          if (this.isHost) await this.broadcastLobby();
        }
      });
  }

  private async broadcastLobby() {
    if (!this.channel || !this.currentRoom) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'lobby',
      payload: this.currentRoom,
    });
  }

  private async sendSignal(msg: SignalMsg) {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'signal',
      payload: msg,
    });
  }

  // -------------------------------------------------------------------------
  // WebRTC — Host side
  // -------------------------------------------------------------------------

  private async hostConnectToPeer(peerUid: string) {
    if (this.hostPeers.has(peerUid) || !this.uid) return;

    const pc = new RTCPeerConnection(iceConfig());
    const slot = {
      pc,
      dc: null as RTCDataChannel | null,
      connected: false,
      remoteReady: false,
    };
    this.hostPeers.set(peerUid, slot);

    const dc = pc.createDataChannel('ggo', { ordered: true });
    slot.dc = dc;

    dc.onopen = () => {
      slot.connected = true;
      log('RTC', 'Host DC open', { peerUid });
      this.sendPacketTo(peerUid, { kind: 'dc_ready' });
    };
    dc.onclose = () => {
      slot.connected = false;
    };
    dc.onmessage = (ev) => {
      try {
        const pkt = JSON.parse(String(ev.data)) as OnlineDataPacket;
        this.handleDataPacket(pkt, peerUid);
      } catch {
        /* ignore */
      }
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        void this.sendSignal({
          type: 'ice',
          from: this.uid!,
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    pc.onconnectionstatechange = () => {
      log('RTC', 'Host PC state', { peerUid, state: pc.connectionState });
      if (pc.connectionState === 'connected') slot.connected = true;
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        slot.connected = false;
      }
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await this.sendSignal({ type: 'offer', from: this.uid, sdp: offer });
    } catch (err) {
      log('RTC_ERROR', 'createOffer failed', err);
    }
  }

  // -------------------------------------------------------------------------
  // WebRTC — Guest side
  // -------------------------------------------------------------------------

  private async guestHandleOffer(from: string, sdp: RTCSessionDescriptionInit) {
    if (this.guestPc || !this.uid) return;

    const pc = new RTCPeerConnection(iceConfig());
    this.guestPc = pc;

    pc.ondatachannel = (ev) => {
      const dc = ev.channel;
      this.guestDc = dc;
      dc.onopen = () => {
        log('RTC', 'Guest DC open');
        this.sendToHost({ kind: 'dc_ready' });
      };
      dc.onmessage = (e) => {
        try {
          const pkt = JSON.parse(String(e.data)) as OnlineDataPacket;
          this.handleDataPacket(pkt, from);
        } catch {
          /* ignore */
        }
      };
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        void this.sendSignal({
          type: 'ice',
          from: this.uid!,
          candidate: ev.candidate.toJSON(),
        });
      }
    };

    try {
      await pc.setRemoteDescription(sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.sendSignal({ type: 'answer', from: this.uid, sdp: answer });
    } catch (err) {
      log('RTC_ERROR', 'guest answer failed', err);
    }
  }

  private async handleSignal(msg: SignalMsg) {
    if (!this.uid) return;

    if (msg.type === 'offer' && !this.isHost && msg.from !== this.uid) {
      await this.guestHandleOffer(msg.from, msg.sdp);
      return;
    }

    if (msg.type === 'answer' && this.isHost) {
      const slot = this.hostPeers.get(msg.from);
      if (slot && slot.pc.signalingState !== 'stable') {
        try {
          await slot.pc.setRemoteDescription(msg.sdp);
        } catch (err) {
          log('RTC_ERROR', 'setRemoteDescription answer', err);
        }
      }
      return;
    }

    if (msg.type === 'ice') {
      if (this.isHost) {
        const slot = this.hostPeers.get(msg.from);
        if (slot && msg.candidate) {
          try {
            await slot.pc.addIceCandidate(msg.candidate);
          } catch {
            /* ignore late candidates */
          }
        }
      } else if (this.guestPc && msg.from !== this.uid && msg.candidate) {
        try {
          await this.guestPc.addIceCandidate(msg.candidate);
        } catch {
          /* ignore */
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // DataChannel send / receive
  // -------------------------------------------------------------------------

  private sendPacketTo(peerUid: string, pkt: OnlineDataPacket) {
    const slot = this.hostPeers.get(peerUid);
    if (slot?.dc && slot.dc.readyState === 'open') {
      slot.dc.send(JSON.stringify(pkt));
    }
  }

  private broadcastPacket(pkt: OnlineDataPacket) {
    for (const [peerUid] of this.hostPeers) {
      this.sendPacketTo(peerUid, pkt);
    }
  }

  private sendToHost(pkt: OnlineDataPacket) {
    if (this.guestDc && this.guestDc.readyState === 'open') {
      this.guestDc.send(JSON.stringify(pkt));
    }
  }

  private handleDataPacket(pkt: OnlineDataPacket, fromUid: string) {
    switch (pkt.kind) {
      case 'dc_ready':
        if (this.isHost) {
          const slot = this.hostPeers.get(fromUid);
          if (slot) slot.remoteReady = true;
        } else {
          this.guestRemoteReady = true;
        }
        break;
      case 'start':
        // Guest receives start → wait for snapshots
        log('MATCH', 'Received start', pkt);
        break;
      case 'draw_submit':
        if (this.isHost && this.sim) {
          this.sim.submitBlueprint(pkt.playerId, pkt.blueprint);
        }
        break;
      case 'input':
        if (this.isHost && this.sim) {
          this.sim.setPlayerInput(pkt.playerId, pkt.input);
        }
        break;
      case 'snapshot':
        if (!this.isHost) {
          this.onSnapshot?.(pkt.snapshot);
        }
        break;
      case 'fx':
        if (!this.isHost) {
          this.onFx?.(pkt.events);
        }
        break;
      case 'ping':
        if (this.isHost) {
          this.sendPacketTo(fromUid, { kind: 'pong', t: pkt.t });
        } else {
          this.sendToHost({ kind: 'pong', t: pkt.t });
        }
        break;
      case 'rematch':
        if (this.isHost) {
          void this.startOnlineRoomMatch();
        }
        break;
      default:
        break;
    }
  }

  // -------------------------------------------------------------------------
  // Host simulation loop
  // -------------------------------------------------------------------------

  private beginHostSimulation(mode: 'quick_match' | 'online_room') {
    if (!this.currentRoom || !this.uid) return;

    this.stopHostSimulation();

    const seed = Math.floor(Math.random() * 1e9);
    const roundDurationSec = this.currentRoom.roundDurationSec || 60;
    const arenaId = this.currentRoom.arenaId;

    this.sim = new GGOArenaSimulation({
      matchId: this.currentRoom.roomId,
      mode,
      battleFormat: this.currentRoom.battleFormat || '1v1',
      arenaId,
      seed,
      roundDurationSec,
      participants: this.currentRoom.players.map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        isBot: p.isBot,
        teamId: p.teamId,
        cosmetics: p.cosmetics,
        roomWeapon: p.roomWeapon,
        connected: p.connected,
      })),
    });

    // Register human players
    for (const p of this.currentRoom.players) {
      if (!p.isBot) {
        // sim should already have them from constructor config
      }
    }

    const startPkt: OnlineDataPacket = {
      kind: 'start',
      matchId: this.currentRoom.roomId,
      mode,
      arenaId,
      round: 0,
      seed,
      roundDurationSec,
    };
    this.broadcastPacket(startPkt);

    const initialSnap = this.sim.getSnapshot();
    this.onSnapshot?.(initialSnap);
    this.broadcastPacket({ kind: 'snapshot', snapshot: initialSnap });

    let lastTick = performance.now();
    this.simTimer = window.setInterval(() => {
      if (!this.sim) return;
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;

      if (this.uid && this.inputReader && this.sim.phase === 'FIGHTING') {
        this.sim.setPlayerInput(this.uid, this.inputReader());
      }

      this.sim.step(dt);

      const fx = this.sim.drainFx();
      if (fx.length > 0) {
        this.onFx?.(fx);
        this.broadcastPacket({ kind: 'fx', events: fx });
      }

      if (
        now - this.lastSnapshotAt >= 1000 / NETWORK_DEFAULTS.snapshotRateHz ||
        this.sim.phase === 'MATCH_OVER'
      ) {
        this.lastSnapshotAt = now;
        const snap = this.sim.getSnapshot();
        this.onSnapshot?.(snap);
        this.broadcastPacket({ kind: 'snapshot', snapshot: snap });

        if (snap.phase === 'MATCH_OVER') {
          this.stopHostSimulation();
          if (mode === 'online_room') {
            void this.resetRoomToLobby();
          }
        }
      }
    }, 1000 / 60);
  }

  private stopHostSimulation() {
    if (this.simTimer) {
      clearInterval(this.simTimer);
      this.simTimer = null;
    }
    this.sim = null;
  }

  private async resetRoomToLobby() {
    if (!this.isHost || !this.currentRoomId || !this.currentRoom) return;
    const sb = getSupabase();
    const players = this.currentRoom.players.map((p) => ({
      ...p,
      ready: p.isHost,
    }));
    if (sb) {
      await sb
        .from('rooms')
        .update({ status: 'lobby', players })
        .eq('id', this.currentRoomId);
    }
    this.currentRoom = { ...this.currentRoom, status: 'lobby', players };
    this.onRoomUpdate?.(this.currentRoom);
    await this.broadcastLobby();
  }

  // -------------------------------------------------------------------------
  // Public game actions
  // -------------------------------------------------------------------------

  public submitBlueprint(blueprint: DrawnBlueprint) {
    if (!this.uid) return;
    if (this.isHost) {
      this.sim?.submitBlueprint(this.uid, blueprint);
    } else {
      this.sendToHost({ kind: 'draw_submit', playerId: this.uid, blueprint });
    }
  }

  public sendInput(input: PlayerInputState) {
    if (!this.uid) return;
    if (this.isHost) {
      this.sim?.setPlayerInput(this.uid, input);
    } else {
      this.sendToHost({ kind: 'input', playerId: this.uid, input });
    }
  }

  public triggerRematch() {
    if (this.isHost) {
      void this.startOnlineRoomMatch();
    } else {
      this.sendToHost({ kind: 'rematch' });
    }
  }

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  public async leaveAll(): Promise<void> {
    this.quickMatchAborted = true;
    this.clearBotTimer();
    this.stopHostSimulation();

    // Close WebRTC
    for (const [, slot] of this.hostPeers) {
      try {
        slot.dc?.close();
        slot.pc.close();
      } catch {
        /* ignore */
      }
    }
    this.hostPeers.clear();

    try {
      this.guestDc?.close();
      this.guestPc?.close();
    } catch {
      /* ignore */
    }
    this.guestDc = null;
    this.guestPc = null;
    this.guestRemoteReady = false;

    const sb = getSupabase();
    if (sb) {
      if (this.channel) {
        void sb.removeChannel(this.channel);
        this.channel = null;
      }
      if (this.queueChannel) {
        void sb.removeChannel(this.queueChannel);
        this.queueChannel = null;
      }
      if (this.uid) {
        await sb.from('match_queue').delete().eq('user_id', this.uid).catch(() => {});
      }
      // If host leaves lobby, mark room closed
      if (this.isHost && this.currentRoomId && this.currentRoom?.status === 'lobby') {
        await sb
          .from('rooms')
          .update({ status: 'closed' })
          .eq('id', this.currentRoomId)
          .catch(() => {});
      }
    }

    this.currentRoomId = null;
    this.currentRoom = null;
    this.isHost = false;
    this.onRoomUpdate?.(null);
  }
}

export const onlineRtc = new SupabaseOnlineManager();
