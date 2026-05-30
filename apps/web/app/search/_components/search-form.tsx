"use client";

import type { SearchExpansion } from "@hahaton/contracts";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from "@hahaton/ui";
import { useState } from "react";
import { apiUrl } from "../../_lib/api";

type Status =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "error"; message: string }
  | { kind: "success"; expansion: SearchExpansion };

function Chips({ items, tone }: { items: string[]; tone: "keyword" | "category" }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">None.</p>;
  }
  const cls =
    tone === "category"
      ? "border-primary/40 bg-primary/10 text-foreground"
      : "border-border/60 bg-muted/60 text-muted-foreground";
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span key={item} className={`rounded-full border px-3 py-1 text-sm ${cls}`}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function SearchForm() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: "error", message: "Enter a search query." });
      return;
    }

    setStatus({ kind: "submitting" });
    try {
      const res = await fetch(apiUrl("/search-intent"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: trimmed }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error ?? `Request failed (${res.status})`);
      }
      const expansion = (await res.json()) as SearchExpansion;
      setStatus({ kind: "success", expansion });
    } catch (err) {
      setStatus({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  const submitting = status.kind === "submitting";

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <CardHeader>
          <CardTitle>Search query</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="query">What are you looking for?</Label>
              <Input
                id="query"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="e.g. habit tracker app for ADHD"
                disabled={submitting}
                required
              />
            </div>

            {status.kind === "error" && (
              <p className="text-sm text-destructive" role="alert">
                {status.message}
              </p>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Expanding…" : "Expand query"}
              </Button>
              {submitting && (
                <p className="text-sm text-muted-foreground">
                  Sonnet 4.5 is deriving keywords &amp; categories…
                </p>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {status.kind === "success" && (
        <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <CardHeader>
            <CardTitle>What we&apos;ll query</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Categories · {status.expansion.categories.length}
              </p>
              <Chips items={status.expansion.categories} tone="category" />
            </div>
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Keywords · {status.expansion.keywords.length}
              </p>
              <Chips items={status.expansion.keywords} tone="keyword" />
            </div>
            <p className="text-xs text-muted-foreground">
              Saved as <code className="font-mono">{status.expansion.id}</code> — downstream search
              services fan out from this.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
