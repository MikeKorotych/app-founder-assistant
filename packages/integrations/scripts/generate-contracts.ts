/**
 * Generates TypeScript type contracts for every external API in src/sources.ts.
 *
 *   pnpm generate:contracts            # all sources
 *   pnpm generate:contracts -- reddit  # only matching ids/labels
 *
 * (From the repo root: `pnpm --filter @hahaton/integrations generate:contracts`.)
 *
 * Output: src/generated/<id>.d.ts  (+ generated/index.ts barrel).
 *
 * Spec sources:
 *   url         fetched (with env-derived auth headers) → parsed → typed
 *   local       read from ./specs/<file>
 *   unavailable skipped with the documented reason
 */
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";
import { SOURCES, type ApiSource, type SpecSource } from "../src/sources.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const SPECS_DIR = join(ROOT, "specs");
const OUT_DIR = join(ROOT, "src", "generated");

/** Replace `${VAR}` occurrences with process.env values; throws if missing. */
function interpolateEnv(input: string): string {
  return input.replace(/\$\{(\w+)\}/g, (_, name: string) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing env var ${name} (referenced in spec source)`);
    return value;
  });
}

/**
 * Build request headers from a `headersFromEnv` map.
 * Value forms: "ENV_NAME" → env value; "Prefix:ENV_NAME" → "Prefix " + env value.
 */
function buildHeaders(map: Record<string, string>): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [header, spec] of Object.entries(map)) {
    const [maybePrefix, maybeName] = spec.split(":");
    const envName = maybeName ?? maybePrefix;
    const prefix = maybeName ? `${maybePrefix} ` : "";
    const value = process.env[envName];
    if (!value) throw new Error(`Missing env var ${envName} (header "${header}")`);
    headers[header] = `${prefix}${value}`;
  }
  return headers;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

type Resolution =
  | { status: "ready"; redactedSource: string; load: () => Promise<unknown> }
  | { status: "skip"; reason: string };

async function resolveSource(spec: SpecSource): Promise<Resolution> {
  switch (spec.kind) {
    case "unavailable":
      return { status: "skip", reason: spec.note };

    case "local": {
      const path = join(SPECS_DIR, spec.path);
      if (!(await exists(path))) {
        return { status: "skip", reason: `local spec not found: specs/${spec.path}` };
      }
      // openapi-typescript reads JSON & YAML from a file URL directly.
      return {
        status: "ready",
        redactedSource: `specs/${spec.path}`,
        load: async () => new URL(pathToFileURL(path)),
      };
    }

    case "url": {
      let url: string;
      let headers: Record<string, string> = {};
      try {
        url = interpolateEnv(spec.url);
        headers = spec.headersFromEnv ? buildHeaders(spec.headersFromEnv) : {};
      } catch (err) {
        return { status: "skip", reason: (err as Error).message };
      }
      return {
        status: "ready",
        redactedSource: spec.url, // keep the un-interpolated form out of logs
        load: async () => {
          const res = await fetch(url, { headers });
          if (!res.ok) throw new Error(`fetch ${res.status} ${res.statusText}`);
          const text = await res.text();
          // Supabase et al. return JSON; fall back to handing the raw text to
          // openapi-typescript (it parses YAML too) if JSON.parse fails.
          try {
            return JSON.parse(text);
          } catch {
            return text;
          }
        },
      };
    }
  }
}

async function generateOne(source: ApiSource): Promise<"generated" | "skipped"> {
  const resolution = await resolveSource(source.spec);
  if (resolution.status === "skip") {
    console.warn(`  ⊘ ${source.label.padEnd(20)} skipped — ${resolution.reason}`);
    return "skipped";
  }

  const input = await resolution.load();
  const ast = await openapiTS(input as never, {
    alphabetize: true,
    exportType: true,
  });
  const body = astToString(ast);

  const banner =
    `/**\n` +
    ` * AUTO-GENERATED — do not edit by hand.\n` +
    ` * Source: ${source.label} (auth: ${source.auth})\n` +
    ` * Spec:   ${resolution.redactedSource}\n` +
    ` * Regenerate: pnpm generate:contracts -- ${source.id}\n` +
    ` */\n\n`;

  const outFile = join(OUT_DIR, `${source.id}.d.ts`);
  await writeFile(outFile, banner + body, "utf8");
  console.log(`  ✓ ${source.label.padEnd(20)} → generated/${source.id}.d.ts`);
  return "generated";
}

async function writeBarrel(generatedIds: string[]): Promise<void> {
  if (generatedIds.length === 0) return;
  const lines = generatedIds
    .sort()
    .map((id) => `export type * as ${toCamel(id)} from "./${id}.js";`);
  const contents =
    `// AUTO-GENERATED barrel — do not edit by hand.\n` + lines.join("\n") + "\n";
  await writeFile(join(OUT_DIR, "index.ts"), contents, "utf8");
}

function toCamel(id: string): string {
  return id.replace(/[-_](\w)/g, (_, c: string) => c.toUpperCase());
}

async function main(): Promise<void> {
  const filters = process.argv.slice(2).map((s) => s.toLowerCase());
  const selected = filters.length
    ? SOURCES.filter(
        (s) => filters.includes(s.id.toLowerCase()) || filters.includes(s.label.toLowerCase()),
      )
    : SOURCES;

  if (selected.length === 0) {
    console.error(`No sources matched: ${filters.join(", ")}`);
    process.exit(1);
  }

  await mkdir(OUT_DIR, { recursive: true });
  console.log(`Generating contracts for ${selected.length} source(s)…\n`);

  const generatedIds: string[] = [];
  let skipped = 0;
  for (const source of selected) {
    try {
      const result = await generateOne(source);
      if (result === "generated") generatedIds.push(source.id);
      else skipped++;
    } catch (err) {
      skipped++;
      console.error(`  ✗ ${source.label.padEnd(20)} failed — ${(err as Error).message}`);
    }
  }

  await writeBarrel(generatedIds);

  console.log(
    `\nDone: ${generatedIds.length} generated, ${skipped} skipped/failed.` +
      (generatedIds.length ? ` Barrel: src/generated/index.ts` : ""),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
