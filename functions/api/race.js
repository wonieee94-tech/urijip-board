// /api/race?code=가족코드 → 가족 달리기 방 (Durable Object로 넘김)
// RACE 바인딩이 없으면 501을 돌려주고, 화면은 '혼자(컴퓨터와)'·'한 기기 둘이서' 모드만 보여 준다.
import { validCode } from '../../lib/family.mjs';

const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const code = (url.searchParams.get('code') || '').toUpperCase();
  if (!validCode(code)) return json(400, { error: '가족 코드가 올바르지 않아요' });
  if (!env.RACE) return json(501, { error: '가족 달리기 방이 아직 설정되지 않았어요', setup: true });
  if (!(await env.DATA.get('f:' + code))) return json(404, { error: '가족을 찾을 수 없어요' });
  // 다른 사이트에서 이 방에 붙지 못하게 (브라우저가 보내는 Origin 확인)
  const origin = request.headers.get('Origin');
  if (origin && new URL(origin).host !== url.host) return json(403, { error: '다른 곳에서는 들어올 수 없어요' });
  const stub = env.RACE.get(env.RACE.idFromName(code));
  return stub.fetch(request);
}
