"use client";

import { useEffect, useMemo, useState } from "react";

interface ScoutLoadingProps {
  title: string;
  hint?: string;
  steps?: string[];
}

const SEARCH_STEPS = [
  "Нормалізуємо формулювання ідеї.",
  "Витягуємо intent та user job.",
  "Будуємо seed keywords.",
  "Групуємо категорії для пошуку.",
  "Перевіряємо, чи запити не надто широкі.",
];

const SCOUT_STEPS = [
  "Готуємо query-пакет для стора.",
  "Скануємо iTunes Search API.",
  "Зіставляємо Android-сигнали з Google Play.",
  "Перевіряємо Product Hunt та AlternativeTo.",
  "Прибираємо дублікати конкурентів.",
  "Ранжуємо результати за сумісністю.",
];

const VALIDATION_STEPS = [
  "Передаємо конкурентів у Multi-LLM панель.",
  "Скептик шукає слабкі місця.",
  "Адвокат оцінює upside.",
  "Аналітик звіряє бізнес-модель.",
  "Збираємо консенсус-оцінку.",
];

function fallbackSteps(title: string, hint?: string): string[] {
  const normalized = title.toLowerCase();
  if (normalized.includes("scout")) return SCOUT_STEPS;
  if (normalized.includes("валід")) return VALIDATION_STEPS;
  if (hint) return [hint, ...SEARCH_STEPS.slice(1)];
  return SEARCH_STEPS;
}

export function ScoutLoading({ title, hint, steps }: ScoutLoadingProps) {
  const sequence = useMemo(() => {
    const explicit = steps?.filter(Boolean);
    return explicit && explicit.length > 0 ? explicit : fallbackSteps(title, hint);
  }, [hint, steps, title]);
  const [index, setIndex] = useState(0);
  const current = sequence[index % sequence.length] ?? hint ?? title;
  const stepPosition =
    sequence.length <= 1 ? 0.72 : (index % sequence.length) / (sequence.length - 1);
  const activityPct = Math.round(18 + stepPosition * 74);

  useEffect(() => {
    setIndex(0);
  }, []);

  useEffect(() => {
    if (sequence.length <= 1) return;
    const timer = window.setInterval(() => {
      setIndex((value) => value + 1);
    }, 1650);
    return () => window.clearInterval(timer);
  }, [sequence.length]);

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-border/60 bg-neutral-950 text-white shadow-[0_18px_60px_rgba(0,0,0,0.22)]"
      style={{
        background:
          "radial-gradient(120% 160% at 12% 0%, rgba(255,255,255,0.14), transparent 42%), linear-gradient(135deg, #171717 0%, #0d0d0e 52%, #050506 100%)",
      }}
    >
      <style>{`
        @keyframes scout-scan {
          0% { transform: translateX(-45%); opacity: 0; }
          12% { opacity: 0.7; }
          50% { opacity: 0.35; }
          100% { transform: translateX(145%); opacity: 0; }
        }
        @keyframes scout-dash {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(220%); }
        }
        @keyframes scout-caret {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }
        .scout-scan-line { animation: scout-scan 4.8s ease-in-out infinite; }
        .scout-dash-line { animation: scout-dash 1.8s ease-in-out infinite; }
        .scout-caret { animation: scout-caret 1s steps(2, end) infinite; }
      `}</style>

      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="scout-scan-line absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent blur-xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.16) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
      </div>

      <div className="relative flex flex-col gap-5 px-6 py-7 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/45">
              Live progress
            </p>
            <p className="text-base font-medium tracking-wide text-white/92 sm:text-lg">{title}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/55">
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            Running
          </div>
        </div>

        <div className="overflow-hidden rounded-md border border-white/10 bg-black/30">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] text-white/45">
            <span className="h-2 w-2 rounded-full bg-white/35" />
            scout.pipeline
          </div>
          <div className="flex min-h-16 flex-col justify-center gap-2 px-3 py-3">
            <p key={current} className="animate-enter text-sm text-white/82">
              {current}
              <span className="scout-caret ml-1 inline-block">_</span>
            </p>
            {hint && <p className="text-xs text-white/38">{hint}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/80 transition-[width] duration-700 ease-out"
              style={{ width: `${activityPct}%` }}
            />
            <div className="scout-dash-line absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/55 to-transparent" />
          </div>
          <span className="w-12 text-right text-xs tabular-nums text-white/45">{activityPct}%</span>
        </div>
      </div>
    </div>
  );
}
