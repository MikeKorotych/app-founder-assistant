"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Tile-based 2048 with original-style animations: tiles slide (transform
// transition), pop on spawn and on merge. Smaller board + mouse/touch swipes.
const N = 4;
const CELL = 52;
const GAP = 8;
const BOARD = N * CELL + (N + 1) * GAP;
const pos = (i: number) => GAP + i * (CELL + GAP);

type Dir = "up" | "down" | "left" | "right";
interface Tile {
  id: number;
  value: number;
  r: number;
  c: number;
  spawn?: boolean;
  merged?: boolean;
  dead?: boolean; // merged-away tile: slides into its target, then removed
}

function tileColor(v: number): React.CSSProperties {
  const op = Math.min(0.14 + Math.log2(v) / 11, 0.96);
  return { background: `rgba(232,233,235,${op})`, color: op > 0.55 ? "#0a0a0b" : "var(--foreground)" };
}
const fontSize = (v: number) => (v < 100 ? 22 : v < 1000 ? 19 : 16);

export function Game2048() {
  const idRef = useRef(0);
  const nid = () => ++idRef.current;

  const seed = useCallback((): Tile[] => {
    const a: Tile = { id: nid(), value: Math.random() < 0.9 ? 2 : 4, r: 0, c: 0, spawn: true };
    const cells: [number, number][] = [];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cells.push([r, c]);
    const [ar, ac] = cells.splice(Math.floor(Math.random() * cells.length), 1)[0];
    const [br, bc] = cells[Math.floor(Math.random() * cells.length)];
    a.r = ar; a.c = ac;
    return [a, { id: nid(), value: Math.random() < 0.9 ? 2 : 4, r: br, c: bc, spawn: true }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [tiles, setTiles] = useState<Tile[]>(seed);
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);
  const cleanup = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(() => {
    if (cleanup.current) clearTimeout(cleanup.current);
    setTiles(seed());
    setScore(0);
    setOver(false);
  }, [seed]);

  const doMove = useCallback((dir: Dir) => {
    setTiles((prev) => {
      const live = prev.filter((t) => !t.dead).map((t) => ({ ...t, spawn: false, merged: false }));
      const grid: (Tile | null)[][] = Array.from({ length: N }, () => Array(N).fill(null));
      for (const t of live) grid[t.r][t.c] = t;

      const dr = dir === "up" ? -1 : dir === "down" ? 1 : 0;
      const dc = dir === "left" ? -1 : dir === "right" ? 1 : 0;
      const rs = dir === "down" ? [3, 2, 1, 0] : [0, 1, 2, 3];
      const cs = dir === "right" ? [3, 2, 1, 0] : [0, 1, 2, 3];

      let gained = 0;
      let moved = false;
      for (const r of rs) for (const c of cs) {
        const t = grid[r][c];
        if (!t) continue;
        let nr = r;
        let nc = c;
        while (true) {
          const tr = nr + dr;
          const tc = nc + dc;
          if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
          const nx = grid[tr][tc];
          if (nx === null) { nr = tr; nc = tc; continue; }
          if (nx.value === t.value && !nx.merged) { nr = tr; nc = tc; }
          break;
        }
        if (nr === r && nc === c) continue;
        const dest = grid[nr][nc];
        grid[r][c] = null;
        if (dest && dest !== t && dest.value === t.value && !dest.merged) {
          dest.value *= 2;
          dest.merged = true;
          gained += dest.value;
          t.r = nr; t.c = nc; t.dead = true; // slides onto dest, removed on cleanup
        } else {
          grid[nr][nc] = t; t.r = nr; t.c = nc;
        }
        moved = true;
      }

      if (!moved) return prev;
      if (gained) setScore((s) => s + gained);

      // spawn a new tile in an empty cell
      const empty: [number, number][] = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) empty.push([r, c]);
      const next = [...live];
      if (empty.length) {
        const [sr, sc] = empty[Math.floor(Math.random() * empty.length)];
        const tile: Tile = { id: nid(), value: Math.random() < 0.9 ? 2 : 4, r: sr, c: sc, spawn: true };
        grid[sr][sc] = tile;
        next.push(tile);
      }

      // game over? no empties and no adjacent equal pair
      let canMove = empty.length > 0;
      if (!canMove) {
        outer: for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const v = grid[r][c]?.value;
          if (c + 1 < N && grid[r][c + 1]?.value === v) { canMove = true; break outer; }
          if (r + 1 < N && grid[r + 1][c]?.value === v) { canMove = true; break outer; }
        }
      }
      if (!canMove) setOver(true);

      // remove dead ghosts + clear flags shortly after the slide finishes
      if (cleanup.current) clearTimeout(cleanup.current);
      cleanup.current = setTimeout(() => {
        setTiles((cur) => cur.filter((t) => !t.dead).map((t) => ({ ...t, spawn: false, merged: false })));
      }, 150);

      return next;
    });
  }, []);

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      a: "left", d: "right", w: "up", s: "down",
    };
    const h = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir && !over) { e.preventDefault(); doMove(dir); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doMove, over]);

  // mouse / touch swipe
  const drag = useRef<{ x: number; y: number } | null>(null);
  const onDown = (e: React.PointerEvent) => { drag.current = { x: e.clientX, y: e.clientY }; };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || over) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) < 18 && Math.abs(dy) < 18) return;
    doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <style>{`
        @keyframes g2048-spawn { 0%{transform:scale(0);opacity:0} 100%{transform:scale(1);opacity:1} }
        @keyframes g2048-pop { 0%{transform:scale(1)} 50%{transform:scale(1.18)} 100%{transform:scale(1)} }
        .g2048-tile{transition:transform 120ms cubic-bezier(0.4,0,0.2,1)}
        .g2048-inner{animation-duration:140ms;animation-timing-function:ease}
        .g2048-spawn .g2048-inner{animation-name:g2048-spawn}
        .g2048-merge .g2048-inner{animation-name:g2048-pop}
      `}</style>

      <div className="flex w-full items-center justify-between" style={{ maxWidth: BOARD }}>
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">2048</span>
        <span className="text-sm tabular-nums">
          <span className="text-muted-foreground">рахунок </span>
          <span className="font-semibold">{score}</span>
        </span>
      </div>

      <div
        onPointerDown={onDown}
        onPointerUp={onUp}
        className="relative touch-none select-none rounded-lg border border-border/60 bg-background/40"
        style={{ width: BOARD, height: BOARD }}
      >
        {/* background grid */}
        {Array.from({ length: N * N }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-md bg-muted/30"
            style={{ width: CELL, height: CELL, left: pos(i % N), top: pos(Math.floor(i / N)) }}
          />
        ))}
        {/* tiles */}
        {tiles.map((t) => (
          <div
            key={t.id}
            className={`g2048-tile absolute ${t.spawn ? "g2048-spawn" : ""} ${t.merged ? "g2048-merge" : ""}`}
            style={{ width: CELL, height: CELL, left: 0, top: 0, transform: `translate(${pos(t.c)}px, ${pos(t.r)}px)`, zIndex: t.dead ? 1 : 2 }}
          >
            <div
              className="g2048-inner flex h-full w-full items-center justify-center rounded-md font-semibold tabular-nums"
              style={{ ...tileColor(t.value), fontSize: fontSize(t.value) }}
            >
              {t.value}
            </div>
          </div>
        ))}
        {over && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm">
            <span className="text-sm font-semibold">Гру завершено</span>
            <button onClick={reset} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
              Нова гра
            </button>
          </div>
        )}
      </div>

      <div className="flex w-full items-center justify-between" style={{ maxWidth: BOARD }}>
        <span className="text-[11px] text-muted-foreground">свайп мишкою або ← ↑ → ↓</span>
        <button onClick={reset} className="text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
          скинути
        </button>
      </div>
    </div>
  );
}
