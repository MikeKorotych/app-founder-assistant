// Dependency-free donut chart: competitors grouped by platform.
// Source → platform: googleplay → Android, itunes/appstore → iOS.
// Anything else keeps its own bucket (e.g. Product Hunt, AlternativeTo).

interface PlatformSlice {
  label: string;
  count: number;
  color: string;
}

// Known store sources → human platform label + slice color.
const PLATFORMS: Record<string, { label: string; color: string }> = {
  googleplay: { label: "Android", color: "#3ddc84" },
  itunes: { label: "iOS", color: "#0a84ff" },
  appstore: { label: "iOS", color: "#0a84ff" },
  app_store: { label: "iOS", color: "#0a84ff" },
  "app-store": { label: "iOS", color: "#0a84ff" },
  producthunt: { label: "Product Hunt", color: "#da552f" },
  alternativeto: { label: "AlternativeTo", color: "#8b5cf6" },
};

const FALLBACK_COLOR = "#9ca3af";

function bucket(sources: string[]): PlatformSlice[] {
  const byLabel = new Map<string, PlatformSlice>();
  for (const raw of sources) {
    const key = raw.trim().toLowerCase();
    const known = PLATFORMS[key];
    const label = known?.label ?? (raw.trim() || "Невідомо");
    const color = known?.color ?? FALLBACK_COLOR;
    const slice = byLabel.get(label);
    if (slice) slice.count += 1;
    else byLabel.set(label, { label, count: 1, color });
  }
  return [...byLabel.values()].sort((a, b) => b.count - a.count);
}

// Point on a circle for a given fraction (0..1), starting at 12 o'clock.
function pointAt(fraction: number, radius: number, cx: number, cy: number) {
  const angle = fraction * 2 * Math.PI - Math.PI / 2;
  return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
}

export function PlatformPie({ sources }: { sources: string[] }) {
  const slices = bucket(sources);
  const total = slices.reduce((sum, s) => sum + s.count, 0);
  if (total === 0) return null;

  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 2;
  const innerR = r * 0.58;

  // Single-platform case: a full ring can't be drawn with an arc path (start == end),
  // so render a plain ring instead.
  const single = slices.length === 1;

  let acc = 0;
  const arcs = slices.map((slice) => {
    const start = acc / total;
    acc += slice.count;
    const end = acc / total;
    const [x1, y1] = pointAt(start, r, cx, cy);
    const [x2, y2] = pointAt(end, r, cx, cy);
    const [ix1, iy1] = pointAt(start, innerR, cx, cy);
    const [ix2, iy2] = pointAt(end, innerR, cx, cy);
    const largeArc = end - start > 0.5 ? 1 : 0;
    const d = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      "Z",
    ].join(" ");
    return { slice, d, pct: Math.round((slice.count / total) * 100) };
  });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Конкуренти за платформою
      </p>
      <div className="flex flex-wrap items-center justify-center gap-6">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="Розподіл конкурентів за платформою"
          className="shrink-0"
        >
          {single ? (
            <circle
              cx={cx}
              cy={cy}
              r={(r + innerR) / 2}
              fill="none"
              stroke={slices[0].color}
              strokeWidth={r - innerR}
            />
          ) : (
            arcs.map(({ slice, d }) => <path key={slice.label} d={d} fill={slice.color} />)
          )}
          <text
            x={cx}
            y={cy - 4}
            textAnchor="middle"
            className="fill-foreground text-[22px] font-semibold"
          >
            {total}
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            className="fill-muted-foreground text-[10px] uppercase tracking-wide"
          >
            усього
          </text>
        </svg>
        <ul className="flex flex-col gap-2 text-sm">
          {arcs.map(({ slice, pct }) => (
            <li key={slice.label} className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-3 w-3 shrink-0 rounded-sm"
                style={{ backgroundColor: slice.color }}
              />
              <span className="font-medium">{slice.label}</span>
              <span className="text-muted-foreground">
                {slice.count} · {pct}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
