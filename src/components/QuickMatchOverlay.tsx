import React, { useEffect, useState } from 'react';
import { Bot, Loader2, RefreshCw, Swords, X } from 'lucide-react';
import {
  getDebugStatus,
  subscribeDebugStatus,
  type DebugStatusState,
} from '../utils/debugLog.ts';

interface QuickMatchOverlayProps {
  mmr: number;
  firebaseReady: boolean;
  matchedInfo: { isBot: boolean; opponentName: string } | null;
  onPlayBotNow: () => void;
  onRetryConnecting: () => void;
  onCancel: () => void;
}

const SEARCH_TIMEOUT_SEC = 20;
const CONNECT_TIMEOUT_SEC = 15;

export const QuickMatchOverlay: React.FC<QuickMatchOverlayProps> = ({
  mmr,
  firebaseReady,
  matchedInfo,
  onPlayBotNow,
  onRetryConnecting,
  onCancel,
}) => {
  const [elapsedSec, setElapsedSec] = useState(0);
  const [connectElapsedSec, setConnectElapsedSec] = useState(0);
  const [status, setStatus] = useState<DebugStatusState>(() => getDebugStatus());

  useEffect(() => {
    setStatus(getDebugStatus());
    return subscribeDebugStatus(() => {
      setStatus(getDebugStatus());
    });
  }, []);

  useEffect(() => {
    if (matchedInfo) return;
    const start = Date.now();
    setElapsedSec(0);
    const timer = window.setInterval(() => {
      setElapsedSec(Math.min(SEARCH_TIMEOUT_SEC, Math.floor((Date.now() - start) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [matchedInfo]);

  useEffect(() => {
    if (!matchedInfo || matchedInfo.isBot) {
      setConnectElapsedSec(0);
      return;
    }
    const start = Date.now();
    setConnectElapsedSec(0);
    const timer = window.setInterval(() => {
      setConnectElapsedSec(Math.floor((Date.now() - start) / 1000));
    }, 250);
    return () => window.clearInterval(timer);
  }, [matchedInfo]);

  const remainingSec = Math.max(0, SEARCH_TIMEOUT_SEC - elapsedSec);
  const connectTimedOut = Boolean(matchedInfo && !matchedInfo.isBot && connectElapsedSec >= CONNECT_TIMEOUT_SEC);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#161412]/92 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 p-6 text-center flex flex-col items-center gap-4">
        {matchedInfo ? (
          matchedInfo.isBot ? (
            <>
              <div className="w-14 h-14 rounded-2xl bg-[#10B981]/15 border border-[#10B981]/40 flex items-center justify-center text-[#10B981]">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <p className="text-xs font-mono text-[#10B981]">OPPONENT FOUND</p>
                <h2 className="font-display text-2xl font-extrabold text-[#F5EFE6] mt-1">
                  {matchedInfo.opponentName}
                </h2>
                <p className="text-xs text-[#D99B26] mt-1 font-semibold">
                  AI Bot Opponent
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-2xl bg-[#38BDF8]/15 border border-[#38BDF8]/40 flex items-center justify-center text-[#38BDF8]">
                {connectTimedOut ? (
                  <Swords className="w-7 h-7 text-[#E85D2A]" />
                ) : (
                  <Loader2 className="w-7 h-7 animate-spin" />
                )}
              </div>
              <div>
                <p className="text-xs font-mono text-[#10B981]">MATCH FOUND</p>
                <h2 className="font-display text-2xl font-extrabold text-[#F5EFE6] mt-1">
                  {connectTimedOut ? 'Connection Timed Out' : 'Connecting...'}
                </h2>
                <p className="text-xs text-[#C7BEB2] mt-1">
                  {connectTimedOut
                    ? `Peer link to ${matchedInfo.opponentName} did not open within 15s.`
                    : `Linking peer-to-peer arena with ${matchedInfo.opponentName}`}
                </p>
              </div>

              <div className="w-full bg-[#161412] rounded-xl p-3 border border-white/10 text-xs font-mono tabular-nums flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[#8C8377]">RTC</span>
                  <span className="text-[#F5EFE6]">{status.connectionState}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8C8377]">ICE</span>
                  <span className="text-[#F5EFE6]">{status.iceConnectionState}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[#8C8377]">DC</span>
                  <span className="text-[#38BDF8]">{status.dataChannelState}</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-1.5 mt-0.5">
                  <span className="text-[#8C8377]">Timer</span>
                  <span className="text-[#D99B26] font-bold">
                    {Math.min(CONNECT_TIMEOUT_SEC, connectElapsedSec)}s / {CONNECT_TIMEOUT_SEC}s
                  </span>
                </div>
              </div>

              <div className="w-full flex flex-col gap-2">
                {connectTimedOut && (
                  <button
                    type="button"
                    onClick={onRetryConnecting}
                    className="min-h-[44px] w-full rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] text-sm font-bold text-white flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Retry</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onCancel}
                  className="min-h-[44px] w-full rounded-xl bg-[#2C2621] hover:bg-[#38312B] text-sm font-semibold text-[#F5EFE6] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
              </div>
            </>
          )
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-[#E85D2A]/15 border border-[#E85D2A]/40 flex items-center justify-center text-[#E85D2A]">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <div>
              <h2 className="font-display text-2xl font-extrabold text-[#F5EFE6]">
                Searching for players... {remainingSec}s
              </h2>
              <p className="text-xs text-[#C7BEB2] mt-1">
                {firebaseReady ? (
                  <>
                    Matching via Firebase RTDB near Skill Rating{' '}
                    <span className="font-mono text-[#D99B26]">{mmr}</span> · Bot duel in {remainingSec}s
                  </>
                ) : (
                  <>Firebase config pending · Bot duel in {remainingSec}s</>
                )}
              </p>
            </div>

            <div className="w-full bg-[#161412] rounded-xl p-3 border border-white/5 flex items-center justify-between text-xs font-mono tabular-nums">
              <span className="text-[#C7BEB2]">Auto Bot Fallback</span>
              <span className="text-[#F5EFE6] font-bold">{remainingSec}s / {SEARCH_TIMEOUT_SEC}s</span>
            </div>

            <div className="w-full flex flex-col gap-2">
              <button
                type="button"
                onClick={onPlayBotNow}
                className="min-h-[44px] w-full rounded-xl bg-[#D99B26] hover:bg-[#E5AA38] text-sm font-extrabold text-[#161412] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Play vs Bot now</span>
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[44px] w-full rounded-xl bg-[#2C2621] hover:bg-[#38312B] text-sm font-semibold text-[#F5EFE6] flex items-center justify-center gap-2 cursor-pointer"
              >
                <X className="w-4 h-4" />
                <span>Cancel Search</span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
