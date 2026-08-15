// Thin PostgREST client for the Worker's service-role access.
//
// Everything here runs with the service key, which BYPASSES RLS. That is the
// whole point (webhooks have no user, and the API must read across roles),
// but it also means this module must only ever be called AFTER api.js has
// resolved the caller's membership — the IDOR guard lives there, not here.
//
// Kept deliberately dumb: three verbs, service headers, JSON in/out. Query
// strings are built by the caller with sbEq()/URLSearchParams so that every
// user-supplied value is percent-encoded — a crafted id like
// "x,or=(id.gt.0)" must arrive at PostgREST as an (invalid) literal value,
// never as extra operators in the filter.

async function sbRequest(env, fetchImpl, method, path, { body, headers = {} } = {}) {
  const response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: env.SUPABASE_SECRET_KEY,
      authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  if (!response.ok) {
    // Status plus a short PostgREST snippet only. Never the request headers,
    // never env values — this message can end up in calls.error and logs.
    let snippet = "";
    try {
      snippet = String(await response.text()).slice(0, 180);
    } catch (_) {
      // unreadable body — the status alone will have to do
    }
    throw new Error(`supabase_${method.toLowerCase()}_${response.status} ${snippet}`.trim());
  }

  // PostgREST answers 204/201 with an empty body unless return=representation
  // was requested; treat "nothing" and "not JSON" both as null.
  let text = "";
  try {
    text = await response.text();
  } catch (_) {
    return null;
  }
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return null;
  }
}

export function sbGet(env, fetchImpl, path, options) {
  return sbRequest(env, fetchImpl, "GET", path, options);
}

export function sbPost(env, fetchImpl, path, options) {
  return sbRequest(env, fetchImpl, "POST", path, options);
}

export function sbPatch(env, fetchImpl, path, options) {
  return sbRequest(env, fetchImpl, "PATCH", path, options);
}

// Builds "col=eq.value&…" with every value URL-encoded by URLSearchParams.
// `filters` become eq. comparisons; `extra` entries (select, limit,
// on_conflict, is_default=eq.true style raw params) are passed through as-is
// but still encoded.
export function sbEq(filters, extra = {}) {
  const params = new URLSearchParams();
  for (const [column, value] of Object.entries(filters)) params.set(column, `eq.${value}`);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return params.toString();
}
