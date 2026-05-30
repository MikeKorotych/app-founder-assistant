import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "../lib/utils";

export interface EmotionArcData {
  emotions: string[];
  points: Record<string, string | number>[];
}

// Distinct hues that read well on the dark theme; violet leads to match the
// app's primary accent.
const SERIES_COLORS = ["#8b5cf6", "#38bdf8", "#fb923c"];

function colorFor(i: number): string {
  return SERIES_COLORS[i % SERIES_COLORS.length] ?? "#8b5cf6";
}

/**
 * Overlaid area chart of emotional intensity (0-100) across the funnel. Each
 * emotion is its own series, so dips mean the funnel eased the pressure and
 * peaks mean it intensified.
 */
export function EmotionArcChart({ emotions, points }: EmotionArcData) {
  // Emotions toggled off via the legend — hidden from the chart but kept in
  // the legend (dimmed) so they can be brought back.
  const [hidden, setHidden] = React.useState<ReadonlySet<string>>(new Set());

  const toggle = (e: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-x-1 gap-y-1">
        {emotions.map((e, i) => {
          const off = hidden.has(e);
          return (
            <button
              key={e}
              type="button"
              onClick={() => {
                toggle(e);
              }}
              aria-pressed={!off}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs capitalize transition-colors hover:bg-muted/50",
                off ? "text-muted-foreground/50" : "text-muted-foreground",
              )}
            >
              <span
                className={cn("size-2 rounded-full transition-opacity", off && "opacity-30")}
                style={{ background: colorFor(i) }}
              />
              <span className={cn(off && "line-through")}>{e}</span>
            </button>
          );
        })}
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -24 }}>
            <defs>
              {emotions.map((e, i) => (
                <linearGradient key={e} id={`emo-fill-${String(i)}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorFor(i)} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={colorFor(i)} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid vertical={false} stroke="currentColor" className="text-border/30" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
            />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              cursor={{ stroke: "currentColor", strokeOpacity: 0.2 }}
              content={<ArcTooltip />}
            />
            {emotions.map((e, i) =>
              hidden.has(e) ? null : (
                <Area
                  key={e}
                  type="monotone"
                  dataKey={e}
                  stroke={colorFor(i)}
                  strokeWidth={2}
                  fill={`url(#emo-fill-${String(i)})`}
                  dot={false}
                  activeDot={{ r: 3 }}
                  isAnimationActive
                />
              ),
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

interface ArcTooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
}
interface ArcTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: ArcTooltipEntry[];
}

function ArcTooltip({ active, payload, label }: ArcTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border/60 bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{String(label)}</div>
      <div className="space-y-0.5">
        {payload.map((p) => (
          <div key={String(p.name)} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="capitalize text-muted-foreground">{String(p.name)}</span>
            <span className="ml-auto font-medium tabular-nums">{String(p.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
