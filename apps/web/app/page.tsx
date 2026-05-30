import { IdeaForm } from "./_components/idea-form";

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col gap-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Hackathon 2026 · AI employee
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          From a one-sentence idea to a grounded business plan.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Market sizing, real competitors, a Business Model Canvas, GTM, live unit economics,
          a risk register and a pitch — with citations. Built in ~90 seconds.
        </p>
      </header>

      <IdeaForm />
    </main>
  );
}
