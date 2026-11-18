// Cloudflare Pages용 서버 함수. 규칙은 lib/family.mjs (내 PC 테스트 서버와 같은 파일)
import { handle } from '../../lib/family.mjs';

const MAX_BODY = 32 * 1024;

export async function onRequest({ request, env }) {
  const store = {
    get: (k) => env.DATA.get(k, { type: 'json' }),
    set: (k, v, o) => env.DATA.put(k, JSON.stringify(v), o?.ttl ? { expirationTtl: Math.max(60, o.ttl) } : undefined),
    del: (k) => env.DATA.delete(k),
  };
  const send = (status, data) => new Response(JSON.stringify(data), {
    status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
  let body = null;
  if (request.method === 'POST') {
    const text = await request.text();
    if (text.length > MAX_BODY) return send(413, { error: '보낸 내용이 너무 커요' });
    try { body = JSON.parse(text); } catch { body = null; }
  }
  const ip = request.headers.get('cf-connecting-ip') || '';
  const { status, data } = await handle(request.method, request.url, body, store, { ip });
  return send(status, data);
}
