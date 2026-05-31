"use client";

import type { DigestApp, GlobalDigest } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import { useEffect, useState } from "react";
import { apiUrl } from "../_lib/api";

function flag(cc: string): string {
  if (cc.length !== 2) return cc.toUpperCase();
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => base + ch.charCodeAt(0) - 65));
}

function RiserRow({ a }: { a: DigestApp }) {
  return (
    <div className="flex flex-col gap-1.5 border-t border-border/60 py-3 first:border-t-0">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          {a.url ? (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium underline-offset-2 hover:underline"
            >
              {a.name}
            </a>
          ) : (
            <span className="font-medium">{a.name}</span>
          )}
          <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] tabular-nums">
            {a.marketCount} ринків · #{a.bestRank}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {a.markets.slice(0, 10).map((m) => (
          <span
            key={m.country}
            className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
            title={`${m.country.toUpperCase()} · #${m.rank}`}
          >
            {flag(m.country)} #{m.rank}
          </span>
        ))}
      </div>
      {a.note && <p className="text-sm text-muted-foreground">{a.note}</p>}
    </div>
  );
}

export default function DigestPage() {
  const [digest, setDigest] = useState<GlobalDigest | null>(null);
  const [state, setState] = useState<"loading" | "empty" | "ready" | "running">("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(apiUrl("/digest/latest"), { cache: "no-store" });
        if (res.status === 404) {
          setState("empty");
          return;
        }
        if (!res.ok) throw new Error(`digest failed (${res.status})`);
        setDigest((await res.json()) as GlobalDigest);
        setState("ready");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setState("empty");
      }
    })();
  }, []);

  async function generate() {
    setState("running");
    setError("");
    try {
      const res = await fetch(apiUrl("/digest/run"), { method: "POST" });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `generation failed (${res.status})`);
      }
      setDigest((await res.json()) as GlobalDigest);
      setState("ready");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setState("empty");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 py-10">
      <header className="flex animate-enter flex-col items-center gap-4 text-center">
        <div className="space-y-2">
          <p className="animate-enter text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Світовий дайджест
          </p>
          <h1 className="animate-enter animate-enter-delay-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Що злітає у світі
          </h1>
          <p className="animate-enter animate-enter-delay-2 mx-auto max-w-xl text-sm text-muted-foreground">
            Нові застосунки з моментумом одразу в кількох країнах (App Store «нові» чарти).
            Оновлюється за розкладом; можна згенерувати вручну.
          </p>
        </div>
        <Button
          className="animate-enter animate-enter-delay-3"
          onClick={generate}
          disabled={state === "running"}
          variant="outline"
        >
          {state === "running" ? "Генеруємо…" : "Згенерувати зараз"}
        </Button>
      </header>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {state === "loading" && <p className="text-sm text-muted-foreground">Завантаження…</p>}

      {state === "empty" && !error && (
        <p className="text-sm text-muted-foreground">
          Дайджест ще не згенеровано. Натисни «Згенерувати зараз».
        </p>
      )}

      {state === "running" && (
        <p className="text-sm text-muted-foreground">
          Скануємо світові чарти по країнах — це займе ~30 секунд…
        </p>
      )}

      {digest && state === "ready" && (
        <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader className="gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Глобальні новачки на підйомі</CardTitle>
              <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {digest.countriesScanned.length} ринків
              </span>
            </div>
            {digest.summary && <p className="text-sm text-muted-foreground">{digest.summary}</p>}
            <p className="text-xs text-muted-foreground/70">
              Оновлено: {new Date(digest.createdAt).toLocaleString("uk-UA")}
            </p>
          </CardHeader>
          <CardContent>
            {digest.globalRisers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Поки що нема яскравих новачків.</p>
            ) : (
              digest.globalRisers.map((a) => <RiserRow key={a.appId} a={a} />)
            )}
          </CardContent>
        </Card>
      )}
    </main>
  );
}
