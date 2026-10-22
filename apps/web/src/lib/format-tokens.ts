import type { Locale } from '@paperless-starfruit/shared';

const UNITS: Record<Locale, readonly string[]> = {
  en: ['K', 'M', 'B'],
  ru: [' тыс.', ' млн', ' млрд'],
  de: [' Tsd.', ' Mio.', ' Mrd.'],
};

/** Compact token counts; round before choosing a unit so 999,950 becomes 1.0M. */
export function formatTokens(value: number, locale: Locale): string {
  if (Math.round(value) < 1000) return Math.round(value).toLocaleString(locale);
  let unit = 0;
  let scaled = value / 1000;
  while (Math.round(scaled * 10) / 10 >= 1000 && unit < 2) {
    scaled /= 1000;
    unit++;
  }
  return (
    scaled.toLocaleString(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + UNITS[locale][unit]
  );
}
