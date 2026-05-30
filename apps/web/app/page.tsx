import { IdeaForm } from "./_components/idea-form";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-10">
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
        <IdeaForm />
      </div>
    </main>
  );
}
