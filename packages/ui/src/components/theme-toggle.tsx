import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import * as React from "react";
import { Button } from "./ui/button";

// next-themes hydration pattern: mount flag flips true after the first
// client render so we don't render the wrong icon during SSR. Using a lazy
// initializer with `typeof window` keeps the effect body empty.
function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );
}

// Loose feature-detection shape — we cast Document to this via `unknown` so
// we don't accidentally merge with the native `Document.startViewTransition`
// type (which is declared as required in newer lib.dom.d.ts and would make
// the runtime check look unnecessary to ESLint).
interface DocWithVT {
  startViewTransition?: (cb: () => void) => unknown;
}

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  if (!mounted) {
    return <Button variant="ghost" size="icon" aria-label="Toggle theme" disabled />;
  }

  const next = resolvedTheme === "dark" ? "light" : "dark";

  function onClick() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      document.documentElement.style.setProperty("--tt-x", `${String(x)}px`);
      document.documentElement.style.setProperty("--tt-y", `${String(y)}px`);
    }

    const doc = document as unknown as DocWithVT;
    if (!doc.startViewTransition) {
      setTheme(next);
      return;
    }

    doc.startViewTransition(() => {
      setTheme(next);
    });
  }

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      aria-label={`Switch to ${next} theme`}
      onClick={onClick}
      className="transition-transform hover:scale-110"
    >
      {resolvedTheme === "dark" ? <Sun /> : <Moon />}
    </Button>
  );
}
