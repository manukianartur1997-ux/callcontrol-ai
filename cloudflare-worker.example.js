const corsHeaders = {"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization"};
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return json({ ok: true }, 204);
    if (url.pathname === "/api/health") return json({ ok: true, app: "CallControl AI", runtime: "cloudflare-worker" });
    if (request.method === "POST" && url.pathname === "/api/leads") return createLead(request, env);
    if (request.method === "GET" && env.ASSETS) return env.ASSETS.fetch(request);
    return json({ ok: false, error: "not_found" }, 404);
  }
};
async function createLead(request, env) {
  const input = await request.json().catch(() => ({}));
  const lead = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), name: clean(input.name), contact: clean(input.contact), company: clean(input.company), pain: clean(input.pain), source: clean(input.source || "callcontrol-landing") };
  if (!lead.name || !lead.contact || !lead.company) return json({ ok: false, error: "name_contact_company_required" }, 400);
  if (env.LEADS_KV) await env.LEADS_KV.put(`lead:${lead.createdAt}:${lead.id}`, JSON.stringify(lead));
  return json({ ok: true, leadId: lead.id, message: "Lead accepted" }, 201);
}
function clean(value) { return String(value || "").trim().slice(0, 1200); }
function json(payload, status = 200) { return new Response(JSON.stringify(payload, null, 2), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders } }); }
