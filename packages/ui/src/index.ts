// @hahaton/ui — shared design system (shadcn + Tailwind v4 + themes).
// Import styles once in the host app: `import "@hahaton/ui/styles.css"`.

// shadcn primitives
export { Button, buttonVariants } from "./components/ui/button";
export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from "./components/ui/card";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export { Skeleton } from "./components/ui/skeleton";
export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "./components/ui/table";
export { ImageZoom } from "./components/ui/image-zoom";

// composite components
export { StatusBadge, StatusDot } from "./components/status-badge";
export { StatusPill } from "./components/status-pill";
export { ThemeProvider } from "./components/theme-provider";
export { ThemeToggle } from "./components/theme-toggle";
export { AppBackground } from "./components/dark-veil-background";
export { EmotionArcChart } from "./components/emotion-arc-chart";

// utils
export { cn } from "./lib/utils";
