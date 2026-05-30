"use client";

import { Button, Card, CardContent } from "@hahaton/ui";
import { useRef, useState } from "react";
import { RunStream } from "./run-stream";

/** Sample ideas for the "Suggest an idea" button — specific & demo-friendly. */
const SAMPLE_IDEAS = [
  "AI-асистент для власників собак у Польщі: підбирає свіжий раціон, доставку і нагадує про ветеринарні чекапи.",
  "Copilot для indie iOS-фаундерів: знаходить ASO-ніші, генерує сторінку App Store і відстежує конкурентів у Slack.",
  "Додаток сну для медиків і нічних змін: адаптує короткі recovery-сесії під хаотичний графік.",
  "Фінансовий автопілот для фрилансерів: відкладає податки, прогнозує касовий розрив і радить ціну проєкту.",
  "B2B-сервіс, що перетворює сапорт-тикети, відгуки й дзвінки продажів на пріоритезований roadmap.",
  "Мовний тренажер через улюблену музику: робить уроки, словник і spaced repetition із твоїх плейлистів.",
  "Маркетплейс same-day випічки: з'єднує кав'ярні з локальними пекарнями за прогнозом попиту.",
  "AI-репетитор для студентів: перетворює лекції на картки, тести і план підготовки до іспиту.",
  "Платформа для creator-брендів: знаходить мікроінфлюенсерів, рахує CAC і прогнозує окупність кампаній.",
  "Асистент для маленьких клінік: автоматично нагадує пацієнтам про візити, збирає відгуки і заповнює CRM.",
  "Додаток для економії електроенергії в квартирах: аналізує рахунки, погоду і радить дешеві зміни поведінки.",
  "AI-консьєрж для туристів у маленьких містах: збирає маршрут, бронювання і локальні події без туристичних пасток.",
  "Операційний copilot для ресторанів: прогнозує закупки, списання і staffing на основі бронювань та погоди.",
  "Підписка на healthy lunch для офісів без кухні: персоналізовані бокси, корпоративна оплата і аналітика харчування.",
  "Сервіс для батьків школярів: знаходить гуртки поруч, порівнює ціни/відгуки і складає розклад без конфліктів.",
  "AI-аудитор підписок: знаходить зайві SaaS-витрати в малому бізнесі і веде переговори про знижки.",
  "Платформа для локальних майстрів ремонту: автоматично оцінює заявку з фото, дає ціну і бронює слот.",
  "Додаток для pet insurance в CEE: пояснює поліси простою мовою і підбирає покриття під породу та вік.",
  "Інструмент для HR у стартапах: помічає ризик вигорання за pulse-surveys і пропонує конкретні менеджерські дії.",
  "AI-аналітик для Shopify-магазинів: знаходить, які товари варто bundle-ити, і запускає A/B тести оферів.",
  "Сервіс для орендодавців: перевіряє кандидатів, веде оплату, нагадує про ремонти і прогнозує vacancy risk.",
  "B2B-платформа для carbon reporting малого бізнесу: збирає рахунки, рахує footprint і готує звіт для клієнтів.",
  "Додаток для побутових звичок літніх людей: ненав'язливо помічає відхилення і сповіщає родину.",
  "AI-помічник для подкастерів: знаходить найкращі кліпи, пише captions і планує дистрибуцію по каналах.",
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
              placeholder="Напр. AI-радар, що знаходить нішеві mobile app ідеї з App Store сигналів і перетворює найкращі в бізнес-план"
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
