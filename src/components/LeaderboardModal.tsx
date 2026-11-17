import React, { useCallback, useEffect, useState } from 'react';
import { Award, Crown, RefreshCw, Shield, Trophy, X } from 'lucide-react';
import { fetchTopLeaderboard } from '../net/userFirebaseSync.ts';
import type { LeaderboardEntry, PlayerProfile } from '../types/game.ts';
import { AvatarBadge } from './AvatarBadge.tsx';

interface LeaderboardModalProps {
  profile: PlayerProfile;
  backendReady: boolean;
  onClose: () => void;
}

export const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  profile,
  backendReady,
  onClose,
}) => {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    if (!backendReady) {
      setEntries([]);
      setLoading(false);
      setErrorMsg('Online backend is not configured in this session. Play online Quick Matches when connected to view the live Top 100.');
      return;
    }
    try {
      const list = await fetchTopLeaderboard();
      setEntries(list);
    } catch {
      setErrorMsg('Could not load leaderboard right now. Tap Refresh to try again.');
    } finally {
      setLoading(false);
    }
  }, [backendReady]);

  useEffect(() => {
    void loadLeaderboard();
  }, [loadLeaderboard]);

  const myIndex = entries.findIndex((e) => e.uid === profile.playerId);
  const inTop100 = myIndex >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-5">
      <div className="w-full max-w-2xl max-h-[90vh] rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#F5B041]" />
              <h2 className="font-display text-xl font-extrabold text-[#F5EFE6]">
                Global Trophy Leaderboard (Top 100)
              </h2>
            </div>
            <p className="text-xs text-[#C7BEB2] mt-0.5">
              Real human Quick Matches only (+25 Win / -15 Loss). Bots, Solo, and Private Rooms do not affect rank.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadLeaderboard()}
              disabled={loading}
              className="min-h-[44px] px-3 rounded-xl bg-[#2C2621] hover:bg-[#38312B] text-xs font-bold text-[#F5EFE6] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-[#D99B26] ${loading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
              aria-label="Close leaderboard"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto forge-scroll p-4 sm:p-5 flex flex-col gap-2">
          {loading ? (
            <div className="py-12 text-center text-sm text-[#C7BEB2]">
              Loading Top 100 standings...
            </div>
          ) : errorMsg ? (
            <div className="rounded-xl bg-[#161412] border border-white/10 p-5 text-center text-xs text-[#C7BEB2]">
              {errorMsg}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-xl bg-[#161412] border border-white/10 p-6 text-center flex flex-col items-center gap-2">
              <Award className="w-8 h-8 text-[#D99B26]" />
              <div className="text-sm font-bold text-[#F5EFE6]">No Ranked Riders Yet</div>
              <p className="text-xs text-[#A39A8E] max-w-sm">
                Complete a real-player Online Quick Match to claim the #1 spot on the Forge Leaderboard!
              </p>
            </div>
          ) : (
            entries.map((entry, idx) => {
              const rank = idx + 1;
              const isMe = entry.uid === profile.playerId;
              const topStyle =
                rank === 1
                  ? 'border-[#F5B041]/70 bg-[#2E2416]'
                  : rank === 2
                  ? 'border-[#CBD5E1]/50 bg-[#25272B]'
                  : rank === 3
                  ? 'border-[#CD7F32]/60 bg-[#2A201A]'
                  : isMe
                  ? 'border-[#E85D2A] bg-[#2D1F19]'
                  : 'border-white/10 bg-[#161412]';

              return (
                <div
                  key={entry.uid}
                  className={`rounded-xl border px-3.5 py-2.5 flex items-center justify-between gap-3 ${topStyle}`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 text-center font-mono font-extrabold text-sm shrink-0">
                      {rank === 1 ? (
                        <Crown className="w-5 h-5 text-[#F5B041] mx-auto" />
                      ) : rank === 2 ? (
                        <span className="text-[#E2E8F0]">#2</span>
                      ) : rank === 3 ? (
                        <span className="text-[#F59E0B]">#3</span>
                      ) : (
                        <span className="text-[#8C8377]">#{rank}</span>
                      )}
                    </div>
                    <AvatarBadge avatarId={entry.avatar} size={38} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-[#F5EFE6] truncate">
                          {entry.name}
                        </span>
                        {isMe && (
                          <span className="px-1.5 py-0.5 rounded bg-[#E85D2A] text-[10px] font-extrabold text-white">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] font-mono text-[#A39A8E] flex items-center gap-1.5">
                        <Shield className="w-3 h-3 text-[#10B981]" />
                        <span>{entry.wins}W – {entry.losses}L</span>
                      </div>
                    </div>
                  </div>
                  <div className="font-mono font-extrabold text-sm text-[#F5B041] flex items-center gap-1.5 shrink-0">
                    <Trophy className="w-4 h-4" />
                    <span>{entry.trophies}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pinned Self Row when outside Top 100 */}
        {!inTop100 && (
          <div className="p-3.5 sm:px-5 border-t border-[#D99B26]/30 bg-[#1B1815] flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="px-2 py-1 rounded-lg bg-[#2C2621] text-[11px] font-mono font-bold text-[#C7BEB2] shrink-0">
                Not in top 100
              </span>
              <AvatarBadge avatarId={profile.avatarId} size={36} />
              <div className="min-w-0">
                <div className="font-bold text-sm text-[#F5EFE6] truncate">
                  {profile.nickname}
                </div>
                <div className="text-[11px] font-mono text-[#A39A8E]">
                  {profile.rankedWins}W – {profile.rankedLosses}L
                </div>
              </div>
            </div>
            <div className="font-mono font-extrabold text-sm text-[#F5B041] flex items-center gap-1.5 shrink-0">
              <Trophy className="w-4 h-4" />
              <span>{profile.trophies}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
