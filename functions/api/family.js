// Cloudflare Pages용 서버 함수. 규칙은 Netlify 함수와 같은 lib/family.mjs를 그대로 쓴다.
import { handle } from '../../netlify/functions/lib/family.mjs';

export async function onRequest({ request, env }) {
  const store = {
    get: (k) => env.DATA.get(k, { type: 'json' }),
    set: (k, v) => env.DATA.put(k, JSON.stringify(v)),
    del: (k) => env.DATA.delete(k),
  };
  let body = null;
  if (request.method === 'POST') {
    try { body = await request.json(); } catch { body = null; }
  }
  const { status, data } = await handle(request.method, request.url, body, store);
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
