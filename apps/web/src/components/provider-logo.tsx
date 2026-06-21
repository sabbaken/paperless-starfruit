import { Server } from 'lucide-react';
import { PROVIDER_KIND, type ProviderKind } from '@paperless-starfruit/shared';
import { cn } from '@/lib/utils.ts';

/**
 * Brand logos (PNG, served from `public/icons/providers`). `mono` flags pure-black
 * marks (e.g. OpenAI, xAI) that must invert in dark mode to stay visible — coloured
 * logos are left untouched.
 */
const LOGOS: Partial<Record<ProviderKind, { src: string; mono?: boolean }>> = {
  [PROVIDER_KIND.OPENAI]: { src: '/icons/providers/openai.png', mono: true },
  [PROVIDER_KIND.ANTHROPIC]: { src: '/icons/providers/anthropic.png' },
  [PROVIDER_KIND.GOOGLE]: { src: '/icons/providers/google.png' },
  [PROVIDER_KIND.MISTRAL]: { src: '/icons/providers/mistral.png' },
};

/** Small company logo for a provider; self-hosted endpoints fall back to a generic mark. */
export function ProviderLogo({ kind, className }: { kind: ProviderKind; className?: string }) {
  const logo = LOGOS[kind];
  if (!logo) return <Server className={cn('size-4', className)} aria-hidden />;
  return (
    <img
      src={logo.src}
      alt=""
      aria-hidden
      className={cn('size-4 object-contain', logo.mono && 'dark:invert', className)}
    />
  );
}
