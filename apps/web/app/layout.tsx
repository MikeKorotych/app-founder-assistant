import type { Metadata } from "next";
import { AppBackground, ThemeProvider } from "@hahaton/ui";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI CEO — Founder Strategist",
  description: "One sentence → grounded business plan: market, competitors, canvas, GTM, unit economics, risks.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppBackground />
          <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
