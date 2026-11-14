import { getAuth } from "@/lib/auth/server";
import { ALLOWED_AUTH_ENDPOINTS, AUTH_BASE_PATH } from "@/lib/config/auth";

/**
 * Better Auth HTTP endpoints, documented in docs/contracts.md ("Authentication").
 * Deny by default: only the paths in ALLOWED_AUTH_ENDPOINTS reach Better Auth.
 * Sign-up, password reset, change email, delete user and the rest answer 404.
 * Nothing from the body, cookies or tokens is logged here.
 */
function isAllowed(request: Request): boolean {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith(`${AUTH_BASE_PATH}/`)) return false;
  const path = pathname.slice(AUTH_BASE_PATH.length);
  if (!Object.hasOwn(ALLOWED_AUTH_ENDPOINTS, path)) return false;
  return ALLOWED_AUTH_ENDPOINTS[path].includes(request.method);
}

/**
 * Better Auth puts the session token in the sign-in JSON body. The cookie
 * (HttpOnly) is the only place it belongs, so drop it from the body and keep
 * every header, including each Set-Cookie.
 */
async function withoutToken(response: Response): Promise<Response> {
  if (!response.headers.get("content-type")?.includes("application/json")) return response;
  let body: unknown;
  try {
    body = await response.clone().json();
  } catch {
    return response;
  }
  if (typeof body !== "object" || body === null || !("token" in body)) return response;
  const { token: _token, ...rest } = body as Record<string, unknown>;
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  return new Response(JSON.stringify(rest), { status: response.status, statusText: response.statusText, headers });
}

async function handle(request: Request): Promise<Response> {
  if (!isAllowed(request)) {
    return Response.json({ error: "not_found" }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  const response = await getAuth().handler(request);
  return new URL(request.url).pathname === `${AUTH_BASE_PATH}/sign-in/email` ? withoutToken(response) : response;
}

export const GET = handle;
export const POST = handle;
