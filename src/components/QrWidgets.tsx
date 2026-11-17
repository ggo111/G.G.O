import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy, QrCode, X } from 'lucide-react';

export const QrCodeDisplay: React.FC<{ value: string; size?: number }> = ({ value, size = 196 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !value) return;
    QRCode.toCanvas(
      canvas,
      value,
      {
        width: size,
        margin: 2,
        color: {
          dark: '#161412',
          light: '#F5EFE6',
        },
        errorCorrectionLevel: 'L',
      },
      () => {}
    );
  }, [value, size]);

  return (
    <div className="inline-flex flex-col items-center rounded-xl bg-[#F5EFE6] p-2.5 border border-[#D99B26]/40">
      <canvas ref={canvasRef} className="block rounded-lg" />
    </div>
  );
};

export const CopyCodeBox: React.FC<{ label: string; value: string }> = ({ label, value }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Fallback ignored
    }
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <span className="text-xs font-medium text-[#C7BEB2]">{label}</span>
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 min-w-0 rounded-lg bg-[#161412] border border-[#D99B26]/25 px-3 py-2.5 text-xs font-mono text-[#F5EFE6] focus:outline-none focus:border-[#E85D2A]"
        />
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[44px] px-3.5 rounded-lg bg-[#2B2622] hover:bg-[#38312B] border border-[#D99B26]/30 text-xs font-semibold text-[#F5EFE6] flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-[#10B981]" /> : <Copy className="w-4 h-4 text-[#D99B26]" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
    </div>
  );
};

export const QrScannerModal: React.FC<{
  title: string;
  onScan: (text: string) => void;
  onClose: () => void;
}> = ({ title, onScan, onClose }) => {
  const [manualText, setManualText] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md rounded-2xl bg-[#221E1B] border border-[#D99B26]/30 p-5 flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-[#D99B26]" />
            <h3 className="font-display text-lg font-bold text-[#F5EFE6]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-[#2C2621] hover:bg-[#38312B] flex items-center justify-center text-[#F5EFE6] cursor-pointer"
            aria-label="Close code modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs text-[#C7BEB2]">Paste friend&apos;s signaling code directly:</span>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder="GGO1:..."
              autoFocus
              className="flex-1 min-w-0 rounded-lg bg-[#161412] border border-[#D99B26]/25 px-3 py-2.5 text-xs font-mono text-[#F5EFE6] focus:outline-none focus:border-[#E85D2A]"
            />
            <button
              type="button"
              disabled={!manualText.trim()}
              onClick={() => onScan(manualText.trim())}
              className="min-h-[44px] px-4 rounded-lg bg-[#E85D2A] disabled:opacity-40 text-xs font-bold text-white cursor-pointer whitespace-nowrap"
            >
              Connect
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
