"use client";

import { useCallback, useEffect, useState } from "react";

// Minimal, self-contained 2048 — something to play while the agent works.
const N = 4;
type Board = number[][];
type Dir = "left" | "right" | "up" | "down";

const emptyBoard = (): Board => Array.from({ length: N }, () => Array(N).fill(0));

function addTile(b: Board): Board {
  const cells: [number, number][] = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!b[r][c]) cells.push([r, c]);
  if (cells.length === 0) return b;
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  const nb = b.map((row) => row.slice());
  nb[r][c] = Math.random() < 0.9 ? 2 : 4;
  return nb;
}

function compress(row: number[]): { row: number[]; gained: number } {
  const f = row.filter((x) => x);
  const out: number[] = [];
  let gained = 0;
  for (let i = 0; i < f.length; i++) {
    if (f[i] === f[i + 1]) {
      out.push(f[i] * 2);
      gained += f[i] * 2;
      i++;
    } else out.push(f[i]);
  }
  while (out.length < N) out.push(0);
  return { row: out, gained };
}

const rev = (r: number[]) => r.slice().reverse();
const transpose = (b: Board): Board => b[0].map((_, c) => b.map((row) => row[c]));

function move(b: Board, dir: Dir): { board: Board; gained: number; changed: boolean } {
  let g = 0;
  let work: Board;
  if (dir === "left") work = b.map((r) => { const x = compress(r); g += x.gained; return x.row; });
  else if (dir === "right") work = b.map((r) => { const x = compress(rev(r)); g += x.gained; return rev(x.row); });
  else if (dir === "up") work = transpose(transpose(b).map((r) => { const x = compress(r); g += x.gained; return x.row; }));
  else work = transpose(transpose(b).map((r) => { const x = compress(rev(r)); g += x.gained; return rev(x.row); }));
  return { board: work, gained: g, changed: JSON.stringify(work) !== JSON.stringify(b) };
}

const hasMoves = (b: Board) => (["left", "right", "up", "down"] as Dir[]).some((d) => move(b, d).changed);

function tileStyle(v: number): React.CSSProperties {
  if (!v) return { background: "var(--bg-soft, rgba(255,255,255,0.03))" };
  const op = Math.min(0.12 + Math.log2(v) / 12, 0.95);
  return { background: `rgba(230,231,233,${op})`, color: op > 0.5 ? "#0a0a0b" : "var(--foreground)" };
}

export function Game2048() {
  const [board, setBoard] = useState<Board>(() => addTile(addTile(emptyBoard())));
  const [score, setScore] = useState(0);
  const [over, setOver] = useState(false);

  const reset = useCallback(() => {
    setBoard(addTile(addTile(emptyBoard())));
    setScore(0);
    setOver(false);
  }, []);

  const doMove = useCallback((dir: Dir) => {
    setBoard((prev) => {
      if (over) return prev;
      const { board: nb, gained, changed } = move(prev, dir);
      if (!changed) return prev;
      const withTile = addTile(nb);
      if (gained) setScore((s) => s + gained);
      if (!hasMoves(withTile)) setOver(true);
      return withTile;
    });
  }, [over]);

  useEffect(() => {
    const map: Record<string, Dir> = {
      ArrowLeft: "left", ArrowRight: "right", ArrowUp: "up", ArrowDown: "down",
      a: "left", d: "right", w: "up", s: "down",
    };
    const h = (e: KeyboardEvent) => {
      const dir = map[e.key];
      if (dir) { e.preventDefault(); doMove(dir); }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [doMove]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          2048 · поки агент працює
        </span>
        <span className="text-sm tabular-nums">
          <span className="text-muted-foreground">рахунок </span>
          <span className="font-semibold">{score}</span>
        </span>
      </div>

      <div className="relative">
        <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/60 bg-background/40 p-2">
          {board.flatMap((row, r) =>
            row.map((v, c) => (
              <div
                key={`${r}-${c}`}
                style={tileStyle(v)}
                className="flex aspect-square items-center justify-center rounded-md text-lg font-semibold tabular-nums transition-colors"
              >
                {v || ""}
              </div>
            )),
          )}
        </div>
        {over && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-sm">
            <span className="text-sm font-semibold">Гру завершено</span>
            <button onClick={reset} className="rounded-md border border-border px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
              Нова гра
            </button>
          </div>
        )}
      </div>

      {/* On-screen controls (also works with arrows / WASD) */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-3 gap-1">
          <span />
          <ArrowBtn onClick={() => doMove("up")}>↑</ArrowBtn>
          <span />
          <ArrowBtn onClick={() => doMove("left")}>←</ArrowBtn>
          <ArrowBtn onClick={() => doMove("down")}>↓</ArrowBtn>
          <ArrowBtn onClick={() => doMove("right")}>→</ArrowBtn>
        </div>
        <button onClick={reset} className="self-end text-xs text-muted-foreground underline decoration-dotted underline-offset-2 hover:text-foreground">
          скинути
        </button>
      </div>
    </div>
  );
}

function ArrowBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-md border border-border/60 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
