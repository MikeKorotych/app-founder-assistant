// Proxy /api/* to the API Worker. Next's external (absolute-URL) rewrites are
// not proxied by OpenNext on Cloudflare Workers, so we forward explicitly via
// fetch — supporting every method plus streamed (SSE/JSON) response bodies.
const API_URL = process.env.API_URL ?? "http://localhost:8787";

async function proxy(req: Request, path: string[]): Promise<Response> {
  const { search } = new URL(req.url);
  const target = `${API_URL}/${path.join("/")}${search}`;

  // Drop the inbound Host (hahaton-web …) — fetch must set Host from the target
  // URL, or Cloudflare rejects the cross-host request with 1003.
  const headers = new Headers(req.headers);
  headers.delete("host");

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const res = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? req.body : undefined,
    // Required when streaming a request body to an upstream fetch.
    ...(hasBody ? { duplex: "half" } : {}),
    redirect: "manual",
  } as RequestInit);

  // Pass the upstream response straight through (status + streamed body).
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers: res.headers,
  });
}

type Ctx = { params: Promise<{ path: string[] }> };

const handler = async (req: Request, ctx: Ctx): Promise<Response> => {
  const { path } = await ctx.params;
  return proxy(req, path);
};

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
export const HEAD = handler;
