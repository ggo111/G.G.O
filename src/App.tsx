import { useCallback, useEffect, useRef, useState } from 'react';
import { ControlsSettingsModal } from './components/ControlsSettingsModal.tsx';
import { DebugPanelModal } from './components/DebugPanelModal.tsx';
import { ExchangeModal } from './components/ExchangeModal.tsx';
import { GameViewport } from './components/GameViewport.tsx';
import { LeaderboardModal } from './components/LeaderboardModal.tsx';
import { LoadoutModal } from './components/LoadoutModal.tsx';
import { MatchSummaryModal } from './components/MatchSummaryModal.tsx';
import { MissionsModal } from './components/MissionsModal.tsx';
import { PrivateRoomLobby } from './components/PrivateRoomLobby.tsx';
import { ProfileModal } from './components/ProfileModal.tsx';
import { PromoCodeModal } from './components/PromoCodeModal.tsx';
import { QuickMatchOverlay } from './components/QuickMatchOverlay.tsx';
import { ShopModal } from './components/ShopModal.tsx';
import { SoloCampaignModal } from './components/SoloCampaignModal.tsx';
import { TitleScreen } from './components/TitleScreen.tsx';
import { NameEntryScreen } from './components/NameEntryScreen.tsx';
import { isSupabaseConfigured } from './config/supabaseConfig.ts';
import { ARENAS, RIDER_CATALOG } from './data/gameCatalog.ts';
import { getThemeById } from './data/themes.ts';
import { InputManager } from './engine/inputManager.ts';
import { GGOArenaSimulation } from './engine/physicsArena.ts';
import { claimNameAndCreateProfile, restoreSession, syncProfileToServer } from './lib/authService.ts';
import { isOnlineBackendReady } from './lib/supabase.ts';
import { hotspotManager } from './net/hotspotRtc.ts';
import { onlineRtc } from './net/onlineRtc.ts';
import {
  mirrorUserInventoryToFirebase,
  mirrorUserProfileToFirebase,
  syncLeaderboardMetadata,
  writeOwnLeaderboardRecord,
} from './net/userFirebaseSync.ts';
import type {
  AIDifficulty,
  CampaignLevelDef,
  ControlSettings,
  DrawnBlueprint,
  GameScreen,
  MatchMode,
  MatchRewardSummary,
  MatchSnapshot,
  PlayerProfile,
  RoomState,
  VisualEffectEvent,
} from './types/game.ts';
import { forgeAudio } from './utils/audio.ts';
import { log, subscribeDebugPanelOpen } from './utils/debugLog.ts';
import {
  applyMatchProgression,
  applyPromoCode,
  buyShopItem,
  canClaimDailyReward,
  claimDailyReward,
  equipShopItem,
  exchangeGemsToCoins,
  loadProfile,
  saveProfile,
} from './utils/profileStore.ts';

export default function App() {
  const [profile, setProfile] = useState<PlayerProfile>(() => loadProfile());
  const [bootStatus, setBootStatus] = useState<'loading' | 'needs_name' | 'ready'>('loading');
  const [screen, setScreen] = useState<GameScreen>('TITLE');
  const [backendReady, setBackendReady] = useState<boolean>(() => isSupabaseConfigured());

  const [showArmory, setShowArmory] = useState(false);
  const [showLoadout, setShowLoadout] = useState(false);
  const [showExchange, setShowExchange] = useState(false);
  const [showPromo, setShowPromo] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showMissions, setShowMissions] = useState(false);
  const [showTitleSettings, setShowTitleSettings] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Boot: restore Supabase session or ask for name
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await restoreSession();
        if (cancelled) return;
        if (result.needsName || !result.profile) {
          setBootStatus('needs_name');
          return;
        }
        forgeAudio.setMuted(result.profile.muted);
        setProfile(result.profile);
        setBackendReady(isOnlineBackendReady());
        setBootStatus('ready');
      } catch (err) {
        console.error('[boot]', err);
        // Offline fallback
        const local = loadProfile();
        forgeAudio.setMuted(local.muted);
        setProfile(local);
        setBootStatus('ready');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return subscribeDebugPanelOpen((open) => setShowDebugPanel(open));
  }, []);

  // Sync active theme CSS custom properties across the entire app
  useEffect(() => {
    const theme = getThemeById(profile.equipped.themeId);
    const rp = theme.renderParams;
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty('--ggo-bg-primary', rp.bgPrimary);
    rootStyle.setProperty('--ggo-bg-surface', rp.bgSurface);
    rootStyle.setProperty('--ggo-bg-surface-alt', rp.bgSurfaceAlt);
    rootStyle.setProperty('--ggo-accent-primary', rp.accentPrimary);
    rootStyle.setProperty('--ggo-accent-secondary', rp.accentSecondary);
    rootStyle.setProperty('--ggo-text-primary', rp.textPrimary);
    rootStyle.setProperty('--ggo-text-muted', rp.textMuted);
    rootStyle.setProperty('--ggo-border', rp.borderColor);
    rootStyle.setProperty('--ggo-font-body', rp.fontFamily);
  }, [profile.equipped.themeId]);

  // Match & Room states
  const [room, setRoom] = useState<RoomState | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [quickMatchedInfo, setQuickMatchedInfo] = useState<{
    isBot: boolean;
    opponentName: string;
  } | null>(null);

  const [activeMode, setActiveMode] = useState<MatchMode>('solo');
  const [snapshot, setSnapshot] = useState<MatchSnapshot | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchRewardSummary | null>(null);

  // Single unified InputManager ref shared with simulation & WebRTC loops
  const inputManagerRef = useRef<InputManager>(new InputManager());

  // Local Solo / Offline Fallback Simulation refs
  const localSimRef = useRef<GGOArenaSimulation | null>(null);
  const localSimTimerRef = useRef<number | null>(null);
  const soloPausedRef = useRef<boolean>(false);
  const soloContextRef = useRef<{
    level: CampaignLevelDef;
    difficulty: AIDifficulty;
  } | null>(null);

  const fxQueueRef = useRef<VisualEffectEvent[]>([]);
  const matchAwardedRef = useRef<string | null>(null);
  const matchStatsTrackerRef = useRef({
    spikyRounds: 0,
    weaponsUsed: 0,
    isBotMatch: false,
  });

  const profileRef = useRef(profile);
  profileRef.current = profile;

  const showToast = useCallback((text: string) => {
    setToastMsg(text);
    window.setTimeout(() => {
      setToastMsg((prev) => (prev === text ? null : prev));
    }, 3200);
  }, []);

  const stopLocalSim = useCallback(() => {
    if (localSimTimerRef.current) {
      window.clearInterval(localSimTimerRef.current);
      localSimTimerRef.current = null;
    }
    soloPausedRef.current = false;
    localSimRef.current = null;
  }, []);

  const finalizeMatchIfNeeded = useCallback((snap: MatchSnapshot) => {
    if (snap.phase !== 'MATCH_OVER') return;
    if (matchAwardedRef.current === snap.matchId) return;
    matchAwardedRef.current = snap.matchId;

    const currentProfile = profileRef.current;
    const me = snap.vehicles.find((v) => v.playerId === currentProfile.playerId);
    const won = snap.matchWinnerIds.includes(currentProfile.playerId);
    const maxOtherWins = Math.max(
      0,
      ...snap.vehicles
        .filter((v) => v.playerId !== currentProfile.playerId)
        .map((v) => v.roundWins)
    );

    if (won) forgeAudio.playRoundWin();
    else forgeAudio.playRoundLose();

    const soloCtx = snap.mode === 'solo' ? soloContextRef.current : null;
    const diffMult =
      soloCtx?.difficulty === 'hard'
        ? 1.8
        : soloCtx?.difficulty === 'normal'
        ? 1.4
        : 1.0;

    const bonusCoins = soloCtx && won ? Math.round(soloCtx.level.rewardCoins * diffMult) : 0;
    const bonusGems = soloCtx && won ? soloCtx.level.rewardGems : 0;
    const bonusXp = soloCtx && won ? Math.round(soloCtx.level.rewardXp * diffMult) : 0;

    const hasBotOpponent =
      matchStatsTrackerRef.current.isBotMatch ||
      snap.vehicles.some((v) => v.playerId !== currentProfile.playerId && v.isBot);
    const isRealHumanQuickMatch =
      snap.mode === 'quick_match' &&
      !hasBotOpponent &&
      snap.vehicles.filter((v) => !v.isBot).length >= 2;

    const { profile: updated, summary } = applyMatchProgression(currentProfile, {
      won,
      roundsWon: me?.roundWins ?? 0,
      roundsLost: maxOtherWins,
      mode: snap.mode,
      isRealHumanQuickMatch,
      spikyRounds: matchStatsTrackerRef.current.spikyRounds,
      weaponsUsed: matchStatsTrackerRef.current.weaponsUsed,
      campaignDifficulty: soloCtx?.difficulty,
      campaignLevel: soloCtx?.level.level,
      bonusCoins,
      bonusGems,
      bonusXp,
    });

    if (isRealHumanQuickMatch) {
      void writeOwnLeaderboardRecord(updated);
    }

    setProfile(updated);
    setMatchSummary({
      ...summary,
      koReason: snap.koSummary || (won ? 'Opponent Defeated!' : 'Out-Jousted!'),
      isBotMatch: hasBotOpponent,
    });
  }, []);

  // Provide unified InputManager reader to Online & Hotspot P2P loops
  useEffect(() => {
    const readInput = () => {
      const state = inputManagerRef.current.readTickInput(true);
      if (state.special) {
        matchStatsTrackerRef.current.weaponsUsed += 1;
      }
      return state;
    };
    onlineRtc.setInputReader(readInput);
    hotspotManager.setInputReader(readInput);
    return () => {
      onlineRtc.setInputReader(null);
      hotspotManager.setInputReader(null);
    };
  }, []);

  // Initialize Firebase Anonymous Auth + check ?room=CODE invite URL
  useEffect(() => {
    onlineRtc.onAuthUid = (uid) => {
      setFirebaseReady(true);
      setProfile((prev) => {
        if (prev.playerId === uid) return prev;
        const next = { ...prev, playerId: uid };
        saveProfile(next);
        return next;
      });
    };

    onlineRtc.onNicknameAssigned = (nickname) => {
      setProfile((prev) => {
        if (prev.nickname === nickname) return prev;
        const next = { ...prev, nickname };
        saveProfile(next);
        return next;
      });
    };

    onlineRtc.onError = (message) => {
      log('NET_ERROR', message);
      setRoomError(message);
      showToast(message);
    };

    onlineRtc.onRoomUpdate = (nextRoom) => {
      setRoomError(null);
      setRoom(nextRoom);
      if (nextRoom && nextRoom.status === 'lobby') {
        setScreen('PRIVATE_HUB');
      }
    };

    onlineRtc.onQuickMatched = (info) => {
      setQuickMatchedInfo({ isBot: info.isBot, opponentName: info.opponentName });
      matchStatsTrackerRef.current = {
        spikyRounds: 0,
        weaponsUsed: 0,
        isBotMatch: info.isBot,
      };
    };

    onlineRtc.onSnapshot = (snap) => {
      setActiveMode(snap.mode);
      setSnapshot(snap);
      setQuickMatchedInfo(null);
      setMatchSummary(null);
      setScreen('IN_MATCH');
      finalizeMatchIfNeeded(snap);
    };

    onlineRtc.onFx = (events) => {
      fxQueueRef.current.push(...events);
    };

    onlineRtc.onPeerReconnectNotice = (_pid, nickname, sec) => {
      showToast(`${nickname} connection unstable — holding slot for ${sec}s...`);
    };

    const params = new URLSearchParams(window.location.search);
    const inviteCode = params.get('room')?.trim().toUpperCase();

    onlineRtc.initAuth().then(async (uid) => {
      let activeProfile = profileRef.current;
      if (uid) {
        const res = await onlineRtc.ensureUniqueNickname({ ...profileRef.current, playerId: uid });
        activeProfile = {
          ...profileRef.current,
          playerId: uid,
          nickname: res.changed ? res.nickname : profileRef.current.nickname,
        };
        if (res.changed) {
          setProfile((prev) => {
            const next = { ...prev, nickname: res.nickname };
            saveProfile(next);
            return next;
          });
        } else {
          void mirrorUserProfileToFirebase(activeProfile);
        }
        void mirrorUserInventoryToFirebase(activeProfile);
      }
      if (uid && inviteCode && inviteCode.length >= 4) {
        setScreen('PRIVATE_HUB');
        onlineRtc.joinOnlineRoom(activeProfile, inviteCode);
      } else if (inviteCode && inviteCode.length >= 4) {
        setScreen('PRIVATE_HUB');
      }
    });
  }, [finalizeMatchIfNeeded, showToast]);

  // Wire Hotspot Offline WebRTC manager callbacks
  useEffect(() => {
    hotspotManager.onRoomUpdate = (nextRoom) => {
      setRoom({ ...nextRoom });
    };
    hotspotManager.onSnapshot = (snap) => {
      setActiveMode('hotspot_room');
      setSnapshot(snap);
      setMatchSummary(null);
      setScreen('IN_MATCH');
      finalizeMatchIfNeeded(snap);
    };
    hotspotManager.onFx = (events) => {
      fxQueueRef.current.push(...events);
    };
  }, [finalizeMatchIfNeeded]);

  // Launch a local Solo Campaign or Quick Match 8s Bot Fallback simulation
  const launchLocalMatch = useCallback(
    (opts: {
      mode: 'solo' | 'quick_match';
      arenaId: string;
      botName: string;
      botRiderId: string;
      botDifficulty: AIDifficulty;
      botArchetype?: CampaignLevelDef['archetype'];
    }) => {
      stopLocalSim();
      inputManagerRef.current.clearAll();
      matchAwardedRef.current = null;
      matchStatsTrackerRef.current = {
        spikyRounds: 0,
        weaponsUsed: 0,
        isBotMatch: true,
      };

      const curProfile = profileRef.current;
      const roundDurationSec =
        opts.mode === 'quick_match'
          ? 60
          : curProfile.controlSettings.roundDurationSec === 300
          ? 300
          : 60;
      const sim = new GGOArenaSimulation({
        matchId: `local_${Date.now()}`,
        mode: opts.mode,
        battleFormat: '1v1',
        arenaId: opts.arenaId,
        roundDurationSec,
        participants: [
          {
            playerId: curProfile.playerId,
            nickname: curProfile.nickname,
            isBot: false,
            teamId: 1,
            roomWeapon: null,
            cosmetics: curProfile.equipped,
            connected: true,
          },
          {
            playerId: 'local_bot',
            nickname: opts.botName,
            isBot: true,
            botDifficulty: opts.botDifficulty,
            botArchetype: opts.botArchetype,
            teamId: 2,
            roomWeapon: null,
            cosmetics: {
              riderId: opts.botRiderId,
              inkStyleId: 'ink_charcoal',
              lanceSkinId: 'lance_steel',
              wheelFinishId: 'wheel_iron',
            },
            connected: true,
          },
        ],
      });

      localSimRef.current = sim;
      setActiveMode(opts.mode);
      setMatchSummary(null);
      setSnapshot(sim.getSnapshot());
      setScreen('IN_MATCH');

      let lastTick = performance.now();
      let lastUiSync = 0;
      localSimTimerRef.current = window.setInterval(() => {
        if (!localSimRef.current) return;
        const now = performance.now();
        const dt = now - lastTick;
        lastTick = now;

        if (soloPausedRef.current) {
          return;
        }

        // Read unified InputManager state every fixed physics step!
        if (localSimRef.current.phase === 'FIGHTING') {
          const tickInput = inputManagerRef.current.readTickInput(true);
          localSimRef.current.setPlayerInput(profileRef.current.playerId, tickInput);
        }

        localSimRef.current.step(dt);
        const fx = localSimRef.current.drainFx();
        if (fx.length > 0) fxQueueRef.current.push(...fx);

        if (now - lastUiSync >= 33 || localSimRef.current.phase === 'MATCH_OVER') {
          lastUiSync = now;
          const snap = localSimRef.current.getSnapshot();
          setSnapshot(snap);
          if (snap.phase === 'MATCH_OVER') {
            stopLocalSim();
            finalizeMatchIfNeeded(snap);
          }
        }
      }, 1000 / 60);
    },
    [finalizeMatchIfNeeded, stopLocalSim]
  );

  const handleStartSoloLevel = (level: CampaignLevelDef, difficulty: AIDifficulty) => {
    forgeAudio.playUiClick();
    soloContextRef.current = { level, difficulty };
    launchLocalMatch({
      mode: 'solo',
      arenaId: level.arenaId,
      botName: `${level.rivalName} (Bot)`,
      botRiderId: level.rivalRiderId,
      botDifficulty: difficulty,
      botArchetype: level.archetype,
    });
  };

  const handleLocalBotFallback = useCallback(() => {
    const botRider = RIDER_CATALOG[Math.floor(Math.random() * RIDER_CATALOG.length)];
    const arena = ARENAS[Math.floor(Math.random() * 4)];
    setQuickMatchedInfo({ isBot: true, opponentName: `${botRider.name} (Bot)` });
    window.setTimeout(() => {
      setQuickMatchedInfo(null);
      soloContextRef.current = null;
      launchLocalMatch({
        mode: 'quick_match',
        arenaId: arena.id,
        botName: `${botRider.name} (Bot)`,
        botRiderId: botRider.id,
        botDifficulty: profileRef.current.controlSettings.botDifficulty ?? 'easy',
      });
    }, 900);
  }, [launchLocalMatch]);

  const handleOpenQuickMatch = () => {
    forgeAudio.playUiClick();
    matchAwardedRef.current = null;
    setQuickMatchedInfo(null);
    setScreen('QUICK_SEARCH');
    onlineRtc.joinQuickMatch(profileRef.current, handleLocalBotFallback);
  };

  const handlePlayBotNow = async () => {
    forgeAudio.playUiClick();
    log('QUEUE', 'Player clicked Play vs Bot now');
    await onlineRtc.cancelQuickMatch();
    handleLocalBotFallback();
  };

  const handleRetryQuickMatch = async () => {
    forgeAudio.playUiClick();
    log('RTC', 'Retrying Quick Match connection');
    await onlineRtc.leaveAll();
    matchAwardedRef.current = null;
    setQuickMatchedInfo(null);
    setScreen('QUICK_SEARCH');
    onlineRtc.joinQuickMatch(profileRef.current, handleLocalBotFallback);
  };

  const handleSubmitDrawing = (blueprint: DrawnBlueprint) => {
    if (blueprint.stats.spikePower >= 5) {
      matchStatsTrackerRef.current.spikyRounds += 1;
    }
    if (activeMode === 'solo' || localSimRef.current) {
      localSimRef.current?.submitBlueprint(profile.playerId, blueprint);
    } else if (activeMode === 'hotspot_room') {
      hotspotManager.submitBlueprint(profile.playerId, blueprint);
    } else {
      onlineRtc.submitBlueprint(blueprint);
    }
  };

  const handleExitMatch = () => {
    stopLocalSim();
    inputManagerRef.current.clearAll();
    setSnapshot(null);
    setMatchSummary(null);
    if (activeMode === 'online_room') {
      setScreen('PRIVATE_HUB');
    } else if (activeMode === 'hotspot_room') {
      setScreen('PRIVATE_HUB');
    } else {
      onlineRtc.leaveAll();
      setScreen('TITLE');
    }
  };

  const handlePlayAgain = () => {
    forgeAudio.playUiClick();
    setMatchSummary(null);
    matchAwardedRef.current = null;

    if (activeMode === 'solo' && soloContextRef.current) {
      handleStartSoloLevel(soloContextRef.current.level, soloContextRef.current.difficulty);
    } else if (activeMode === 'quick_match') {
      onlineRtc.leaveAll();
      setSnapshot(null);
      handleOpenQuickMatch();
    } else if (activeMode === 'online_room') {
      onlineRtc.triggerRematch();
      setSnapshot(null);
      setScreen('PRIVATE_HUB');
    } else if (activeMode === 'hotspot_room') {
      hotspotManager.triggerRematch();
      setSnapshot(null);
      setScreen('PRIVATE_HUB');
    }
  };

  const handleClaimDaily = () => {
    const res = claimDailyReward(profile);
    if (res.coins > 0 || res.gems > 0) {
      forgeAudio.playRoundWin();
      setProfile(res.profile);
      showToast(`Day ${res.day} Forge Gift claimed: +${res.coins} Coins & +${res.gems} Gems!`);
    }
  };

  const handleClaimMission = (missionId: string) => {
    const target = profile.missions.find((m) => m.id === missionId);
    if (!target || target.claimed || target.progress < target.target) return;
    forgeAudio.playRoundWin();
    const updated: PlayerProfile = {
      ...profile,
      coins: profile.coins + target.rewardCoins,
      gems: profile.gems + target.rewardGems,
      xp: profile.xp + target.rewardXp,
      missions: profile.missions.map((m) => (m.id === missionId ? { ...m, claimed: true } : m)),
    };
    saveProfile(updated);
    setProfile(updated);
    showToast(`Mission claimed: +${target.rewardCoins}c & +${target.rewardGems}g!`);
  };

  const handleUpdateControlSettings = (next: ControlSettings) => {
    const updated = { ...profile, controlSettings: next };
    saveProfile(updated);
    setProfile(updated);
  };

  const handleDismissHowToPlay = () => {
    forgeAudio.playUiClick();
    const updated = { ...profile, hasSeenHowToPlay: true };
    saveProfile(updated);
    setProfile(updated);
  };

  const toggleMute = () => {
    const nextMuted = !profile.muted;
    forgeAudio.setMuted(nextMuted);
    const updated = { ...profile, muted: nextMuted };
    saveProfile(updated);
    setProfile(updated);
  };


  const handleNameSubmit = async (name: string) => {
    const result = await claimNameAndCreateProfile(name);
    if (!result.ok) {
      return { ok: false as const, error: result.error };
    }
    forgeAudio.setMuted(result.profile.muted);
    setProfile(result.profile);
    setBackendReady(isOnlineBackendReady());
    setBootStatus('ready');
    showToast(result.isNew ? `مرحباً ${result.profile.nickname}!` : `أهلاً بعودتك ${result.profile.nickname}`);
    return { ok: true as const };
  };

  // Boot screens (after all hooks)
  if (bootStatus === 'loading') {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#161412]">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D99B26] border-t-transparent" />
      </div>
    );
  }
  if (bootStatus === 'needs_name') {
    return <NameEntryScreen onSubmit={handleNameSubmit} />;
  }

  const dailyAvailable = canClaimDailyReward(profile);

  const unclaimedMissionsCount = profile.missions.filter(
    (m) => !m.claimed && m.progress >= m.target
  ).length;

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        backgroundColor: 'var(--ggo-bg-primary)',
        color: 'var(--ggo-text-primary)',
        fontFamily: 'var(--ggo-font-body)',
      }}
    >
      {screen === 'TITLE' && (
        <TitleScreen
          profile={profile}
          backendReady={backendReady}
          dailyAvailable={dailyAvailable}
          unclaimedMissionsCount={unclaimedMissionsCount}
          onUpdateNickname={async (nick) => {
            const res = await onlineRtc.reserveNickname(nick, profileRef.current.nickname);
            if (!res.ok) {
              return res;
            }
            log('NAME', 'Player updated nickname', { nickname: nick });
            const updated = { ...profileRef.current, nickname: nick };
            saveProfile(updated);
            setProfile(updated);
            void syncLeaderboardMetadata(updated);
            return { ok: true };
          }}
          onClaimDaily={handleClaimDaily}
          onToggleMute={toggleMute}
          onOpenQuickMatch={handleOpenQuickMatch}
          onOpenSolo={() => {
            forgeAudio.playUiClick();
            setScreen('SOLO_SETUP');
          }}
          onOpenPrivateRoom={() => {
            forgeAudio.playUiClick();
            setRoomError(null);
            setScreen('PRIVATE_HUB');
          }}
          onOpenArmory={() => {
            forgeAudio.playUiClick();
            setShowArmory(true);
          }}
          onOpenLoadout={() => {
            forgeAudio.playUiClick();
            setShowLoadout(true);
          }}
          onOpenExchange={() => {
            forgeAudio.playUiClick();
            setShowExchange(true);
          }}
          onOpenPromoCode={() => {
            forgeAudio.playUiClick();
            setShowPromo(true);
          }}
          onOpenProfile={() => {
            forgeAudio.playUiClick();
            setShowProfile(true);
          }}
          onOpenLeaderboard={() => {
            forgeAudio.playUiClick();
            setShowLeaderboard(true);
          }}
          onOpenMissions={() => {
            forgeAudio.playUiClick();
            setShowMissions(true);
          }}
          onOpenSettings={() => {
            forgeAudio.playUiClick();
            setShowTitleSettings(true);
          }}
        />
      )}

      {screen === 'SOLO_SETUP' && (
        <SoloCampaignModal
          profile={profile}
          onSelectDifficulty={(diff) =>
            handleUpdateControlSettings({ ...profile.controlSettings, botDifficulty: diff })
          }
          onSelectRoundDuration={(roundDurationSec) =>
            handleUpdateControlSettings({ ...profile.controlSettings, roundDurationSec })
          }
          onStartLevel={handleStartSoloLevel}
          onBack={() => setScreen('TITLE')}
        />
      )}

      {screen === 'QUICK_SEARCH' && (
        <QuickMatchOverlay
          mmr={profile.mmr}
          backendReady={backendReady}
          matchedInfo={quickMatchedInfo}
          onPlayBotNow={() => {
            void handlePlayBotNow();
          }}
          onRetryConnecting={() => {
            void handleRetryQuickMatch();
          }}
          onCancel={() => {
            void onlineRtc.leaveAll();
            setQuickMatchedInfo(null);
            setScreen('TITLE');
          }}
        />
      )}

      {screen === 'PRIVATE_HUB' && (
        <PrivateRoomLobby
          profile={profile}
          room={room}
          errorMsg={roomError}
          onCreateOnlineRoom={(maxPlayers, battleFormat, arenaId, roundDurationSec) => {
            setRoomError(null);
            onlineRtc.createOnlineRoom(profile, maxPlayers, battleFormat, arenaId, roundDurationSec);
          }}
          onJoinOnlineRoom={(code) => {
            setRoomError(null);
            onlineRtc.joinOnlineRoom(profile, code);
          }}
          onConfigOnlineRoom={(patch) => onlineRtc.updateRoomConfig(patch)}
          onOnlineReady={(ready, roomWeapon, teamId) =>
            onlineRtc.updateLocalReady(ready, roomWeapon, teamId)
          }
          onStartOnlineRoom={() => onlineRtc.startOnlineRoomMatch()}
          onLeaveRoom={() => {
            if (room?.subMode === 'hotspot_room') {
              hotspotManager.cleanup();
            } else {
              onlineRtc.leaveAll();
            }
            setRoom(null);
          }}
          onCreateHotspotRoom={(maxPlayers, battleFormat, arenaId, roundDurationSec) => {
            setRoomError(null);
            hotspotManager.createHostRoom(profile, maxPlayers, battleFormat, arenaId, roundDurationSec);
          }}
          onHotspotGenerateOffer={() => hotspotManager.createOfferForNextPeer()}
          onHotspotAcceptAnswer={(slotId, answerCode) =>
            hotspotManager.acceptAnswerForPeer(slotId, answerCode)
          }
          onHotspotJoinOffer={(offerCode) => hotspotManager.joinWithHostOffer(profile, offerCode)}
          onHotspotConfig={(patch) => hotspotManager.updateHostConfig(patch)}
          onHotspotReady={(ready, weapon, teamId) =>
            hotspotManager.setLocalReady(ready, weapon, teamId)
          }
          onStartHotspotRoom={() => hotspotManager.startHostMatch()}
          onBack={() => setScreen('TITLE')}
        />
      )}

      {screen === 'IN_MATCH' && snapshot && (
        <GameViewport
          localPlayerId={profile.playerId}
          snapshot={snapshot}
          inputManager={inputManagerRef.current}
          fxQueueRef={fxQueueRef}
          muted={profile.muted}
          hasSeenHowToPlay={profile.hasSeenHowToPlay}
          controlSettings={profile.controlSettings}
          onUpdateControlSettings={handleUpdateControlSettings}
          onDismissHowToPlay={handleDismissHowToPlay}
          onToggleMute={toggleMute}
          onSubmitDrawing={handleSubmitDrawing}
          onExitMatch={handleExitMatch}
          onSoloPauseChange={(p) => {
            soloPausedRef.current = p;
          }}
        />
      )}

      {screen === 'IN_MATCH' && matchSummary && (
        <MatchSummaryModal
          mode={activeMode}
          summary={matchSummary}
          onPlayAgain={handlePlayAgain}
          onBackHome={() => {
            stopLocalSim();
            onlineRtc.leaveAll();
            setSnapshot(null);
            setMatchSummary(null);
            setScreen('TITLE');
          }}
        />
      )}

      {showArmory && (
        <ShopModal
          profile={profile}
          onBuyAndEquip={(item) => {
            const res = buyShopItem(profileRef.current, item);
            if (res.ok) {
              forgeAudio.playForgeClang();
              setProfile(res.profile);
              showToast(`Unlocked & equipped ${item.name}!`);
            }
            return { ok: res.ok, error: res.error };
          }}
          onEquipItem={(category, itemId) => {
            forgeAudio.playUiClick();
            const updated = equipShopItem(profileRef.current, category, itemId);
            setProfile(updated);
          }}
          onOpenExchange={() => {
            setShowArmory(false);
            setShowExchange(true);
          }}
          onClose={() => setShowArmory(false)}
        />
      )}

      {showLoadout && (
        <LoadoutModal
          profile={profile}
          onSelectWeapon={(weaponId) => {
            forgeAudio.playUiClick();
            const updated = equipShopItem(profileRef.current, 'weapons', weaponId);
            setProfile(updated);
          }}
          onOpenShop={() => {
            setShowLoadout(false);
            setShowArmory(true);
          }}
          onClose={() => setShowLoadout(false)}
        />
      )}

      {showExchange && (
        <ExchangeModal
          profile={profile}
          onExchange={(gemsToSpend) => {
            const res = exchangeGemsToCoins(profileRef.current, gemsToSpend);
            if (res.ok) {
              forgeAudio.playForgeClang();
              setProfile(res.profile);
            }
            return { ok: res.ok, coinsAdded: res.coinsAdded, error: res.error };
          }}
          onClose={() => setShowExchange(false)}
        />
      )}

      {showPromo && (
        <PromoCodeModal
          profile={profile}
          onApplyCode={(input) => {
            const res = applyPromoCode(profileRef.current, input);
            if (res.ok) {
              forgeAudio.playRoundWin();
              setProfile(res.profile);
              showToast(res.message);
            }
            return { ok: res.ok, name: res.name, message: res.message };
          }}
          onClose={() => setShowPromo(false)}
        />
      )}

      {showProfile && (
        <ProfileModal
          profile={profile}
          onSelectAvatar={(avatarId) => {
            forgeAudio.playUiClick();
            const updated = { ...profileRef.current, avatarId };
            saveProfile(updated);
            setProfile(updated);
            void syncLeaderboardMetadata(updated);
          }}
          onUpdateNickname={async (nick) => {
            const res = await onlineRtc.reserveNickname(nick, profileRef.current.nickname);
            if (!res.ok) return res;
            log('NAME', 'Player updated nickname', { nickname: nick });
            const updated = { ...profileRef.current, nickname: nick };
            saveProfile(updated);
            setProfile(updated);
            void syncLeaderboardMetadata(updated);
            return { ok: true };
          }}
          onOpenPromoCode={() => {
            setShowProfile(false);
            setShowPromo(true);
          }}
          onClose={() => setShowProfile(false)}
        />
      )}

      {showLeaderboard && (
        <LeaderboardModal
          profile={profile}
          backendReady={backendReady}
          onClose={() => setShowLeaderboard(false)}
        />
      )}

      {showMissions && (
        <MissionsModal
          profile={profile}
          dailyAvailable={dailyAvailable}
          onClaimDaily={handleClaimDaily}
          onClaimMission={handleClaimMission}
          onClose={() => setShowMissions(false)}
        />
      )}

      {showTitleSettings && (
        <ControlsSettingsModal
          settings={profile.controlSettings}
          onChange={handleUpdateControlSettings}
          onClose={() => setShowTitleSettings(false)}
        />
      )}

      {showDebugPanel && <DebugPanelModal onClose={() => setShowDebugPanel(false)} />}

      {toastMsg && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#221E1B] border border-[#D99B26]/50 text-xs sm:text-sm font-semibold text-[#F5EFE6] shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
