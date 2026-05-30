import { SearchForm } from "./_components/search-form";

export default function SearchPage() {
  return (
    <main className="flex flex-1 flex-col gap-10">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Hackathon 2026 · Search intent
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Turn a search query into keywords &amp; categories.
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          One query in → a comprehensive, noise-free set of search terms and categories out (via
          Claude Sonnet 4.5). Saved and ready for the source fan-out.
        </p>
      </header>

      <SearchForm />
    </main>
  );
}
