// Supabase JWT validation for the Worker.
//
// The cabinet sends the user's Supabase access token as a Bearer header. The
// Worker does not verify the signature offline — it asks Supabase Auth itself
// (GET /auth/v1/user), which also catches revoked sessions and deleted users,
// something offline JWKS verification would miss.
//
// Each createApi() instance owns one cache (createTokenCache()): a token is
// re-validated at most once per 60 seconds, capped at 500 entries with
// oldest-first eviction so a token flood cannot balloon isolate memory. The
// cache is deliberately NOT module-global: tests stay isolated, and an
// isolate restart naturally empties it.

const TTL_MS = 60_000;
const MAX_ENTRIES = 500;

export function createTokenCache() {
  // A Map preserves insertion order — exactly what oldest-first eviction needs.
  return new Map();
}

// -> { id, email, user_metadata } | null. Never throws: any failure (missing
// header, bad token, auth service unreachable) reads as "not authenticated".
export async function getUser(request, env, fetchImpl, cache) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  const token = match ? match[1].trim() : "";
  if (!token) return null;

  const now = Date.now();
  const hit = cache?.get(token);
  if (hit) {
    if (hit.expiresAt > now) return hit.user;
    cache.delete(token);
  }

  let response;
  try {
    response = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
      headers: {
        apikey: env.SUPABASE_SECRET_KEY,
        authorization: `Bearer ${token}`
      }
    });
  } catch (_) {
    return null;
  }
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  if (!data?.id) return null;

  // user_metadata rides along for the cabinet (full_name / avatar set at
  // signup or by the Google OAuth provider). Always an object, possibly empty.
  const user = {
    id: data.id,
    email: data.email || null,
    user_metadata: data.user_metadata && typeof data.user_metadata === "object" ? data.user_metadata : {}
  };
  if (cache) {
    // Only successes are cached: a bad token re-hits auth every time, which
    // keeps "revoked a second ago" windows short and the logic simple.
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(token, { user, expiresAt: now + TTL_MS });
  }
  return user;
}
