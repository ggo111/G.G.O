import React, { useState } from 'react';
import {
  ArrowLeft,
  Check,
  Copy,
  Link2,
  Play,
  QrCode,
  Radio,
  Shield,
  Users,
  WifiOff,
  Zap,
} from 'lucide-react';
import { ARENAS, ROOM_WEAPONS } from '../data/gameCatalog.ts';
import type {
  BattleFormat,
  PlayerProfile,
  RoomState,
  RoomWeaponId,
  RoundDurationSec,
} from '../types/game.ts';
import { CopyCodeBox, QrCodeDisplay, QrScannerModal } from './QrWidgets.tsx';

interface PrivateRoomLobbyProps {
  profile: PlayerProfile;
  room: RoomState | null;
  errorMsg: string | null;
  // Online actions
  onCreateOnlineRoom: (
    maxPlayers: number,
    battleFormat: BattleFormat,
    arenaId: string,
    roundDurationSec: RoundDurationSec
  ) => void;
  onJoinOnlineRoom: (code: string) => void;
  onConfigOnlineRoom: (patch: {
    maxPlayers?: number;
    battleFormat?: BattleFormat;
    arenaId?: string;
    roundDurationSec?: RoundDurationSec;
  }) => void;
  onOnlineReady: (ready: boolean, weapon: RoomWeaponId, teamId: 1 | 2) => void;
  onStartOnlineRoom: () => void;
  onLeaveRoom: () => void;
  // Offline Hotspot actions
  onCreateHotspotRoom: (
    maxPlayers: number,
    battleFormat: BattleFormat,
    arenaId: string,
    roundDurationSec: RoundDurationSec
  ) => void;
  onHotspotGenerateOffer: () => Promise<{ slotId: string; offerCode: string }>;
  onHotspotAcceptAnswer: (slotId: string, answerCode: string) => Promise<void>;
  onHotspotJoinOffer: (offerCode: string) => Promise<string>;
  onHotspotConfig: (patch: {
    maxPlayers?: number;
    battleFormat?: BattleFormat;
    arenaId?: string;
    roundDurationSec?: RoundDurationSec;
  }) => void;
  onHotspotReady: (ready: boolean, weapon: RoomWeaponId, teamId: 1 | 2) => void;
  onStartHotspotRoom: () => void;
  onBack: () => void;
}

export const PrivateRoomLobby: React.FC<PrivateRoomLobbyProps> = ({
  profile,
  room,
  errorMsg,
  onCreateOnlineRoom,
  onJoinOnlineRoom,
  onConfigOnlineRoom,
  onOnlineReady,
  onStartOnlineRoom,
  onLeaveRoom,
  onCreateHotspotRoom,
  onHotspotGenerateOffer,
  onHotspotAcceptAnswer,
  onHotspotJoinOffer,
  onHotspotConfig,
  onHotspotReady,
  onStartHotspotRoom,
  onBack,
}) => {
  const [joinCode, setJoinCode] = useState('');
  const [createMaxPlayers, setCreateMaxPlayers] = useState(4);
  const [createFormat, setCreateFormat] = useState<BattleFormat>('ffa');
  const [createArena, setCreateArena] = useState(ARENAS[0].id);
  const [createRoundSec, setCreateRoundSec] = useState<RoundDurationSec>(() =>
    profile.controlSettings.roundDurationSec === 300 ? 300 : 60
  );

  // Hotspot handshake UI states
  const [hotspotSlot, setHotspotSlot] = useState<{ slotId: string; offerCode: string } | null>(null);
  const [guestAnswerCode, setGuestAnswerCode] = useState<string | null>(null);
  const [scannerMode, setScannerMode] = useState<'guest_scan_offer' | 'host_scan_answer' | null>(null);
  const [hotspotStatus, setHotspotStatus] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  const [selectedWeapon, setSelectedWeapon] = useState<RoomWeaponId>('thunder_lance');

  // If currently inside a room, render the unified Online/Hotspot Room Lobby!
  if (room) {
    const isHost = room.hostId === profile.playerId;
    const isHotspot = room.subMode === 'hotspot_room';
    const me = room.players.find((p) => p.id === profile.playerId);
    const allReady = room.players.length >= 2 && room.players.every((p) => p.ready || p.isHost);

    const inviteUrl =
      typeof window !== 'undefined' ? `${window.location.origin}/?room=${room.code}` : '';

    const handleCopyInvite = async () => {
      try {
        await navigator.clipboard.writeText(inviteUrl);
        setCopiedInvite(true);
        window.setTimeout(() => setCopiedInvite(false), 1800);
      } catch {
        // Ignore clipboard errors
      }
    };

    const handleReadyToggle = (weapon: RoomWeaponId, readyVal: boolean, teamVal: 1 | 2) => {
      setSelectedWeapon(weapon);
      if (isHotspot) {
        onHotspotReady(readyVal, weapon, teamVal);
      } else {
        onOnlineReady(readyVal, weapon, teamVal);
      }
    };

    const handleHostConfig = (patch: {
      maxPlayers?: number;
      battleFormat?: BattleFormat;
      arenaId?: string;
      roundDurationSec?: RoundDurationSec;
    }) => {
      if (isHotspot) onHotspotConfig(patch);
      else onConfigOnlineRoom(patch);
    };

    return (
      <div className="w-full h-full overflow-y-auto forge-scroll bg-[#161412] p-4 sm:p-6">
        <div className="max-w-5xl mx-auto flex flex-col gap-5">
          {/* Top Room Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                setHotspotSlot(null);
                setGuestAnswerCode(null);
                onLeaveRoom();
              }}
              className="min-h-[44px] px-3.5 rounded-xl bg-[#221E1B] hover:bg-[#2E2925] border border-white/10 text-sm font-semibold text-[#F5EFE6] flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Leave Room</span>
            </button>

            <div className="flex items-center gap-3">
              {!isHotspot ? (
                <>
                  <div className="px-3.5 py-2 rounded-xl bg-[#221E1B] border border-[#D99B26]/40 text-xs font-mono">
                    <span className="text-[#C7BEB2]">CODE </span>
                    <span className="text-base font-extrabold text-[#D99B26] tracking-widest">
                      {room.code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="min-h-[44px] px-3.5 rounded-xl bg-[#221E1B] hover:bg-[#2E2925] border border-[#38BDF8]/35 text-xs font-semibold text-[#F5EFE6] flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedInvite ? <Check className="w-4 h-4 text-[#10B981]" /> : <Link2 className="w-4 h-4 text-[#38BDF8]" />}
                    <span>{copiedInvite ? 'Link Copied' : 'Copy Invite Link'}</span>
                  </button>
                </>
              ) : (
                <div className="px-3.5 py-2 rounded-xl bg-[#221E1B] border border-[#10B981]/40 text-xs font-mono text-[#10B981] flex items-center gap-2">
                  <WifiOff className="w-4 h-4" />
                  <span>HOTSPOT OFFLINE WEBRTC</span>
                </div>
              )}
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl bg-red-950/60 border border-red-500/40 px-4 py-2.5 text-xs text-red-200">
              {errorMsg}
            </div>
          )}

          {/* Hotspot Host QR Pairing Panel */}
          {isHotspot && isHost && room.players.length < room.maxPlayers && (
            <div className="rounded-2xl bg-[#221E1B] border border-[#10B981]/35 p-4 sm:p-5 flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-lg font-bold text-[#F5EFE6]">
                    Invite Hotspot Friend ({room.players.length}/{room.maxPlayers} Joined)
                  </h3>
                  <p className="text-xs text-[#C7BEB2]">
                    Works with zero internet on the same Wi-Fi or mobile hotspot. Generate an Offer QR, let your friend scan it, then scan their Answer QR.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    setHotspotStatus('Generating peer offer...');
                    try {
                      const offer = await onHotspotGenerateOffer();
                      setHotspotSlot(offer);
                      setHotspotStatus(null);
                    } catch (err) {
                      setHotspotStatus(err instanceof Error ? err.message : 'Failed to create offer');
                    }
                  }}
                  className="min-h-[44px] px-4 rounded-xl bg-[#10B981] hover:bg-[#22C55E] text-[#161412] text-xs font-extrabold flex items-center gap-2 cursor-pointer whitespace-nowrap"
                >
                  <QrCode className="w-4 h-4" />
                  <span>{hotspotSlot ? 'New Friend Offer' : 'Add Friend via QR'}</span>
                </button>
              </div>

              {hotspotStatus && <p className="text-xs text-[#D99B26]">{hotspotStatus}</p>}

              {hotspotSlot && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-white/10">
                  <div className="flex flex-col items-center gap-3">
                    <span className="text-xs font-semibold text-[#F5EFE6]">
                      Step 1 · Friend scans or copies Offer
                    </span>
                    <QrCodeDisplay value={hotspotSlot.offerCode} size={172} />
                    <CopyCodeBox label="Offer Code" value={hotspotSlot.offerCode} />
                  </div>
                  <div className="flex flex-col justify-center gap-3">
                    <span className="text-xs font-semibold text-[#F5EFE6]">
                      Step 2 · Scan or paste Friend&apos;s Answer
                    </span>
                    <button
                      type="button"
                      onClick={() => setScannerMode('host_scan_answer')}
                      className="min-h-[46px] px-4 rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Paste / Decode Answer Code</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Main 2-column Lobby Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Left: Room Players & Host Settings */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              {isHost && (
                <div className="rounded-2xl bg-[#221E1B] border border-[#D99B26]/25 p-4 flex flex-col gap-3">
                  <h3 className="text-xs font-mono text-[#D99B26]">HOST CONTROLS</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] text-[#C7BEB2] block mb-1">Max Players</label>
                      <div className="flex gap-1">
                        {[2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => handleHostConfig({ maxPlayers: n })}
                            className={`flex-1 min-h-[40px] rounded-lg text-xs font-mono font-bold cursor-pointer ${
                              room.maxPlayers === n
                                ? 'bg-[#E85D2A] text-white'
                                : 'bg-[#161412] text-[#C7BEB2]'
                            }`}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#C7BEB2] block mb-1">Battle Format</label>
                      <select
                        value={room.battleFormat}
                        onChange={(e) => handleHostConfig({ battleFormat: e.target.value as BattleFormat })}
                        className="w-full min-h-[40px] rounded-lg bg-[#161412] border border-white/10 px-2.5 text-xs font-semibold text-[#F5EFE6]"
                      >
                        <option value="ffa">Free-For-All (3–5)</option>
                        <option value="1v1">1v1 Duel</option>
                        <option value="teams">Team Battle</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#C7BEB2] block mb-1">Arena</label>
                      <select
                        value={room.arenaId}
                        onChange={(e) => handleHostConfig({ arenaId: e.target.value })}
                        className="w-full min-h-[40px] rounded-lg bg-[#161412] border border-white/10 px-2.5 text-xs font-semibold text-[#F5EFE6]"
                      >
                        {ARENAS.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] text-[#C7BEB2] block mb-1">Round Time</label>
                      <div className="flex gap-1">
                        {([60, 300] as RoundDurationSec[]).map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => handleHostConfig({ roundDurationSec: sec })}
                            className={`flex-1 min-h-[40px] rounded-lg text-xs font-mono font-bold cursor-pointer ${
                              (room.roundDurationSec ?? 60) === sec
                                ? 'bg-[#D99B26] text-[#161412]'
                                : 'bg-[#161412] text-[#C7BEB2]'
                            }`}
                          >
                            {sec === 300 ? '5m' : '1m'}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Player Roster */}
              <div className="rounded-2xl bg-[#221E1B] border border-white/10 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-[#C7BEB2]">
                  <span className="font-semibold text-[#F5EFE6] flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#D99B26]" />
                    Players ({room.players.length}/{room.maxPlayers})
                  </span>
                  <span className="font-mono">
                    {room.battleFormat.toUpperCase()} · {ARENAS.find((a) => a.id === room.arenaId)?.name} · {(room.roundDurationSec ?? 60) === 300 ? '5m' : '1m'}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  {room.players.map((p) => {
                    const wep = ROOM_WEAPONS.find((w) => w.id === p.roomWeapon);
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl bg-[#161412] border border-white/5 px-3.5 py-2.5 flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="font-mono text-xs font-bold text-[#D99B26]">
                            Lv.{p.level}
                          </span>
                          <span className="text-sm font-bold text-[#F5EFE6] truncate">
                            {p.nickname}
                          </span>
                          {p.isHost && (
                            <span className="text-[11px] font-mono text-[#E85D2A]">HOST</span>
                          )}
                          {room.battleFormat === 'teams' && (
                            <span className="text-[11px] font-mono text-[#38BDF8]">
                              T{p.teamId}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs">
                          <span className="text-[#C7BEB2] hidden sm:inline">
                            {wep?.name ?? 'Thunder Lance'}
                          </span>
                          <span
                            className={`font-semibold ${
                              p.ready || p.isHost ? 'text-[#10B981]' : 'text-[#8C8377]'
                            }`}
                          >
                            {p.isHost ? 'Host' : p.ready ? 'Ready' : 'Waiting'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right: Exclusive Room Weapons Pool & Ready / Start */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="rounded-2xl bg-[#221E1B] border border-[#38BDF8]/30 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-base font-bold text-[#F5EFE6] flex items-center gap-2">
                    <Zap className="w-4 h-4 text-[#38BDF8]" />
                    Exclusive Room Weapons
                  </h3>
                  <span className="text-[11px] font-mono text-[#10B981]">FAIR SHARED POOL</span>
                </div>

                <div className="flex flex-col gap-2">
                  {ROOM_WEAPONS.map((w) => {
                    const active = (me?.roomWeapon ?? selectedWeapon) === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleReadyToggle(w.id, me?.ready ?? false, me?.teamId ?? 1)}
                        className={`rounded-xl p-3 text-left border transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#2C2621] border-[#38BDF8]'
                            : 'bg-[#161412] border-white/5 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-[#F5EFE6]">{w.name}</span>
                          <span className="text-[11px] font-mono text-[#D99B26]">
                            {w.cooldownSec}s CD
                          </span>
                        </div>
                        <p className="text-xs text-[#C7BEB2] mt-0.5">{w.shortDesc}</p>
                      </button>
                    );
                  })}
                </div>

                {room.battleFormat === 'teams' && (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-[#C7BEB2]">Your Team:</span>
                    {([1, 2] as const).map((tid) => (
                      <button
                        key={tid}
                        type="button"
                        onClick={() =>
                          handleReadyToggle(me?.roomWeapon ?? selectedWeapon, me?.ready ?? false, tid)
                        }
                        className={`min-h-[38px] px-3 rounded-lg text-xs font-bold cursor-pointer ${
                          (me?.teamId ?? 1) === tid
                            ? 'bg-[#38BDF8] text-[#161412]'
                            : 'bg-[#161412] text-[#C7BEB2]'
                        }`}
                      >
                        Team {tid}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {isHost ? (
                <button
                  type="button"
                  disabled={!allReady}
                  onClick={isHotspot ? onStartHotspotRoom : onStartOnlineRoom}
                  className="min-h-[52px] w-full rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] disabled:bg-[#2C2621] disabled:text-[#8C8377] font-display text-base font-extrabold text-white flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Play className="w-5 h-5" />
                  <span>
                    {room.players.length < 2
                      ? 'Waiting for 1+ Friend...'
                      : !allReady
                      ? 'Waiting for Players Ready...'
                      : 'Launch Room Clash'}
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleReadyToggle(
                      me?.roomWeapon ?? selectedWeapon,
                      !(me?.ready ?? false),
                      me?.teamId ?? 2
                    )
                  }
                  className={`min-h-[52px] w-full rounded-xl font-display text-base font-extrabold flex items-center justify-center gap-2 cursor-pointer ${
                    me?.ready
                      ? 'bg-[#10B981] text-[#161412]'
                      : 'bg-[#E85D2A] text-white'
                  }`}
                >
                  <Shield className="w-5 h-5" />
                  <span>{me?.ready ? 'Ready! (Tap to Cancel)' : 'Tap to Ready Up'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {scannerMode === 'host_scan_answer' && hotspotSlot && (
          <QrScannerModal
            title="Enter Friend's Answer Code"
            onClose={() => setScannerMode(null)}
            onScan={async (code) => {
              setScannerMode(null);
              try {
                await onHotspotAcceptAnswer(hotspotSlot.slotId, code);
                setHotspotSlot(null);
                setHotspotStatus('Friend connected via WebRTC!');
              } catch (err) {
                setHotspotStatus(err instanceof Error ? err.message : 'Invalid Answer code');
              }
            }}
          />
        )}
      </div>
    );
  }

  // Room Hub: Choose Online Room OR Hotspot Offline Room
  return (
    <div className="w-full h-full overflow-y-auto forge-scroll bg-[#161412] p-4 sm:p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="min-h-[44px] px-3.5 rounded-xl bg-[#221E1B] hover:bg-[#2E2925] border border-white/10 text-sm font-semibold text-[#F5EFE6] flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="text-right">
            <div className="text-xs font-mono text-[#38BDF8]">2–5 FRIENDS · EXCLUSIVE WEAPONS</div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F5EFE6]">
              Private Room Arena
            </h1>
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-red-950/60 border border-red-500/40 px-4 py-3 text-xs text-red-200">
            {errorMsg}
          </div>
        )}

        {/* Shared Room Settings for Creation */}
        <div className="rounded-2xl bg-[#221E1B] border border-[#D99B26]/25 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="text-xs text-[#C7BEB2] block mb-1.5">Room Capacity (2–5)</label>
            <div className="flex gap-1.5">
              {[2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setCreateMaxPlayers(n)}
                  className={`flex-1 min-h-[42px] rounded-xl font-mono text-sm font-bold cursor-pointer ${
                    createMaxPlayers === n
                      ? 'bg-[#E85D2A] text-white'
                      : 'bg-[#161412] text-[#C7BEB2]'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-[#C7BEB2] block mb-1.5">Game Type</label>
            <select
              value={createFormat}
              onChange={(e) => setCreateFormat(e.target.value as BattleFormat)}
              className="w-full min-h-[42px] rounded-xl bg-[#161412] border border-white/10 px-3 text-sm font-semibold text-[#F5EFE6]"
            >
              <option value="ffa">Free-For-All (3–5 Players)</option>
              <option value="1v1">1v1 Duel</option>
              <option value="teams">Team Battle</option>
            </select>
          </div>

          <div>
            <label className="text-xs text-[#C7BEB2] block mb-1.5">Arena Stage</label>
            <select
              value={createArena}
              onChange={(e) => setCreateArena(e.target.value)}
              className="w-full min-h-[42px] rounded-xl bg-[#161412] border border-white/10 px-3 text-sm font-semibold text-[#F5EFE6]"
            >
              {ARENAS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-[#C7BEB2] block mb-1.5">Round Time</label>
            <div className="flex gap-1.5">
              {(
                [
                  { sec: 60, label: '1 Min' },
                  { sec: 300, label: '5 Min' },
                ] as { sec: RoundDurationSec; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.sec}
                  type="button"
                  onClick={() => setCreateRoundSec(opt.sec)}
                  className={`flex-1 min-h-[42px] rounded-xl font-mono text-sm font-bold cursor-pointer ${
                    createRoundSec === opt.sec
                      ? 'bg-[#D99B26] text-[#161412]'
                      : 'bg-[#161412] text-[#C7BEB2]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Two Sub-Modes Side by Side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Sub-mode 1: Online Room */}
          <div className="rounded-2xl bg-[#221E1B] border border-[#38BDF8]/30 p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#38BDF8]">
                <Radio className="w-4 h-4" />
                <span>SUB-MODE 1 · INTERNET</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold text-[#F5EFE6] mt-1">
                Online Room
              </h2>
              <p className="text-xs text-[#C7BEB2] mt-1 leading-relaxed">
                Create a room for a short 5-character code and shareable invite link, or enter a friend&apos;s code below.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() =>
                  onCreateOnlineRoom(createMaxPlayers, createFormat, createArena, createRoundSec)
                }
                className="min-h-[48px] w-full rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] text-sm font-extrabold text-white cursor-pointer"
              >
                Create Online Room
              </button>

              <div className="flex gap-2 pt-2 border-t border-white/10">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="Room Code (e.g. K7M2P)"
                  maxLength={6}
                  className="flex-1 min-w-0 rounded-xl bg-[#161412] border border-white/15 px-3 py-2.5 text-sm font-mono uppercase tracking-widest text-[#F5EFE6] focus:outline-none focus:border-[#38BDF8]"
                />
                <button
                  type="button"
                  disabled={joinCode.trim().length < 4}
                  onClick={() => onJoinOnlineRoom(joinCode.trim())}
                  className="min-h-[46px] px-4 rounded-xl bg-[#38BDF8] disabled:opacity-40 text-sm font-extrabold text-[#161412] cursor-pointer whitespace-nowrap"
                >
                  Join Code
                </button>
              </div>
            </div>
          </div>

          {/* Sub-mode 2: Hotspot Room (Offline WebRTC) */}
          <div className="rounded-2xl bg-[#221E1B] border border-[#10B981]/35 p-5 flex flex-col justify-between gap-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#10B981]">
                <WifiOff className="w-4 h-4" />
                <span>SUB-MODE 2 · ZERO INTERNET</span>
              </div>
              <h2 className="font-display text-2xl font-extrabold text-[#F5EFE6] mt-1">
                Hotspot Room (Offline)
              </h2>
              <p className="text-xs text-[#C7BEB2] mt-1 leading-relaxed">
                Play on the same Wi-Fi or phone hotspot without internet using WebRTC peer links via QR codes or short copyable tokens.
              </p>
            </div>

            {guestAnswerCode ? (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-[#161412] p-4 border border-[#10B981]/40">
                <p className="text-xs font-bold text-[#10B981]">
                  Step 2 · Let the Host scan or paste your Answer!
                </p>
                <QrCodeDisplay value={guestAnswerCode} size={172} />
                <CopyCodeBox label="Your Answer Code" value={guestAnswerCode} />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() =>
                    onCreateHotspotRoom(createMaxPlayers, createFormat, createArena, createRoundSec)
                  }
                  className="min-h-[48px] w-full rounded-xl bg-[#10B981] hover:bg-[#22C55E] text-sm font-extrabold text-[#161412] cursor-pointer"
                >
                  Host Hotspot Room
                </button>
                <button
                  type="button"
                  onClick={() => setScannerMode('guest_scan_offer')}
                  className="min-h-[46px] w-full rounded-xl bg-[#2C2621] hover:bg-[#38312B] border border-[#10B981]/40 text-sm font-bold text-[#F5EFE6] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-[#10B981]" />
                  <span>Join Friend via QR / Offer Code</span>
                </button>
                {hotspotStatus && <p className="text-xs text-[#D99B26]">{hotspotStatus}</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {scannerMode === 'guest_scan_offer' && (
        <QrScannerModal
          title="Enter Host's Offer Code"
          onClose={() => setScannerMode(null)}
          onScan={async (code) => {
            setScannerMode(null);
            setHotspotStatus('Building WebRTC Answer...');
            try {
              const answer = await onHotspotJoinOffer(code);
              setGuestAnswerCode(answer);
              setHotspotStatus(null);
            } catch (err) {
              setHotspotStatus(err instanceof Error ? err.message : 'Invalid Offer code');
            }
          }}
        />
      )}
    </div>
  );
};
