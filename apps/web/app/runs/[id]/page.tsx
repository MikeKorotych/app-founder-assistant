import { RunReport } from "./_components/run-report";

// Thin server shell — the report is fetched + rendered client-side (browser →
// API, CORS-open). OpenNext on Cloudflare Workers can't make the server→API
// worker-to-worker subrequest, so SSR fetching the run 404'd. See app/_lib/api.ts.
export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RunReport id={id} />;
}
