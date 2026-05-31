"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRun } from "./run-context";

/**
 * Shows a small "run in progress / ready" pill in the nav when a run is active
 * but the user is NOT on the home page — proof the run kept living across
 * navigation, and a one-click way back to it.
 */
export function RunIndicator() {
  const { idea, phase, validation, opportunity, globalRadar } = useRun();
  const pathname = usePathname();
  if (idea === null || pathname === "/") return null;

  const settled =
    phase.kind === "done" &&
    validation.kind !== "running" &&
    opportunity.kind !== "running" &&
    globalRadar.kind !== "running";
  const failed = phase.kind === "error";

  const label = failed ? "Прогін завершено" : settled ? "Аналіз готовий" : "Прогін триває";
  const live = !settled && !failed;

  return (
    <Link
      href="/"
      title={idea}
      className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-background/35 px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${live ? "animate-pulse bg-success" : "bg-foreground/60"}`}
      />
      {label}
    </Link>
  );
}
