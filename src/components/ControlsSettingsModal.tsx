import React from 'react';
import { Bug, Sliders, X } from 'lucide-react';
import type { AIDifficulty, ControlSettings, ControlSize, RoundDurationSec, TouchMode } from '../types/game.ts';
import { openDebugPanel } from '../utils/debugLog.ts';

interface ControlsSettingsModalProps {
  settings: ControlSettings;
  onChange: (next: ControlSettings) => void;
  onClose: () => void;
}

export const ControlsSettingsModal: React.FC<ControlsSettingsModalProps> = ({
  settings,
  onChange,
  onClose,
}) => {
  const activeRoundSec: RoundDurationSec = settings.roundDurationSec === 300 ? 300 : 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/35 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-[#D99B26]" />
            <h2 className="font-display text-xl font-extrabold text-[#F5EFE6]">
              Controls &amp; Settings
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openDebugPanel(true)}
              className="min-h-[36px] px-2.5 rounded-lg bg-[#161412] hover:bg-[#2C2621] border border-white/10 text-xs font-mono text-[#A39A8E] hover:text-[#D99B26] flex items-center gap-1.5 cursor-pointer"
              title="Open online & WebRTC debug log"
            >
              <Bug className="w-3.5 h-3.5" />
              <span>Debug</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
              aria-label="Close control settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bot Difficulty Selector (saved in localStorage) */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[#C7BEB2]">Solo &amp; Bot Difficulty</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'easy', label: 'Easy' },
                { id: 'normal', label: 'Normal' },
                { id: 'hard', label: 'Hard' },
              ] as { id: AIDifficulty; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...settings, botDifficulty: opt.id })}
                className={`min-h-[42px] px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  settings.botDifficulty === opt.id
                    ? 'bg-[#10B981] border-[#F5EFE6]/30 text-[#161412]'
                    : 'bg-[#161412] border-white/10 text-[#C7BEB2]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Round Time Setting (Solo & Private Room; Quick Match stays 1 min) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#C7BEB2]">Round Time (Solo / Rooms)</span>
            <span className="text-[11px] text-[#8C8377]">Quick Match locked at 1 min</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { sec: 60, label: '1 Minute' },
                { sec: 300, label: '5 Minutes' },
              ] as { sec: RoundDurationSec; label: string }[]
            ).map((opt) => (
              <button
                key={opt.sec}
                type="button"
                onClick={() => onChange({ ...settings, roundDurationSec: opt.sec })}
                className={`min-h-[42px] px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  activeRoundSec === opt.sec
                    ? 'bg-[#D99B26] border-[#F5EFE6]/30 text-[#161412]'
                    : 'bg-[#161412] border-white/10 text-[#C7BEB2]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Control Size */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[#C7BEB2]">On-Screen Button Size</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'compact', label: 'Compact (72px)' },
                { id: 'standard', label: 'Standard (80px)' },
                { id: 'large', label: 'Large (92px)' },
              ] as { id: ControlSize; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...settings, controlSize: opt.id })}
                className={`min-h-[44px] px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  settings.controlSize === opt.id
                    ? 'bg-[#E85D2A] border-[#F5EFE6]/30 text-white'
                    : 'bg-[#161412] border-white/10 text-[#C7BEB2]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Left-handed Layout */}
        <div className="flex items-center justify-between gap-3 rounded-xl bg-[#161412] border border-white/10 px-4 py-3">
          <div>
            <div className="text-sm font-bold text-[#F5EFE6]">Left-Handed Layout</div>
            <div className="text-xs text-[#C7BEB2]">
              Swaps Move pads and Boost / Lance / Special sides
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...settings, leftHanded: !settings.leftHanded })}
            className={`min-h-[40px] px-4 rounded-lg text-xs font-extrabold cursor-pointer ${
              settings.leftHanded ? 'bg-[#10B981] text-[#161412]' : 'bg-[#2C2621] text-[#C7BEB2]'
            }`}
          >
            {settings.leftHanded ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* Sensitivity */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-[#C7BEB2]">Move &amp; Lance Sensitivity</span>
            <span className="font-mono tabular-nums text-[#D99B26] font-bold">
              {settings.sensitivity.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={0.6}
            max={1.5}
            step={0.1}
            value={settings.sensitivity}
            onChange={(e) => onChange({ ...settings, sensitivity: Number(e.target.value) })}
            className="w-full accent-[#E85D2A] cursor-pointer"
          />
        </div>

        {/* Controls Input Mode (Auto / Touch / Keyboard) */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#C7BEB2]">Controls</span>
            <span className="text-[11px] text-[#8C8377]">Auto detects device &amp; input</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: 'auto', label: 'Auto (Default)' },
                { id: 'always', label: 'Touch' },
                { id: 'off', label: 'Keyboard' },
              ] as { id: TouchMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onChange({ ...settings, touchMode: opt.id })}
                className={`min-h-[42px] px-2 rounded-xl text-xs font-bold border cursor-pointer ${
                  settings.touchMode === opt.id
                    ? 'bg-[#D99B26] border-[#F5EFE6]/30 text-[#161412]'
                    : 'bg-[#161412] border-white/10 text-[#C7BEB2]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="min-h-[46px] w-full rounded-xl bg-[#E85D2A] hover:bg-[#F26A38] text-sm font-extrabold text-white cursor-pointer"
        >
          Done
        </button>
      </div>
    </div>
  );
};
