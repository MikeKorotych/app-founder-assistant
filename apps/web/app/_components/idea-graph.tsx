"use client";

import { useEffect, useMemo, useRef, useState } from "react";

// Obsidian-style interactive force graph of the search intent: a central "Ідея"
// node links to category nodes, each keyword hangs off a category. Dependency-
// free: a tiny spring/charge simulation on an SVG, with draggable nodes and
// hover highlighting. Monochrome + theme-token driven so it fits light/dark.

type Kind = "idea" | "category" | "keyword";

interface GNode {
  id: string;
  label: string;
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null; // fixed (while dragged)
  fy: number | null;
  r: number;
}

interface GLink {
  a: number;
  b: number;
  dist: number;
}

const W = 660;
const H = 420;
const RADIUS: Record<Kind, number> = { idea: 13, category: 8, keyword: 4.5 };

function buildGraph(idea: string, categories: string[], keywords: string[]) {
  const nodes: GNode[] = [];
  const links: GLink[] = [];
  const cx = W / 2;
  const cy = H / 2;

  const mk = (id: string, label: string, kind: Kind, x: number, y: number): number => {
    nodes.push({ id, label, kind, x, y, vx: 0, vy: 0, fx: null, fy: null, r: RADIUS[kind] });
    return nodes.length - 1;
  };

  const ideaIdx = mk("idea", idea, "idea", cx, cy);

  const catIdx = categories.map((c, i) => {
    const a = (i / Math.max(1, categories.length)) * Math.PI * 2 - Math.PI / 2;
    const idx = mk(`c${i}`, c, "category", cx + Math.cos(a) * 120, cy + Math.sin(a) * 120);
    links.push({ a: ideaIdx, b: idx, dist: 120 });
    return idx;
  });

  keywords.forEach((k, i) => {
    // Hang each keyword off a category (round-robin); fall back to the centre.
    const parent = catIdx.length > 0 ? catIdx[i % catIdx.length] : ideaIdx;
    const base = nodes[parent];
    const a = Math.random() * Math.PI * 2;
    const idx = mk(`k${i}`, k, "keyword", base.x + Math.cos(a) * 70, base.y + Math.sin(a) * 70);
    links.push({ a: parent, b: idx, dist: 78 });
  });

  return { nodes, links };
}

function step(nodes: GNode[], links: GLink[], alpha: number) {
  const cx = W / 2;
  const cy = H / 2;

  // Charge: every pair repels (O(n^2), fine for a few dozen nodes).
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      let d2 = dx * dx + dy * dy;
      if (d2 < 0.01) {
        dx = (Math.random() - 0.5) * 0.5;
        dy = (Math.random() - 0.5) * 0.5;
        d2 = dx * dx + dy * dy;
      }
      const d = Math.sqrt(d2);
      const force = (820 / d2) * alpha;
      const fx = (dx / d) * force;
      const fy = (dy / d) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // Springs along links.
  for (const l of links) {
    const a = nodes[l.a];
    const b = nodes[l.b];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
    const k = ((d - l.dist) / d) * 0.06 * alpha;
    const fx = dx * k;
    const fy = dy * k;
    a.vx += fx;
    a.vy += fy;
    b.vx -= fx;
    b.vy -= fy;
  }

  // Gentle centering + integrate with damping; clamp inside the viewBox.
  for (const n of nodes) {
    if (n.fx !== null && n.fy !== null) {
      n.x = n.fx;
      n.y = n.fy;
      n.vx = 0;
      n.vy = 0;
      continue;
    }
    n.vx += (cx - n.x) * 0.0016 * alpha;
    n.vy += (cy - n.y) * 0.0016 * alpha;
    n.vx *= 0.86;
    n.vy *= 0.86;
    n.x = Math.max(n.r + 4, Math.min(W - n.r - 4, n.x + n.vx));
    n.y = Math.max(n.r + 4, Math.min(H - n.r - 4, n.y + n.vy));
  }
}

export function IdeaGraph({
  idea,
  categories,
  keywords,
}: {
  idea: string;
  categories: string[];
  keywords: string[];
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const built = useMemo(() => buildGraph(idea, categories, keywords), [idea, categories, keywords]);
  const nodesRef = useRef<GNode[]>(built.nodes);
  nodesRef.current = built.nodes;
  const alphaRef = useRef(1);
  const dragRef = useRef<number | null>(null);
  const [, setFrame] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  // Neighbours of each node, for hover highlighting.
  const neighbours = useMemo(() => {
    const m = built.nodes.map(() => new Set<number>());
    for (const l of built.links) {
      m[l.a].add(l.b);
      m[l.b].add(l.a);
    }
    return m;
  }, [built]);

  useEffect(() => {
    alphaRef.current = 1;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      // Settle synchronously, no animation.
      for (let i = 0; i < 220; i++) step(nodesRef.current, built.links, 0.6);
      setFrame((f) => f + 1);
      return;
    }

    let raf = 0;
    const loop = () => {
      // Cool down, but keep a small floor so the graph stays subtly alive.
      alphaRef.current = Math.max(0.012, alphaRef.current * 0.992);
      step(nodesRef.current, built.links, alphaRef.current + (dragRef.current !== null ? 0.4 : 0));
      setFrame((f) => f + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [built]);

  const toLocal = (e: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((e.clientX - rect.left) / rect.width) * W,
      y: ((e.clientY - rect.top) / rect.height) * H,
    };
  };

  const onPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = i;
    alphaRef.current = Math.max(alphaRef.current, 0.6);
    const p = toLocal(e);
    nodesRef.current[i].fx = p.x;
    nodesRef.current[i].fy = p.y;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const i = dragRef.current;
    if (i === null) return;
    const p = toLocal(e);
    nodesRef.current[i].fx = p.x;
    nodesRef.current[i].fy = p.y;
  };
  const onPointerUp = () => {
    const i = dragRef.current;
    if (i !== null) {
      nodesRef.current[i].fx = null;
      nodesRef.current[i].fy = null;
    }
    dragRef.current = null;
  };

  const nodes = nodesRef.current;
  const active = hover;
  const isLit = (i: number) => active === null || active === i || neighbours[active]?.has(i);

  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-background/30">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="h-[300px] w-full touch-none select-none sm:h-[380px]"
        role="img"
        aria-label="Граф категорій і ключових слів"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <g stroke="currentColor" className="text-foreground">
          {built.links.map((l) => {
            const a = nodes[l.a];
            const b = nodes[l.b];
            const lit = active === null || active === l.a || active === l.b;
            return (
              <line
                key={`${l.a}-${l.b}`}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeWidth={lit ? 1 : 0.6}
                strokeOpacity={lit ? 0.28 : 0.1}
              />
            );
          })}
        </g>

        {nodes.map((n, i) => {
          const lit = isLit(i);
          const fill =
            n.kind === "idea"
              ? "var(--foreground)"
              : n.kind === "category"
                ? "var(--primary)"
                : "var(--muted-foreground)";
          const showLabel =
            n.kind !== "keyword" || active === i || neighbours[active ?? -1]?.has(i);
          return (
            <g
              key={n.id}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={onPointerDown(i)}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              style={{ opacity: lit ? 1 : 0.32, transition: "opacity 160ms" }}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={fill}
                stroke="var(--background)"
                strokeWidth={1.5}
              />
              {showLabel && (
                <text
                  x={n.x}
                  y={n.y - n.r - 5}
                  textAnchor="middle"
                  className="pointer-events-none fill-foreground"
                  style={{
                    fontSize: n.kind === "idea" ? 13 : n.kind === "category" ? 11 : 9.5,
                    fontWeight: n.kind === "keyword" ? 400 : 600,
                  }}
                >
                  {n.kind === "idea" ? "Ідея" : n.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute bottom-2 right-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-primary" /> категорії
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground" /> ключові слова
        </span>
      </div>
    </div>
  );
}
