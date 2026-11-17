export interface PromoCodeEntry {
  code: string;
  name: string;
}

export const PROMO_CODES: PromoCodeEntry[] = [
  { code: 'Tare', name: 'Tare' },
  { code: 'Ghost', name: 'Ghost' },
  { code: 'Dodo Saber', name: 'Dodo Saber' },
  { code: 'Amr Khalid', name: 'Amr Khalid' },
  { code: 'Gemmy', name: 'Gemmy' },
];

export function normalizePromoInput(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function matchPromoCode(raw: string): PromoCodeEntry | null {
  const normalized = normalizePromoInput(raw);
  if (!normalized) return null;
  return PROMO_CODES.find((entry) => normalizePromoInput(entry.code) === normalized) ?? null;
}
