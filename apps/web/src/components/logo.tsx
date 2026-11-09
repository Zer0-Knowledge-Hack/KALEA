/**
 * Kalea mark ("crowned street") and wordmark. Rendered as static HTML by Astro, and reused inside islands.
 * Geometry matches brand/logo/kalea-mark.svg (48-unit grid). See brand/README.md for usage rules.
 */
export type LogoTone = 'color' | 'on-dark' | 'mono';

interface MarkProps {
  /** Rendered height of the 48-unit mark box, in pixels. */
  size?: number;
  /** "color" for light backgrounds, "on-dark" for Deep/Ocean, "mono" follows `currentColor`. */
  tone?: LogoTone;
  class?: string;
}

const MARK_FILLS: Record<LogoTone, { buildings: string; street: string }> = {
  color: { buildings: 'fill-ocean', street: 'fill-apricot' },
  'on-dark': { buildings: 'fill-white', street: 'fill-apricot' },
  mono: { buildings: 'fill-current', street: 'fill-current' },
};

const WORDMARK_COLORS: Record<LogoTone, string> = {
  color: 'text-ink',
  'on-dark': 'text-white',
  mono: '',
};

export function LogoMark({ size = 28, tone = 'color', class: className = '' }: MarkProps) {
  const fills = MARK_FILLS[tone];
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      class={`shrink-0 ${className}`}
      aria-hidden="true"
    >
      <polygon points="5,42 5,11 14,20 18.8,20 14.5,42" class={fills.buildings} />
      <polygon points="43,42 43,11 34,20 29.2,20 33.5,42" class={fills.buildings} />
      <polygon points="24,6 31,42 17,42" class={fills.street} />
    </svg>
  );
}

interface LogoProps extends MarkProps {
  /** Show the live-text "Kalea" wordmark next to the mark. */
  withWordmark?: boolean;
}

/** Mark plus wordmark lockup. Defaults to the on-dark tone used by the current dark site. */
export function Logo({
  size = 28,
  tone = 'on-dark',
  withWordmark = true,
  class: className = '',
}: LogoProps) {
  return (
    <span
      class={`inline-flex items-center ${className}`}
      style={{ gap: `${Math.round(size * 0.3)}px` }}
    >
      <LogoMark size={size} tone={tone} />
      {withWordmark && (
        <span
          class={`font-display font-bold leading-none tracking-[-0.02em] ${WORDMARK_COLORS[tone]}`}
          style={{ fontSize: `${Math.round(size * 0.77)}px` }}
        >
          Kalea
        </span>
      )}
    </span>
  );
}
