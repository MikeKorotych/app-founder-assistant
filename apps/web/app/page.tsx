import { IdeaForm } from "./_components/idea-form";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Хакатон 2026 · AI-співробітник
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Від ідеї в одне речення — до обґрунтованого бізнес-плану.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Розмір ринку, реальні конкуренти, Business Model Canvas, GTM, жива юніт-економіка, реєстр
          ризиків і пітч — із цитатами. Готово за ~90 секунд.
        </p>
      </header>

      <IdeaForm />
    </main>
  );
}
