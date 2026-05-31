"use client";

import type { DigestApp, GlobalDigest } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@hahaton/ui";
import { useEffect, useState } from "react";
import { ScoutLoading } from "../_components/scout-loading";
import { apiUrl } from "../_lib/api";

function flag(cc: string): string {
  if (cc.length !== 2) return cc.toUpperCase();
  const base = 0x1f1e6;
  return String.fromCodePoint(...[...cc.toUpperCase()].map((ch) => base + ch.charCodeAt(0) - 65));
}

function compact(n?: number): string {
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return `${n}`;
}

function ageLabel(months?: number): string {
  if (!months) return "—";
  return months < 12 ? `${Math.round(months)} міс` : `${(months / 12).toFixed(1)} р`;
}

function scoreTone(s?: number): string {
  if (s == null) return "border-border/60 bg-muted/50 text-muted-foreground";
  if (s >= 66) return "border-success/40 bg-success/10 text-success";
  if (s >= 40) return "border-primary/40 bg-primary/10 text-foreground";
  return "border-border/60 bg-muted/50 text-muted-foreground";
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/60 bg-muted/30 px-2.5 py-1.5">
      <p className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium tabular-nums">{value}</p>
    </div>
  );
}

function RiserRow({ a }: { a: DigestApp }) {
  const [open, setOpen] = useState(false);
  const expandable = Boolean(a.screenshots?.length || a.description || a.reviewCount);
  return (
    <div className="border-t border-border/60 py-3 first:border-t-0">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className="flex w-full items-center gap-3 text-left"
      >
        {a.iconUrl ? (
          // biome-ignore lint/performance/noImgElement: external App Store CDN image
          <img
            src={a.iconUrl}
            alt=""
            loading="lazy"
            className="h-11 w-11 shrink-0 rounded-xl border border-border/60 object-cover"
          />
        ) : (
          <div className="h-11 w-11 shrink-0 rounded-xl border border-border/60 bg-muted/40" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{a.name}</span>
            {a.score != null && (
              <span
                title="Momentum score (евристика: швидкість відгуків × рейтинг × охоплення × свіжість)"
                className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium tabular-nums ${scoreTone(a.score)}`}
              >
                {a.score}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>
              {a.marketCount} ринків · #{a.bestRank}
            </span>
            {a.reviewCount ? <span>{compact(a.reviewCount)} відгуків</span> : null}
            {a.ageMonths ? <span>{ageLabel(a.ageMonths)}</span> : null}
            {a.rating ? <span>★ {a.rating.toFixed(1)}</span> : null}
          </div>
        </div>
        {expandable && (
          <span
            className={`shrink-0 select-none text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          >
            ⌄
          </span>
        )}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3 sm:pl-14">
          {a.screenshots?.length ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {a.screenshots.slice(0, 8).map((s) => (
                // biome-ignore lint/performance/noImgElement: external App Store CDN image
                <img
                  key={s}
                  src={s}
                  alt=""
                  loading="lazy"
                  className="h-44 shrink-0 rounded-lg border border-border/60 object-cover"
                />
              ))}
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Metric label="Існує" value={ageLabel(a.ageMonths)} />
            <Metric label="Завантаж. (оцінка)" value={compact(a.estInstalls)} />
            <Metric label="Завант./міс (оцінка)" value={compact(a.estInstallsPerMonth)} />
            <Metric label="Відгуків/міс" value={compact(a.reviewsPerMonth)} />
          </div>
          {a.description && (
            <p className="whitespace-pre-line text-xs leading-relaxed text-muted-foreground">
              {a.description.length > 600 ? `${a.description.slice(0, 600)}…` : a.description}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {a.markets.slice(0, 14).map((m) => (
              <span
                key={m.country}
                title={m.country.toUpperCase()}
                className="rounded border border-border/60 bg-background/40 px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground"
              >
                {flag(m.country)} #{m.rank}
              </span>
            ))}
          </div>
          {a.url && (
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Відкрити в App Store →
            </a>
          )}
        </div>
      )}
      {a.note && !open && <p className="mt-2 text-sm text-muted-foreground sm:pl-14">{a.note}</p>}
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
        {state === "empty" && (
          <Button
            className="animate-enter animate-enter-delay-3"
            onClick={generate}
            variant="outline"
          >
            Згенерувати зараз
          </Button>
        )}
      </header>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {state === "loading" && (
        <div className="flex justify-center py-8">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-muted-foreground/25 border-t-foreground" />
        </div>
      )}

      {state === "empty" && !error && (
        <p className="text-sm text-muted-foreground">
          Дайджест ще не згенеровано. Натисни «Згенерувати зараз».
        </p>
      )}

      {state === "running" && (
        <ScoutLoading
          title="Скануємо світові чарти…"
          hint="Це займе ~30 секунд."
          steps={[
            "Тягнемо «нові» чарти App Store по ~24 країнах.",
            "Групуємо застосунки за крос-ринковим моментумом.",
            "Підтягуємо метадані з App Store (іконки, відгуки, дата релізу).",
            "Рахуємо вік, швидкість відгуків та momentum-score.",
            "Збираємо дайджест світових новачків.",
          ]}
        />
      )}

      {digest && state === "ready" && (
        <Card className="animate-enter border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader className="gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Глобальні новачки на підйомі</CardTitle>
              <span className="rounded-full border border-border/60 bg-muted/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {digest.countriesScanned.length} ринків
              </span>
              <button
                type="button"
                onClick={generate}
                title="Згенерувати знову"
                className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                ↻ Оновити
              </button>
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
