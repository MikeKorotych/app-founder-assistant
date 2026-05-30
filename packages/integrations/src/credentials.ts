import type { ApiKeyAuth, Auth, NoAuth } from "./auth.js";
import { type ApiSource, SOURCES } from "./sources.js";

export type SecretBag = Record<string, string | undefined>;

export interface AuthStatus {
  sourceId: string;
  label: string;
  ready: boolean;
  auth: ApiSource["auth"];
  envVar?: string;
  missing?: string;
}

export interface HttpRequestDescriptor {
  url: string;
  headers?: Record<string, string>;
}

export function findSource(sourceId: string): ApiSource | undefined {
  return SOURCES.find((source) => source.id === sourceId);
}

export function requiredEnvVars(sources: ApiSource[] = SOURCES): string[] {
  return [
    ...new Set(
      sources
        .flatMap((source) => {
          if (source.apiKey) return [source.apiKey.envVar];
          if (source.spec.kind === "url" && source.spec.headersFromEnv) {
            return Object.values(source.spec.headersFromEnv);
          }
          return [];
        })
        .sort(),
    ),
  ];
}

export function authStatus(source: ApiSource, secrets: SecretBag = process.env): AuthStatus {
  if (source.auth === "noAuth") {
    return { sourceId: source.id, label: source.label, ready: true, auth: source.auth };
  }

  if (source.auth === "apiKey") {
    if (!source.apiKey) {
      return {
        sourceId: source.id,
        label: source.label,
        ready: false,
        auth: source.auth,
        missing: "apiKey config is missing from the source registry",
      };
    }

    const value = secrets[source.apiKey.envVar];
    return {
      sourceId: source.id,
      label: source.label,
      ready: Boolean(value),
      auth: source.auth,
      envVar: source.apiKey.envVar,
      missing: value ? undefined : source.apiKey.envVar,
    };
  }

  return {
    sourceId: source.id,
    label: source.label,
    ready: false,
    auth: source.auth,
    missing: `${source.auth} runtime resolver is not implemented yet`,
  };
}

export function allAuthStatuses(secrets: SecretBag = process.env): AuthStatus[] {
  return SOURCES.map((source) => authStatus(source, secrets));
}

export function resolveAuthForSource(
  sourceId: string,
  secrets: SecretBag = process.env,
): Auth | null {
  const source = findSource(sourceId);
  if (!source) return null;

  if (source.auth === "noAuth") {
    return { kind: "noAuth" } satisfies NoAuth;
  }

  if (source.auth !== "apiKey" || !source.apiKey) return null;

  const apiKey = secrets[source.apiKey.envVar];
  if (!apiKey) return null;

  const auth: ApiKeyAuth = {
    kind: "apiKey",
    apiKey,
    placement: source.apiKey.placement,
    prefix: source.apiKey.prefix,
  };

  if (source.apiKey.placement === "header") auth.header = source.apiKey.name;
  if (source.apiKey.placement === "query") auth.queryParam = source.apiKey.name;

  return auth;
}

export function applyAuthToRequest(
  request: HttpRequestDescriptor,
  auth: Auth | null,
): HttpRequestDescriptor {
  if (!auth || auth.kind === "noAuth") return request;

  if (auth.kind !== "apiKey") {
    throw new Error(`Auth kind ${auth.kind} cannot be injected into a generic HTTP request yet.`);
  }

  const headers = { ...(request.headers ?? {}) };

  if (auth.placement === "header") {
    if (!auth.header) throw new Error("ApiKeyAuth.header is required for header placement.");
    headers[auth.header] = `${auth.prefix ?? ""}${auth.apiKey}`;
    return { ...request, headers };
  }

  if (!auth.queryParam) throw new Error("ApiKeyAuth.queryParam is required for query placement.");
  const url = new URL(request.url);
  url.searchParams.set(auth.queryParam, auth.apiKey);

  return {
    ...request,
    url: url.toString(),
    headers,
  };
}
