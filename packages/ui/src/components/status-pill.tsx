import { cn } from "../lib/utils";

type Tone = "idle" | "working" | "success" | "error";

interface StatusPillProps {
  tone: Tone;
  label: string;
}

const toneStyles: Record<Tone, { dot: string; ring: string; text: string; pulse: boolean }> = {
  idle: {
    dot: "bg-muted-foreground",
    ring: "bg-muted-foreground",
    text: "text-muted-foreground",
    pulse: false,
  },
  working: {
    dot: "bg-success shadow-[0_0_12px_var(--success)]",
    ring: "bg-success",
    text: "text-foreground",
    pulse: true,
  },
  success: {
    dot: "bg-success",
    ring: "bg-success",
    text: "text-foreground",
    pulse: false,
  },
  error: {
    dot: "bg-destructive",
    ring: "bg-destructive",
    text: "text-destructive",
    pulse: false,
  },
};

export function StatusPill({ tone, label }: StatusPillProps) {
  const styles = toneStyles[tone];
  return (
    <div className="inline-flex items-center gap-2 text-sm">
      <span className="relative inline-flex size-2 items-center justify-center" aria-hidden>
        {styles.pulse && (
          <span
            className={cn(
              "absolute inset-0 inline-block rounded-full animate-pill-ping",
              styles.ring,
            )}
          />
        )}
        <span className={cn("relative inline-block size-2 rounded-full", styles.dot)} />
      </span>
      <span className={cn("font-medium tracking-tight", styles.text)}>{label}</span>
    </div>
  );
}
