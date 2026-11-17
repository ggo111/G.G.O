import LZString from 'lz-string';
import { GGOArenaSimulation } from '../engine/physicsArena.ts';
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

/**
 * Offline Hotspot Room (WebRTC DataChannel Host-Relay)
 * Allows 2 to 5 players on the same Wi-Fi or phone hotspot to play together
 * WITHOUT internet by exchanging compact QR / short offer & answer codes.
 */

export type HotspotPacket =
  | { kind: 'join_info'; player: LobbyPlayer }
  | { kind: 'room_state'; room: RoomState }
  | { kind: 'ready_update'; playerId: string; ready: boolean; roomWeapon: RoomWeaponId; teamId: 1 | 2 }
  | { kind: 'start'; matchId: string; arenaId: string; roundDurationSec: number }
  | { kind: 'draw_submit'; playerId: string; blueprint: DrawnBlueprint }
  | { kind: 'input'; playerId: string; input: PlayerInputState }
  | { kind: 'snapshot'; snapshot: MatchSnapshot }
  | { kind: 'fx'; events: VisualEffectEvent[] }
  | { kind: 'ping'; t: number }
  | { kind: 'pong'; t: number }
  | { kind: 'rematch' };

interface PeerLink {
  slotId: string;
  pc: RTCPeerConnection;
  dc: RTCDataChannel | null;
  remotePlayerId: string | null;
  connected: boolean;
}

function compactSdp(desc: RTCSessionDescriptionInit): string {
  const payload = {
    t: desc.type === 'offer' ? 'o' : 'a',
    s: desc.sdp ?? '',
  };
  return `GGO1:${LZString.compressToEncodedURIComponent(JSON.stringify(payload))}`;
}

function expandSdp(code: string): RTCSessionDescriptionInit {
  const trimmed = code.trim();
  const body = trimmed.startsWith('GGO1:') ? trimmed.slice(5) : trimmed;
  const raw = LZString.decompressFromEncodedURIComponent(body);
  if (!raw) throw new Error('Invalid signaling code. Ask your friend to re-copy it.');
  const parsed = JSON.parse(raw) as { t: 'o' | 'a'; s: string };
  return {
    type: parsed.t === 'o' ? 'offer' : 'answer',
    sdp: parsed.s,
  };
}

async function waitForIceComplete(pc: RTCPeerConnection, timeoutMs = 1800): Promise<void> {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        window.clearTimeout(timer);
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export class HotspotRoomManager {
  private isHost = false;
  private localPlayer: LobbyPlayer | null = null;
  private room: RoomState | null = null;
  private peers: Map<string, PeerLink> = new Map();
  private hostPeer: RTCPeerConnection | null = null;
  private hostChannel: RTCDataChannel | null = null;

  private sim: GGOArenaSimulation | null = null;
  private simTimer: number | null = null;
  private guestInputTimer: number | null = null;
  private pingTimer: number | null = null;
  private inputReader: (() => PlayerInputState) | null = null;
  private lastSnapshotAt = 0;
  private lastGuestPhase: string | null = null;

  public setInputReader(reader: (() => PlayerInputState) | null) {
    this.inputReader = reader;
  }

  public onRoomUpdate?: (room: RoomState) => void;
  public onSnapshot?: (snapshot: MatchSnapshot) => void;
  public onFx?: (events: VisualEffectEvent[]) => void;
  public onPeerCountChange?: (connectedPeers: number) => void;

  public createHostRoom(
    profile: PlayerProfile,
    maxPlayers: number,
    battleFormat: BattleFormat,
    arenaId: string,
    roundDurationSec: RoundDurationSec = 60
  ): RoomState {
    this.cleanup();
    this.isHost = true;
    const hostLobbyPlayer: LobbyPlayer = {
      id: profile.playerId,
      nickname: profile.nickname,
      level: profile.level,
      mmr: profile.mmr,
      ready: true,
      isHost: true,
      isBot: false,
      teamId: 1,
      roomWeapon: 'thunder_lance',
      cosmetics: profile.equipped,
      connected: true,
    };
    this.localPlayer = hostLobbyPlayer;
    this.room = {
      roomId: `hotspot_${Date.now()}`,
      code: 'HOTSPOT',
      subMode: 'hotspot_room',
      hostId: profile.playerId,
      maxPlayers: Math.max(2, Math.min(5, maxPlayers)),
      battleFormat,
      arenaId,
      roundDurationSec: roundDurationSec === 300 ? 300 : 60,
      status: 'lobby',
      players: [hostLobbyPlayer],
    };
    this.onRoomUpdate?.(this.room);
    return this.room;
  }

  public updateHostConfig(patch: {
    maxPlayers?: number;
    battleFormat?: BattleFormat;
    arenaId?: string;
    roundDurationSec?: RoundDurationSec;
  }) {
    if (!this.isHost || !this.room) return;
    if (patch.maxPlayers !== undefined) this.room.maxPlayers = Math.max(2, Math.min(5, patch.maxPlayers));
    if (patch.battleFormat !== undefined) this.room.battleFormat = patch.battleFormat;
    if (patch.arenaId !== undefined) this.room.arenaId = patch.arenaId;
    if (patch.roundDurationSec !== undefined) {
      this.room.roundDurationSec = patch.roundDurationSec === 300 ? 300 : 60;
    }
    this.broadcastRoom();
  }

  /** Host generates an Offer code for a joining friend slot */
  public async createOfferForNextPeer(): Promise<{ slotId: string; offerCode: string }> {
    const slotId = `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const pc = new RTCPeerConnection({ iceServers: [] });
    const dc = pc.createDataChannel('ggo-sync', { ordered: true });
    const link: PeerLink = { slotId, pc, dc, remotePlayerId: null, connected: false };
    this.peers.set(slotId, link);
    log('HOTSPOT', 'Host created RTCPeerConnection offer slot', { slotId });
    updateDebugStatus({
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      dataChannelState: dc.readyState,
    });

    pc.onconnectionstatechange = () => {
      updateDebugStatus({ connectionState: pc.connectionState });
      log('RTC', `Hotspot host connectionState -> ${pc.connectionState}`, { slotId });
    };
    pc.oniceconnectionstatechange = () => {
      updateDebugStatus({ iceConnectionState: pc.iceConnectionState });
      log('RTC', `Hotspot host iceConnectionState -> ${pc.iceConnectionState}`, { slotId });
    };

    dc.onopen = () => {
      link.connected = true;
      updateDebugStatus({ dataChannelState: dc.readyState });
      log('DC', 'Hotspot host DataChannel OPEN', { slotId });
      this.notifyPeerCount();
      this.startPingLoop();
      if (this.room) this.sendPacketToPeer(link, { kind: 'room_state', room: this.room });
    };
    dc.onclose = () => {
      link.connected = false;
      updateDebugStatus({ dataChannelState: dc.readyState });
      log('DC', 'Hotspot host DataChannel CLOSED', { slotId });
      this.notifyPeerCount();
    };
    dc.onerror = (ev) => {
      log('DC_ERROR', 'Hotspot host DataChannel error', { slotId, error: String(ev) });
    };
    dc.onmessage = (ev) => {
      try {
        this.handleHostReceive(link, JSON.parse(String(ev.data)) as HotspotPacket);
      } catch (err) {
        log('DC_ERROR', 'Hotspot host failed parsing packet', err);
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await waitForIceComplete(pc);
    const finalDesc = pc.localDescription ?? offer;
    log('SIGNAL', 'Hotspot host offer created', { slotId });
    return { slotId, offerCode: compactSdp(finalDesc) };
  }

  /** Host accepts the friend's Answer code to complete the WebRTC link */
  public async acceptAnswerForPeer(slotId: string, answerCode: string): Promise<void> {
    const link = this.peers.get(slotId);
    if (!link) throw new Error('Peer slot not found. Generate a fresh offer first.');
    const desc = expandSdp(answerCode);
    await link.pc.setRemoteDescription(desc);
    log('SIGNAL', 'Hotspot host applied friend answer SDP', { slotId });
  }

  /** Friend scans/pastes Host Offer code and generates an Answer code */
  public async joinWithHostOffer(profile: PlayerProfile, offerCode: string): Promise<string> {
    this.cleanup();
    this.isHost = false;
    const myPlayer: LobbyPlayer = {
      id: profile.playerId,
      nickname: profile.nickname,
      level: profile.level,
      mmr: profile.mmr,
      ready: false,
      isHost: false,
      isBot: false,
      teamId: 2,
      roomWeapon: 'thunder_lance',
      cosmetics: profile.equipped,
      connected: true,
    };
    this.localPlayer = myPlayer;

    const pc = new RTCPeerConnection({ iceServers: [] });
    this.hostPeer = pc;
    log('NAME', 'Joining hotspot room with nickname', { id: profile.playerId, nickname: profile.nickname });
    updateDebugStatus({
      connectionState: pc.connectionState,
      iceConnectionState: pc.iceConnectionState,
      dataChannelState: 'connecting',
    });

    pc.onconnectionstatechange = () => {
      updateDebugStatus({ connectionState: pc.connectionState });
      log('RTC', `Hotspot guest connectionState -> ${pc.connectionState}`);
    };
    pc.oniceconnectionstatechange = () => {
      updateDebugStatus({ iceConnectionState: pc.iceConnectionState });
      log('RTC', `Hotspot guest iceConnectionState -> ${pc.iceConnectionState}`);
    };

    pc.ondatachannel = (ev) => {
      const ch = ev.channel;
      this.hostChannel = ch;
      updateDebugStatus({ dataChannelState: ch.readyState });
      log('DC', 'Hotspot guest received DataChannel', { readyState: ch.readyState });
      ch.onopen = () => {
        updateDebugStatus({ dataChannelState: ch.readyState });
        log('DC', 'Hotspot guest DataChannel OPEN');
        this.notifyPeerCount();
        this.sendToHost({ kind: 'join_info', player: myPlayer });
        this.startGuestInputLoop();
        this.startPingLoop();
      };
      ch.onmessage = (msgEv) => {
        try {
          const pkt = JSON.parse(String(msgEv.data)) as HotspotPacket;
          this.handleClientReceive(pkt);
        } catch (err) {
          log('DC_ERROR', 'Hotspot guest failed parsing packet', err);
        }
      };
      ch.onclose = () => {
        updateDebugStatus({ dataChannelState: ch.readyState, pingMs: null });
        log('DC', 'Hotspot guest DataChannel CLOSED');
        this.stopGuestInputLoop();
        this.stopPingLoop();
        this.notifyPeerCount();
      };
      ch.onerror = (errEv) => {
        log('DC_ERROR', 'Hotspot guest DataChannel error', String(errEv));
      };
    };

    const offerDesc = expandSdp(offerCode);
    log('SIGNAL', 'Hotspot guest applying host offer SDP');
    await pc.setRemoteDescription(offerDesc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await waitForIceComplete(pc);
    log('SIGNAL', 'Hotspot guest generated answer SDP');
    return compactSdp(pc.localDescription ?? answer);
  }

  public setLocalReady(ready: boolean, roomWeapon: RoomWeaponId, teamId: 1 | 2) {
    if (!this.localPlayer) return;
    this.localPlayer.ready = this.isHost ? true : ready;
    this.localPlayer.roomWeapon = roomWeapon;
    this.localPlayer.teamId = teamId;

    if (this.isHost && this.room) {
      const idx = this.room.players.findIndex((p) => p.id === this.localPlayer!.id);
      if (idx !== -1) this.room.players[idx] = { ...this.localPlayer };
      this.broadcastRoom();
    } else {
      this.sendToHost({
        kind: 'ready_update',
        playerId: this.localPlayer.id,
        ready,
        roomWeapon,
        teamId,
      });
    }
  }

  public startHostMatch() {
    if (!this.isHost || !this.room || this.room.players.length < 2) return;
    const format: BattleFormat =
      this.room.players.length === 2 ? '1v1' : this.room.battleFormat === '1v1' ? 'ffa' : this.room.battleFormat;

    this.room.status = 'in_match';
    this.broadcastRoom();

    const roundDurationSec: RoundDurationSec = this.room.roundDurationSec === 300 ? 300 : 60;
    this.sim = new GGOArenaSimulation({
      matchId: `hs_${Date.now()}`,
      mode: 'hotspot_room',
      battleFormat: format,
      arenaId: this.room.arenaId,
      roundDurationSec,
      participants: this.room.players.map((p, idx) => ({
        playerId: p.id,
        nickname: p.nickname,
        isBot: false,
        teamId: format === 'teams' ? p.teamId : ((idx % 2) + 1) as 1 | 2,
        roomWeapon: p.roomWeapon ?? 'thunder_lance',
        cosmetics: p.cosmetics,
        connected: true,
      })),
    });

    const startPkt: HotspotPacket = {
      kind: 'start',
      matchId: this.sim.matchId,
      arenaId: this.room.arenaId,
      roundDurationSec,
    };
    this.broadcastPacket(startPkt);
    log('START', 'Hotspot host sent "start" message', {
      matchId: this.sim.matchId,
      arenaId: this.room.arenaId,
      roundDurationSec,
    });

    const snap = this.sim.getSnapshot();
    this.broadcastSnapshot(snap);
    this.onSnapshot?.(snap);

    if (this.simTimer) window.clearInterval(this.simTimer);
    let lastTick = performance.now();
    this.simTimer = window.setInterval(() => {
      if (!this.sim) return;
      const now = performance.now();
      const dt = now - lastTick;
      lastTick = now;

      if (this.localPlayer && this.inputReader && this.sim.phase === 'FIGHTING') {
        this.sim.setPlayerInput(this.localPlayer.id, this.inputReader());
      }

      this.sim.step(dt);

      const fx = this.sim.drainFx();
      if (fx.length > 0) {
        this.onFx?.(fx);
        this.broadcastPacket({ kind: 'fx', events: fx });
      }

      if (now - this.lastSnapshotAt >= 50 || this.sim.phase === 'MATCH_OVER') {
        this.lastSnapshotAt = now;
        const s = this.sim.getSnapshot();
        this.onSnapshot?.(s);
        this.broadcastSnapshot(s);
        if (s.phase === 'MATCH_OVER') {
          window.clearInterval(this.simTimer!);
          this.simTimer = null;
        }
      }
    }, 1000 / 60);
  }

  public submitBlueprint(playerId: string, blueprint: DrawnBlueprint) {
    if (this.isHost) {
      this.sim?.submitBlueprint(playerId, blueprint);
    } else {
      this.sendToHost({ kind: 'draw_submit', playerId, blueprint });
    }
  }

  public sendInput(playerId: string, input: PlayerInputState) {
    if (this.isHost) {
      this.sim?.setPlayerInput(playerId, input);
    } else {
      this.sendToHost({ kind: 'input', playerId, input });
    }
  }

  public triggerRematch() {
    if (this.isHost && this.room) {
      if (this.simTimer) {
        window.clearInterval(this.simTimer);
        this.simTimer = null;
      }
      this.sim = null;
      this.room.status = 'lobby';
      this.room.players = this.room.players.map((p) => ({ ...p, ready: p.isHost }));
      this.broadcastRoom();
    } else {
      this.sendToHost({ kind: 'rematch' });
    }
  }

  private handleHostReceive(link: PeerLink, pkt: HotspotPacket) {
    if (pkt.kind === 'ping') {
      this.sendPacketToPeer(link, { kind: 'pong', t: pkt.t });
      return;
    }
    if (pkt.kind === 'pong') {
      updateDebugStatus({ pingMs: Math.max(1, Math.round(performance.now() - pkt.t)) });
      return;
    }
    if (!this.room) return;
    if (pkt.kind === 'join_info') {
      link.remotePlayerId = pkt.player.id;
      const exists = this.room.players.some((p) => p.id === pkt.player.id);
      if (!exists && this.room.players.length < this.room.maxPlayers) {
        const teamId: 1 | 2 = this.room.players.length % 2 === 0 ? 1 : 2;
        this.room.players = [...this.room.players, { ...pkt.player, teamId }];
        log('HOTSPOT', 'Friend joined hotspot room', { nickname: pkt.player.nickname, id: pkt.player.id });
      }
      this.broadcastRoom();
    } else if (pkt.kind === 'ready_update') {
      this.room.players = this.room.players.map((p) =>
        p.id === pkt.playerId
          ? { ...p, ready: pkt.ready, roomWeapon: pkt.roomWeapon, teamId: pkt.teamId }
          : p
      );
      this.broadcastRoom();
    } else if (pkt.kind === 'draw_submit') {
      this.sim?.submitBlueprint(pkt.playerId, pkt.blueprint);
    } else if (pkt.kind === 'input') {
      this.sim?.setPlayerInput(pkt.playerId, pkt.input);
    } else if (pkt.kind === 'rematch') {
      this.triggerRematch();
    }
  }

  private handleClientReceive(pkt: HotspotPacket) {
    if (pkt.kind === 'ping') {
      this.sendToHost({ kind: 'pong', t: pkt.t });
    } else if (pkt.kind === 'pong') {
      updateDebugStatus({ pingMs: Math.max(1, Math.round(performance.now() - pkt.t)) });
    } else if (pkt.kind === 'start') {
      log('START', 'Hotspot guest received "start" message', { matchId: pkt.matchId, arenaId: pkt.arenaId });
    } else if (pkt.kind === 'room_state') {
      this.room = pkt.room;
      this.onRoomUpdate?.(pkt.room);
    } else if (pkt.kind === 'snapshot') {
      if (pkt.snapshot.phase !== this.lastGuestPhase) {
        this.lastGuestPhase = pkt.snapshot.phase;
        log('PHASE', `Phase -> ${pkt.snapshot.phase}`, {
          matchId: pkt.snapshot.matchId,
          roundIndex: pkt.snapshot.roundIndex,
        });
      }
      this.onSnapshot?.(pkt.snapshot);
    } else if (pkt.kind === 'fx') {
      this.onFx?.(pkt.events);
    }
  }

  private broadcastRoom() {
    if (!this.room) return;
    this.onRoomUpdate?.(this.room);
    this.broadcastPacket({ kind: 'room_state', room: this.room });
  }

  private broadcastSnapshot(snapshot: MatchSnapshot) {
    this.broadcastPacket({ kind: 'snapshot', snapshot });
  }

  private broadcastPacket(pkt: HotspotPacket) {
    for (const link of this.peers.values()) {
      this.sendPacketToPeer(link, pkt);
    }
  }

  private sendPacketToPeer(link: PeerLink, pkt: HotspotPacket) {
    if (link.dc && link.dc.readyState === 'open') {
      link.dc.send(JSON.stringify(pkt));
    }
  }

  private sendToHost(pkt: HotspotPacket) {
    if (this.hostChannel && this.hostChannel.readyState === 'open') {
      this.hostChannel.send(JSON.stringify(pkt));
    }
  }

  private notifyPeerCount() {
    if (this.isHost) {
      const count = Array.from(this.peers.values()).filter((p) => p.connected).length;
      this.onPeerCountChange?.(count);
    } else {
      this.onPeerCountChange?.(this.hostChannel?.readyState === 'open' ? 1 : 0);
    }
  }

  private startGuestInputLoop() {
    this.stopGuestInputLoop();
    let pendingJump = false;
    let pendingSpecial = false;
    let lastSentAt = 0;

    this.guestInputTimer = window.setInterval(() => {
      if (!this.localPlayer || !this.inputReader) return;
      const sample = this.inputReader();
      if (sample.jump) pendingJump = true;
      if (sample.special) pendingSpecial = true;

      const now = performance.now();
      if (now - lastSentAt >= 33 || pendingJump || pendingSpecial) {
        lastSentAt = now;
        this.sendToHost({
          kind: 'input',
          playerId: this.localPlayer.id,
          input: {
            move: sample.move,
            boost: sample.boost,
            jump: pendingJump,
            lanceDir: sample.lanceDir,
            special: pendingSpecial,
          },
        });
        pendingJump = false;
        pendingSpecial = false;
      }
    }, 1000 / 60);
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.pingTimer = window.setInterval(() => {
      const now = performance.now();
      if (this.isHost) {
        for (const link of this.peers.values()) {
          if (link.dc && link.dc.readyState === 'open') {
            this.sendPacketToPeer(link, { kind: 'ping', t: now });
            break;
          }
        }
      } else if (this.hostChannel && this.hostChannel.readyState === 'open') {
        this.sendToHost({ kind: 'ping', t: now });
      }
    }, 2000);
  }

  private stopPingLoop() {
    if (this.pingTimer) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private stopGuestInputLoop() {
    if (this.guestInputTimer) {
      window.clearInterval(this.guestInputTimer);
      this.guestInputTimer = null;
    }
  }

  public cleanup() {
    this.stopGuestInputLoop();
    this.stopPingLoop();
    if (this.simTimer) {
      window.clearInterval(this.simTimer);
      this.simTimer = null;
    }
    this.sim = null;
    for (const link of this.peers.values()) {
      link.dc?.close();
      link.pc.close();
    }
    this.peers.clear();
    this.hostChannel?.close();
    this.hostChannel = null;
    this.hostPeer?.close();
    this.hostPeer = null;
    this.room = null;
    this.lastGuestPhase = null;
    updateDebugStatus({
      connectionState: 'idle',
      iceConnectionState: 'idle',
      dataChannelState: 'idle',
      pingMs: null,
    });
  }
}

export const hotspotManager = new HotspotRoomManager();
export type { CosmeticsEquipped };
