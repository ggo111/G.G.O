import React, { useEffect, useRef, useState } from 'react';
import { Bug, Check, Copy, Trash2, X } from 'lucide-react';
import {
  clearDebugLogs,
  formatDebugDump,
  getDebugLogs,
  getDebugStatus,
  subscribeDebugLogs,
  subscribeDebugStatus,
  type DebugLogEntry,
  type DebugStatusState,
} from '../utils/debugLog.ts';

interface DebugPanelModalProps {
  onClose: () => void;
}

export const DebugPanelModal: React.FC<DebugPanelModalProps> = ({ onClose }) => {
  const [logs, setLogs] = useState<DebugLogEntry[]>(() => getDebugLogs());
  const [status, setStatus] = useState<DebugStatusState>(() => getDebugStatus());
  const [copied, setCopied] = useState(false);
  const scrollBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const unsubLogs = subscribeDebugLogs(() => setLogs(getDebugLogs()));
    const unsubStatus = subscribeDebugStatus(() => setStatus(getDebugStatus()));
    return () => {
      unsubLogs();
      unsubStatus();
    };
  }, []);

  // Auto-scroll to latest line at the bottom
  useEffect(() => {
    const el = scrollBoxRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [logs.length]);

  const handleCopy = async () => {
    const text = formatDebugDump();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  const authBadge =
    status.authOk === true ? 'OK' : status.authOk === false ? 'FAIL' : 'WAIT';
  const dbBadge =
    status.firebaseDbOk === true ? 'OK' : status.firebaseDbOk === false ? 'FAIL' : 'WAIT';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-3 sm:p-5">
      <div className="w-full max-w-3xl h-[85vh] max-h-[680px] rounded-2xl bg-[#181512] border border-[#D99B26]/40 flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 bg-[#221E1B] border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Bug className="w-4 h-4 text-[#D99B26]" />
            <h2 className="font-display text-base sm:text-lg font-extrabold text-[#F5EFE6]">
              Online &amp; WebRTC Diagnostics
            </h2>
            <span className="text-[11px] font-mono text-[#A39A8E]">({logs.length}/200)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="min-h-[36px] px-3 rounded-lg bg-[#2C2621] hover:bg-[#3A322C] border border-white/10 text-xs font-semibold text-[#F5EFE6] flex items-center gap-1.5 cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[#10B981]" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy log'}</span>
            </button>
            <button
              type="button"
              onClick={() => clearDebugLogs()}
              className="min-h-[36px] px-3 rounded-lg bg-[#2C2621] hover:bg-[#3A322C] border border-white/10 text-xs font-semibold text-[#F5EFE6] flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 text-[#E85D2A]" />
              <span>Clear</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[36px] min-w-[36px] rounded-lg bg-[#2C2621] hover:bg-[#3A322C] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
              aria-label="Close debug panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Live Status Strip */}
        <div className="px-4 py-2 bg-[#1D1916] border-b border-white/10 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono shrink-0">
          <span>
            Auth:{' '}
            <strong
              className={
                status.authOk === true
                  ? 'text-[#10B981]'
                  : status.authOk === false
                  ? 'text-red-400'
                  : 'text-amber-300'
              }
            >
              {authBadge}
            </strong>
            {status.authUid ? (
              <span className="text-[#A39A8E]"> ({status.authUid.slice(0, 8)})</span>
            ) : null}
          </span>
          <span>
            Firebase DB:{' '}
            <strong
              className={
                status.firebaseDbOk === true
                  ? 'text-[#10B981]'
                  : status.firebaseDbOk === false
                  ? 'text-red-400'
                  : 'text-amber-300'
              }
            >
              {dbBadge}
            </strong>
          </span>
          <span>
            Queue: <strong className="text-[#D99B26]">{status.queueState}</strong>
          </span>
          <span>
            RTC:{' '}
            <strong
              className={
                status.connectionState === 'connected'
                  ? 'text-[#10B981]'
                  : status.connectionState === 'failed'
                  ? 'text-red-400'
                  : 'text-[#38BDF8]'
              }
            >
              {status.connectionState}
            </strong>
            <span className="text-[#A39A8E]"> (ICE:{status.iceConnectionState})</span>
          </span>
          <span>
            DC:{' '}
            <strong
              className={
                status.dataChannelState === 'open'
                  ? 'text-[#10B981]'
                  : status.dataChannelState === 'closed'
                  ? 'text-red-400'
                  : 'text-[#38BDF8]'
              }
            >
              {status.dataChannelState}
            </strong>
          </span>
          <span>
            Ping:{' '}
            <strong className="text-[#F5EFE6]">
              {status.pingMs !== null ? `${status.pingMs}ms` : '--'}
            </strong>
          </span>
        </div>

        {/* Scrolling Log Lines (latest at bottom) */}
        <div
          ref={scrollBoxRef}
          className="flex-1 overflow-y-auto forge-scroll p-3 font-mono text-[11px] leading-relaxed select-text space-y-1 bg-[#12100E]"
        >
          {logs.length === 0 ? (
            <div className="text-[#8C8377] py-6 text-center">
              No diagnostic events yet. Start Quick Match or Private Room to see live logs.
            </div>
          ) : (
            logs.map((entry) => (
              <div key={entry.id} className="break-words text-[#E5DFD5]">
                <span className="text-[#8C8377] mr-2">{entry.time}</span>
                <span
                  className={`font-bold mr-2 ${
                    entry.tag.includes('ERROR') || entry.tag.includes('REJECT')
                      ? 'text-red-400'
                      : entry.tag === 'SIGNAL' || entry.tag === 'RTC' || entry.tag === 'DC'
                      ? 'text-[#38BDF8]'
                      : entry.tag === 'PHASE' || entry.tag === 'MATCH'
                      ? 'text-[#10B981]'
                      : 'text-[#D99B26]'
                  }`}
                >
                  [{entry.tag}]
                </span>
                <span>{entry.message}</span>
                {entry.data && (
                  <span className="text-[#A39A8E] ml-1.5">{entry.data}</span>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
