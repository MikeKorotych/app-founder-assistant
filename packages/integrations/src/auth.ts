/**
 * Auth contracts for every external API we integrate with.
 *
 * One discriminated union per auth strategy from the integrations table.
 * The `kind` field is the discriminant — narrow on it to get a fully typed
 * credential object for a given source.
 */

/** Public endpoint or library — no credentials required. */
export interface NoAuth {
  kind: "noAuth";
}

/** OAuth 2.0 (authorization-code) — Reddit, Product Hunt, Kickstarter. */
export interface OAuth2Auth {
  kind: "oauth2";
  clientId: string;
  clientSecret: string;
  /** Where the app sends the user to authorize. */
  authorizeUrl: string;
  /** Where we exchange the code (and refresh) for tokens. */
  tokenUrl: string;
  redirectUri: string;
  scopes: string[];
  /** Filled in after the manual UI authorization flow. */
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
}

/** Plain API key — paid/partner APIs such as G2, AppMagic, Sensor Tower, AppTweak. */
export interface ApiKeyAuth {
  kind: "apiKey";
  apiKey: string;
  /** Where the key is sent. Some APIs use query params (`token=...`). */
  placement: "header" | "query";
  /** Header the key is sent in (e.g. "x-rapidapi-key", "Authorization"). */
  header?: string;
  /** Query param the key is sent in (e.g. "token"). */
  queryParam?: string;
  /** Optional prefix, e.g. "Bearer " or "Token ". */
  prefix?: string;
  /** RapidAPI also wants the host header. */
  extraHeaders?: Record<string, string>;
}

/** JWT signed with a private key — App Store Connect. */
export interface JwtAuth {
  kind: "jwt";
  /** App Store Connect API Key ID (kid). */
  keyId: string;
  /** Issuer ID from App Store Connect → Integrations. */
  issuerId: string;
  /** PEM-encoded private key (.p8 contents). */
  privateKey: string;
  /** Token lifetime in seconds (App Store Connect caps at 1200). */
  expiresInSeconds: number;
}

/** Service account — Google Play (Android Publisher). */
export interface ServiceAccountAuth {
  kind: "serviceAccount";
  /** Contents of the downloaded service-account JSON key file. */
  credentials: {
    client_email: string;
    private_key: string;
    project_id: string;
    [k: string]: unknown;
  };
  scopes: string[];
}

/** Supabase anon key — BigIdeasDB. */
export interface SupabaseAnonAuth {
  kind: "supabaseAnon";
  /** Project base URL, e.g. https://xyz.supabase.co */
  url: string;
  /** Public anon key (safe for client use, RLS-gated). */
  anonKey: string;
}

export type Auth =
  | NoAuth
  | OAuth2Auth
  | ApiKeyAuth
  | JwtAuth
  | ServiceAccountAuth
  | SupabaseAnonAuth;

export type AuthKind = Auth["kind"];
