import { cn } from '../lib/utils';

const KNOWN_STATUSES = ['QUEUED', 'RUNNING', 'STOPPED', 'COMPLETED', 'FAILED'] as const;
type KnownStatus = (typeof KNOWN_STATUSES)[number];

interface ToneStyle {
  wrapper: string;
  dot: string;
  pulse: boolean;
}

const styles: Record<KnownStatus, ToneStyle> = {
  QUEUED: {
    wrapper: 'bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
    pulse: false,
  },
  RUNNING: {
    wrapper: 'bg-primary/10 text-primary',
    dot: 'bg-primary',
    pulse: true,
  },
  STOPPED: {
    wrapper: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    pulse: false,
  },
  COMPLETED: {
    wrapper: 'bg-success/15 text-success',
    dot: 'bg-success',
    pulse: false,
  },
  FAILED: {
    wrapper: 'bg-destructive/15 text-destructive',
    dot: 'bg-destructive',
    pulse: false,
  },
};

interface StatusBadgeProps {
  // Accept any string so DB-side enum changes don't break the type,
  // unknown values render with the QUEUED tone.
  status: string;
  size?: 'sm' | 'md';
  // Optional detail (e.g. failure reason) surfaced on hover.
  message?: string | null;
}

function toneFor(status: string): ToneStyle {
  return (KNOWN_STATUSES as readonly string[]).includes(status)
    ? styles[status as KnownStatus]
    : styles.QUEUED;
}

/**
 * Dot-only status indicator. The colour carries the meaning; the word is
 * exposed via title/aria for hover + screen readers. Used in dense lists
 * where the status label would be redundant noise.
 */
export function StatusDot({ status, message }: { status: string; message?: string | null }) {
  const style = toneFor(status);
  // Surface the failure reason on hover (and to screen readers) so a red dot
  // isn't a dead end — you can see *why* it failed without opening the run.
  const tip = message ? `${status}: ${message}` : status;
  return (
    <span className="inline-flex items-center" title={tip} aria-label={tip} role="img">
      <span className="relative inline-flex size-2 items-center justify-center" aria-hidden>
        {style.pulse && (
          <span
            className={cn(
              'absolute inset-0 inline-block rounded-full animate-pill-ping',
              style.dot,
            )}
          />
        )}
        <span className={cn('relative inline-block size-2 rounded-full', style.dot)} />
      </span>
    </span>
  );
}

export function StatusBadge({ status, size = 'sm', message }: StatusBadgeProps) {
  const style = toneFor(status);
  return (
    <span
      title={message ? `${status}: ${message}` : status}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium tracking-tight',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-xs',
        style.wrapper,
      )}
    >
      <span className="relative inline-flex size-1.5 items-center justify-center" aria-hidden>
        {style.pulse && (
          <span
            className={cn(
              'absolute inset-0 inline-block rounded-full animate-pill-ping',
              style.dot,
            )}
          />
        )}
        <span className={cn('relative inline-block size-1.5 rounded-full', style.dot)} />
      </span>
      {status}
    </span>
  );
}
