import { ThemeToggle } from "@hahaton/ui";
import Link from "next/link";
import { RunIndicator } from "./run-indicator";

/** Minimal top navigation — brand + the two reachable surfaces + theme toggle. */
export function SiteNav() {
  return (
    <nav className="mb-10 flex items-center justify-between gap-4">
      <Link href="/" className="text-sm font-semibold tracking-tight text-foreground">
        AI CEO <span className="font-normal text-muted-foreground">· Стратег-засновник</span>
      </Link>
      <div className="flex items-center gap-1 text-sm sm:gap-2">
        <RunIndicator />
        <Link
          href="/"
          className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          Головна
        </Link>
        <Link
          href="/digest"
          className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          🌍 Дайджест
        </Link>
        <ThemeToggle />
      </div>
    </nav>
  );
}
