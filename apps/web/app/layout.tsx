import { AppBackground, ThemeProvider } from "@hahaton/ui";
import type { Metadata } from "next";
import { RunProvider } from "./_components/run-context";
import { SiteNav } from "./_components/site-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI CEO — Стратег-засновник",
  description:
    "Одне речення → обґрунтований бізнес-план: ринок, конкуренти, canvas, GTM, юніт-економіка, ризики.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <AppBackground />
          <RunProvider>
            <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
              <SiteNav />
              {children}
            </div>
          </RunProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
