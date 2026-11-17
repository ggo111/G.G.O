import React, { useState, useCallback } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';

interface NameEntryScreenProps {
  onSubmit: (name: string) => Promise<{ ok: boolean; error?: string }>;
  loading?: boolean;
}

export function NameEntryScreen({ onSubmit, loading = false }: NameEntryScreenProps) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = name.trim();
      if (trimmed.length < 2) {
        setError('الاسم يجب أن يكون حرفين على الأقل');
        return;
      }
      setError(null);
      setSubmitting(true);
      try {
        const result = await onSubmit(trimmed);
        if (!result.ok) {
          setError(result.error || 'حدث خطأ');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [name, onSubmit]
  );

  const busy = loading || submitting;

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#161412] px-5">
      {/* Soft background glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 20%, rgba(217,155,38,0.18), transparent 60%)',
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[rgba(217,155,38,0.4)] bg-[#221e1b] shadow-lg">
            <Sparkles className="h-8 w-8 text-[#D99B26]" />
          </div>
          <h1
            className="text-3xl font-extrabold tracking-tight text-[#F5EFE6]"
            style={{ fontFamily: 'var(--font-display), system-ui' }}
          >
            G G O
          </h1>
          <p className="mt-2 text-sm text-[#C7BEB2]">اختر اسمك للعب</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[rgba(217,155,38,0.3)] bg-[#221e1b]/95 p-6 shadow-2xl backdrop-blur-sm"
        >
          <label htmlFor="player-name" className="mb-2 block text-xs font-medium uppercase tracking-wider text-[#C7BEB2]">
            اسم اللاعب
          </label>
          <input
            id="player-name"
            type="text"
            autoComplete="off"
            autoFocus
            maxLength={20}
            disabled={busy}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder="مثال: فارس_الحبر"
            className="w-full rounded-xl border border-[rgba(217,155,38,0.35)] bg-[#161412] px-4 py-3.5 text-base text-[#F5EFE6] placeholder:text-[#C7BEB2]/50 outline-none transition focus:border-[#D99B26] focus:ring-2 focus:ring-[#D99B26]/25 disabled:opacity-60"
          />

          {error && (
            <p className="mt-2.5 text-sm text-[#E85D2A]" role="alert">
              {error}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-[#C7BEB2]/80">
            حروف وأرقام و _ فقط · من 2 إلى 20 حرف · لا يوجد كلمة مرور
          </p>

          <button
            type="submit"
            disabled={busy || name.trim().length < 2}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#D99B26] px-5 py-3.5 text-sm font-bold text-[#161412] transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الدخول...
              </>
            ) : (
              'ادخل الحلبة'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#C7BEB2]/60">
          اسمك يحفظ تقدمك · يمكنك اللعب فوراً بدون تسجيل معقد
        </p>
      </div>
    </div>
  );
}
