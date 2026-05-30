"use client";

// Endel-style ambient "still working" surface. A deep calm panel with three
// blurred gradient orbs drifting on slow, offset loops (18/23/29s) so the
// motion never visibly repeats — paired with a softly breathing caption.
// Used for every waiting state in the run (search-intent, Scout, validation).
export function ScoutLoading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/60"
      style={{
        background:
          "radial-gradient(120% 120% at 50% 0%, oklch(0.28 0.03 60) 0%, oklch(0.18 0.02 50) 60%, oklch(0.13 0.015 45) 100%)",
      }}
    >
      {/* Drifting aurora orbs — screen-blended warm tones over the dark base. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div
          className="ambient-orb ambient-orb-a"
          style={{
            top: "-30%",
            left: "-10%",
            width: "60%",
            height: "160%",
            background:
              "radial-gradient(circle at center, oklch(0.78 0.16 55 / 0.55), transparent 70%)",
          }}
        />
        <div
          className="ambient-orb ambient-orb-b"
          style={{
            top: "-20%",
            right: "-15%",
            width: "55%",
            height: "150%",
            background:
              "radial-gradient(circle at center, oklch(0.7 0.18 20 / 0.5), transparent 70%)",
          }}
        />
        <div
          className="ambient-orb ambient-orb-c"
          style={{
            bottom: "-40%",
            left: "25%",
            width: "55%",
            height: "150%",
            background:
              "radial-gradient(circle at center, oklch(0.6 0.16 300 / 0.45), transparent 70%)",
          }}
        />
      </div>

      {/* Caption — breathes gently in/out over the aurora. */}
      <div className="relative flex flex-col items-center gap-2 px-6 py-12 text-center">
        <div className="animate-breathe flex flex-col items-center gap-2">
          <span className="text-sm font-medium tracking-wide text-white/90">{title}</span>
          {hint && <span className="max-w-md text-xs text-white/55">{hint}</span>}
        </div>
      </div>
    </div>
  );
}
