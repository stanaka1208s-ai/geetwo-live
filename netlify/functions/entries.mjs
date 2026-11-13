// 申し込みの保存・一覧・削除 (Netlify Blobs) + Googleスプレッドシート連携
import { getStore } from "@netlify/blobs";

const MAX = 500;
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n);

// 日本時間の日付・時刻
function jst(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return {
    date: `${d.getUTCFullYear()}/${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())}`,
    time: `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`,
  };
}

// スプレッドシート (Google Apps Script) へ送信。失敗しても申し込み自体は成功させる
async function toSheet(rows) {
  const url = Netlify.env.get("SHEET_WEBHOOK_URL");
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: Netlify.env.get("SHEET_TOKEN") || "", rows: rows.map((e) => ({ ...jst(e.createdAt), name: e.name, line: e.line || "", comment: e.comment || "", id: e.id })) }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function all(store) {
  const { blobs } = await store.list();
  const rows = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
  return rows.filter(Boolean).sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
}

// 一度だけ: LINEの名前の欄ができる前に申し込んだ先頭2名に、LINEの名前を入れる
async function backfillLine(store, entries) {
  const meta = getStore({ name: "geetwo-meta", consistency: "strong" });
  if (await meta.get("line-backfill-1")) return;
  const names = ["たーぼー（tabo）", "TORU UNOSE"];
  for (let i = 0; i < names.length && i < entries.length; i++) {
    if (!entries[i].line) {
      entries[i].line = names[i];
      await store.setJSON(entries[i].id, entries[i]);
    }
  }
  if (entries.length >= names.length) await meta.set("line-backfill-1", "done");
}

export default async (req) => {
  const store = getStore({ name: "geetwo-entries", consistency: "strong" });
  const adminKey = Netlify.env.get("ADMIN_KEY");
  const isAdmin = !!adminKey && req.headers.get("x-admin-key") === adminKey;

  if (req.method === "GET") {
    const entries = await all(store);
    await backfillLine(store, entries);
    return json({ entries });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

    if (body.action === "resync") {
      if (!isAdmin) return json({ error: "forbidden" }, 403);
      if (!Netlify.env.get("SHEET_WEBHOOK_URL")) return json({ error: "no_webhook" }, 400);
      const entries = await all(store);
      const ok = await toSheet(entries);
      return ok ? json({ ok: true, sent: entries.length }) : json({ error: "sheet_failed" }, 502);
    }

    if (body.website) return json({ ok: true, id: "x" }); // bot 対策の隠し項目
    const name = clean(body.name, 40);
    const line = clean(body.line, 40);
    const comment = clean(body.comment, 140);
    if (!name) return json({ error: "name_required" }, 400);
    const { blobs } = await store.list();
    if (blobs.length >= MAX) return json({ error: "full" }, 409);
    const createdAt = new Date().toISOString();
    const id = createdAt.replace(/[^0-9]/g, "") + "-" + Math.random().toString(36).slice(2, 8);
    const entry = { id, name, line, comment, createdAt };
    await store.setJSON(id, entry);
    await toSheet([entry]);
    return json({ ok: true, id });
  }

  if (req.method === "DELETE") {
    if (!isAdmin) return json({ error: "forbidden" }, 403);
    const id = new URL(req.url).searchParams.get("id") || "";
    if (!/^[0-9]+-[a-z0-9]+$/.test(id)) return json({ error: "bad_request" }, 400);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ error: "method_not_allowed" }, 405);
};

export const config = { path: "/api/entries" };
