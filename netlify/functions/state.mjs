import { getStore } from "@netlify/blobs";

// Shared game state for the Cottontown sub tracker.
// GET  /api/state  -> { now, games: [ {rev, game} | null, one per game ] }
// POST /api/state  -> { i, game, code }  saves one game (needs the coach code)
// POST /api/state  -> { verify: true, code } checks the coach code

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const coachCode = () =>
  (globalThis.Netlify?.env?.get?.("COACH_CODE") ?? process.env.COACH_CODE ?? "").trim();

export default async (req) => {
  const store = getStore({ name: "cottontown", consistency: "strong" });
  const now = Date.now();

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad request" }, 400); }
    const expected = coachCode();
    if (!expected) return json({ error: "COACH_CODE is not set in Netlify" }, 500);
    if (!body || String(body.code ?? "").trim() !== expected) return json({ error: "wrong code" }, 401);
    if (body.verify) return json({ ok: true, now });

    const i = Number(body.i);
    if (!Number.isInteger(i) || i < 0 || i > 5 || typeof body.game !== "object" || body.game === null) {
      return json({ error: "bad request" }, 400);
    }
    if (JSON.stringify(body.game).length > 200000) return json({ error: "too large" }, 413);

    const cur = await store.get("game-" + i, { type: "json" });
    const rev = ((cur && cur.rev) || 0) + 1;
    await store.setJSON("game-" + i, { rev, game: body.game, at: now });
    return json({ ok: true, now, rev });
  }

  const games = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => store.get("game-" + i, { type: "json" })));
  return json({ now, games });
};

export const config = { path: "/api/state" };
