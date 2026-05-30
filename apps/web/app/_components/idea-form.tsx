"use client";

import { Button, Card, CardContent } from "@hahaton/ui";
import { useRef, useState } from "react";
import { RunStream } from "./run-stream";

/** Sample ideas for the "Suggest an idea" button — specific & demo-friendly. */
const SAMPLE_IDEAS = [
  "Підписка на доставку ветеринарно-сформульованого свіжого корму для собак у Польщі.",
  "AI-копілот для indie iOS-фаундерів, що генерує ключі та креативи для App Store з опису продукту.",
  "Застосунок медитацій для працівників нічних змін, що адаптує сесії до нерегулярного сну.",
  "Застосунок бюджетування для фрилансерів, що автоматично відкладає податки з кожного інвойсу.",
  "B2B-інструмент, що перетворює тикети підтримки на пріоритезований продуктовий беклог.",
  "Застосунок вивчення мови лише через тексти пісень, які тобі подобаються.",
  "Маркетплейс, що з'єднує малі кав'ярні з локальними пекарнями для поставок випічки того ж дня.",
  "AI-помічник для навчання, що перетворює записи лекцій на флешкартки з інтервальним повторенням.",
];

export function IdeaForm() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [idea, setIdea] = useState("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  function fitTextareaHeight(node = textareaRef.current) {
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }

  function suggestIdea() {
    const pool = SAMPLE_IDEAS.filter((s) => s !== idea.trim());
    setIdea(pool[Math.floor(Math.random() * pool.length)] ?? SAMPLE_IDEAS[0]);
    setError("");
    requestAnimationFrame(() => fitTextareaHeight());
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = idea.trim();
    if (value.length === 0) {
      setError("Опишіть свою ідею одним реченням.");
      return;
    }
    // ?demo=1 forces the mocked flow (presentation safety); otherwise the real
    // run is attempted and falls back to the mock automatically on any failure.
    const forceDemo =
      typeof window !== "undefined" && new URLSearchParams(window.location.search).get("demo") === "1";
    setDemo(forceDemo);
    setStarted(value);
  }

  if (started) return <RunStream idea={started} demo={demo} />;

  return (
    <Card className="border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <CardContent className="pt-6">
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <div className="relative">
            <textarea
              ref={textareaRef}
              id="idea"
              value={idea}
              onChange={(e) => {
                setIdea(e.target.value);
                fitTextareaHeight(e.target);
              }}
              placeholder="Ваша ідея одним реченням — напр. AI-помічник, що перетворює лекції на флешкартки"
              rows={1}
              className="min-h-12 w-full resize-none overflow-hidden rounded-md border border-input bg-background px-3 py-3 pr-12 text-sm leading-6 shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              required
            />
            {idea.trim().length === 0 && (
              <button
                type="button"
                onClick={suggestIdea}
                aria-label="Запропонувати ідею"
                className="absolute right-2 top-1.5 inline-flex h-9 w-9 items-center justify-center rounded-md text-base text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                ✨
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="flex flex-col items-center gap-2">
            <Button type="submit">Згенерувати план</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
