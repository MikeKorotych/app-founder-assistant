# @hahaton/ui

Shared UI design system ported from `funnel-analyzer` (workstream **C1**). Shell-agnostic:
lives in its own package so it drops into whatever `apps/web` shell lands (OpenNext / Next.js)
without colliding with the app scaffold.

## What's inside

- **Design tokens & theme** — `src/styles/globals.css` (Tailwind v4 `@theme` + CSS variables, slate base, light/dark).
- **shadcn primitives** (new-york) — `Button`, `Card`, `Input`, `Label`, `Skeleton`, `Table`, `ImageZoom`.
- **Composite components** — `StatusBadge`/`StatusDot`, `StatusPill`, `ThemeProvider`, `ThemeToggle`,
  `AppBackground` (animated WebGL veil via `ogl`), `EmotionArcChart` (recharts).
- `cn()` utility.

Funnel-specific pieces (app shell `layout`, `screen-lightbox`, `screen-thumb`, Prisma/auth/tRPC/crawler)
were intentionally **not** copied — only the reusable design system.

All internal imports are **relative** (no `@/` alias), so the package is portable across bundlers.

## Consume from `apps/web` (Next.js / OpenNext)

1. Add the dependency (workspace): in `apps/web/package.json` →
   `"@hahaton/ui": "workspace:*"`, then `pnpm install`.
2. Transpile the package — in `next.config`: `transpilePackages: ["@hahaton/ui"]`.
3. Import the styles once (e.g. in `app/layout.tsx` or `pages/_app.tsx`):
   ```ts
   import "@hahaton/ui/styles.css";
   ```
4. Make Tailwind scan the package — in the app's CSS (Tailwind v4):
   ```css
   @source "../../../packages/ui/src/**/*.{ts,tsx}";
   ```
5. Use components:
   ```tsx
   import { Button, Card, ThemeProvider, ThemeToggle, AppBackground } from "@hahaton/ui";
   ```

## Notes

- Peer deps: `react`, `react-dom`, `next` (provided by the host app).
- `ImageZoom` uses `next/dynamic` (SSR-safe) — hence the `next` peer dep.
- No build/typecheck script yet (source-only package compiled by the host bundler); add one once
  `apps/web` exists and deps are installed.
