// @hahaton/ui — shared design system (shadcn + Tailwind v4 + themes).
// Import styles once in the host app: `import "@hahaton/ui/styles.css"`.

export { AppBackground } from "./components/dark-veil-background";
export { EmotionArcChart } from "./components/emotion-arc-chart";
// composite components
export { StatusBadge, StatusDot } from "./components/status-badge";
export { StatusPill } from "./components/status-pill";
export { ThemeProvider } from "./components/theme-provider";
export { ThemeToggle } from "./components/theme-toggle";
// shadcn primitives
export { Button, buttonVariants } from "./components/ui/button";
export {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
export { ImageZoom } from "./components/ui/image-zoom";
export { Input } from "./components/ui/input";
export { Label } from "./components/ui/label";
export { RainbowButton, rainbowButtonVariants } from "./components/ui/rainbow-button";
export { Skeleton } from "./components/ui/skeleton";
export {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";

// utils
export { cn } from "./lib/utils";
