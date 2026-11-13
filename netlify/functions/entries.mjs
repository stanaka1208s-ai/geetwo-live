// 申し込みの保存・一覧・削除 (Netlify Blobs)
import { getStore } from "@netlify/blobs";

const MAX = 500;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

export default async (req) => {
  const store = getStore({ name: "geetwo-entries", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    const entries = rows.filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
    return json({ entries });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
    if (body.website) return json({ ok: true, id: "x" }); // bot 対策の隠し項目
    const name = clean(body.name, 40);
    const comment = clean(body.comment, 140);
    if (!name) return json({ error: "name_required" }, 400);
    const { blobs } = await store.list();
    if (blobs.length >= MAX) return json({ error: "full" }, 409);
    const createdAt = new Date().toISOString();
    const id = createdAt.replace(/[^0-9]/g, "") + "-" + Math.random().toString(36).slice(2, 8);
    await store.setJSON(id, { id, name, comment, createdAt });
    return json({ ok: true, id });
  }

  if (req.method === "DELETE") {
    const key = Netlify.env.get("ADMIN_KEY");
    if (!key || req.headers.get("x-admin-key") !== key) return json({ error: "forbidden" }, 403);
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^[0-9]+-[a-z0-9]+$/.test(id)) return json({ error: "bad_request" }, 400);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/entries" };
