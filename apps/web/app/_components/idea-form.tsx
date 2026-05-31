"use client";

import { RainbowButton } from "@hahaton/ui";
import { useRef, useState } from "react";
import { stopBackgroundMusic } from "../_lib/background-music";
import { RunStream } from "./run-stream";
import { ScoutRun } from "./scout-run";
import { useTypedPlaceholder } from "./use-typed-placeholder";

/** Sample ideas for the "Suggest an idea" button — specific & demo-friendly. */
const SAMPLE_IDEAS = [
  "Трекер сну для людей з нічними змінами: адаптує сон, світло і recovery-план під нестабільний графік.",
  "AI-щоденник мігрені: знаходить тригери між сном, погодою, кофеїном, циклом і стресом.",
  "Фінансовий календар для фрилансерів: прогнозує податки, cash gap і безпечний бюджет на тиждень.",
  "AI-тренер англійської через голосові повідомлення: виправляє вимову, граматику і дає живі діалоги.",
  "Мобільний тренажер IT-співбесід: проводить mock interview, дає фідбек і план підготовки на 14 днів.",
  "Трекер витрат для пар: ділить спільні покупки, борги, цілі і прибирає незручні розмови про гроші.",
  "Трекер звичок для ADHD: м'які нагадування, tiny tasks, body doubling і відновлення після пропусків.",
  "AI-коуч харчування для людей з IBS: веде симптоми, FODMAP-тригери і безпечні меню на тиждень.",
  "Мобільний планер терапії: цілі між сесіями, mood check-in, нотатки і питання до наступної зустрічі.",
  "Додаток для догляду за літніми батьками: ліки, візити, тривожні зміни і сімейний журнал.",
  "Pet health journal: вакцини, симптоми, вага, харчування і історія для ветеринара.",
  "AI-тренер публічних виступів: слухає репетицію, ловить filler words і тренує структуру промови.",
  "Додаток для підготовки до переїзду: документи, бюджет, райони, задачі і таймлайн до дати переїзду.",
  "Трекер енергії замість продуктивності: показує, які задачі, їжа і сон реально забирають сили.",
  "AI-гардероб: збирає образи з фото одягу, планує капсулу і радить що докупити.",
  "Сканер домашньої аптечки: терміни придатності, дозування, сімейні профілі і список що докупити.",
  "Додаток безпечних нічних прогулянок: live route, check-in, фейковий дзвінок і швидкий SOS.",
  "Мобільний помічник для skincare routine: сумісність засобів, фото прогресу і попередження про конфлікти.",
  "AI-асистент для читання non-fiction: стискає глави, робить картки і нагадує застосувати ідеї.",
  "Трекер навчання через пісні: витягує слова з улюблених треків і тренує listening.",
  "Додаток для планування побачень: ідеї під бюджет, погоду, район і спільні інтереси.",
  "AI-помічник для купівлі вживаного авто: чеклист огляду, питання продавцю і оцінка ризику.",
  "Трекер тренувань після травми: м'яка прогресія, біль, обмеження і звіт фізіотерапевту.",
  "Мобільний планер подарунків: дати, інтереси, бюджет і персональні ідеї без банальностей.",
  "Додаток для орендарів: платежі, стан квартири, шаблони повідомлень і нагадування по договору.",
  "AI-помічник для подкастерів: знаходить найкращі кліпи, пише captions і планує публікації.",
  "Мобільний трекер підписок: знаходить зайві списання, нагадує скасувати і рахує економію.",
  "Додаток для підготовки до марафону з нуля: план, сон, харчування і контроль перевантаження.",
  "AI-планер сімейного меню: враховує бюджет, алергії, залишки в холодильнику і список покупок.",
  "Додаток для цифрового мінімалізму: м'яко зменшує screen time через правила, ритуали і фокус-блоки.",
];

export function IdeaForm() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [idea, setIdea] = useState("");
  const [error, setError] = useState("");
  const [started, setStarted] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const typedPlaceholder = useTypedPlaceholder(idea.trim().length === 0);

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
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("demo") === "1";
    setDemo(forceDemo);
    setStarted(value);
  }

  function restartRun() {
    stopBackgroundMusic();
    setRestarting(true);
    window.setTimeout(() => {
      setIdea("");
      setError("");
      setDemo(false);
      setStarted(null);
      setRestarting(false);
      requestAnimationFrame(() => fitTextareaHeight());
    }, 160);
  }

  // Real flow: idea → search-intent → Scout (competitor discovery) → Validate.
  // ?demo=1 keeps the scripted RunStream as a presentation safety net.
  if (started) {
    return (
      <div className={restarting ? "animate-exit" : "animate-enter"}>
        {demo ? (
          <RunStream idea={started} demo={demo} onRestart={restartRun} />
        ) : (
          <ScoutRun idea={started} onRestart={restartRun} />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col items-center space-y-3 text-center">
        <p className="animate-enter text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Хакатон 2026 · AI-співробітник
        </p>
        <h1 className="animate-enter animate-enter-delay-1 text-3xl font-semibold tracking-tight sm:text-4xl">
          Від ідеї в одне речення — до обґрунтованого бізнес-плану.
        </h1>
        <p className="animate-enter animate-enter-delay-2 mx-auto max-w-2xl text-muted-foreground">
          Розмір ринку, реальні конкуренти, Business Model Canvas, GTM, жива юніт-економіка, реєстр
          ризиків і пітч — із цитатами. Готово за ~90 секунд.
        </p>
      </header>
      <div className="animate-enter animate-enter-delay-3 mx-auto w-full max-w-3xl">
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
              onKeyDown={(e) => {
                // Enter starts the run; Shift+Enter keeps a manual line break.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  e.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder={typedPlaceholder || "Напр. AI-тренер англійської через голосові"}
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
            <RainbowButton
              type="submit"
              size="lg"
              className="[--rainbow-button-foreground:#0a0a0b] [--rainbow-button-surface:#f7f7f2] hover:shadow-white/20"
            >
              Згенерувати план
            </RainbowButton>
          </div>
        </form>
      </div>
    </div>
  );
}
