import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../public/race-core.mjs';

const T0 = 1_000_000;
const room3 = () => { const r = R.newRoom(T0); for (const [id, name] of [['mom0001', '엄마'], ['dad0001', '아빠'], ['kid0001', '세윤']]) R.addPlayer(r, { id, name, mid: id, child: id === 'kid0001' }, T0); return r; };

test('달리기: 첫 사람이 방장, 4명까지, 같은 가족은 한 번만', () => {
  const r = room3(); assert.equal(r.host, 'mom0001');
  assert.throws(() => R.addPlayer(r, { id: 'mom0002', name: '엄마', mid: 'mom0001' }, T0), /벌써/);
  R.addPlayer(r, { id: 'gma0001', name: '할머니', mid: 'gma' }, T0);
  assert.throws(() => R.addPlayer(r, { id: 'x0000001', name: '손님' }, T0), /4명/);
});
test('달리기: 방장만 출발, 3초 카운트다운 뒤 달리기', () => {
  const r = room3();
  assert.throws(() => R.start(r, 'dad0001', T0), /방을 만든/);
  R.start(r, 'mom0001', T0); assert.equal(r.phase, 'countdown');
  assert.equal(R.tap(r, 'kid0001', 1, T0 + 1000), 0); // 카운트다운 중에는 안 셈
  R.step(r, T0 + R.COUNTDOWN); assert.equal(r.phase, 'race');
});
test('달리기: 1초에 12번 넘게 눌러도 그만큼만 센다', () => {
  const r = room3(); R.start(r, 'mom0001', T0); const s = T0 + R.COUNTDOWN;
  let got = 0; for (let t = 0; t < 2000; t += 10) got += R.tap(r, 'kid0001', 20, s + t);
  assert.ok(got <= R.BURST + R.MAX_TPS * 2 + 1, `got ${got}`);
  assert.ok(got >= R.MAX_TPS * 2 - 1);
});
test('달리기: 먼저 들어온 순서대로 등수, 다 들어오면 끝', () => {
  const r = room3(); R.start(r, 'mom0001', T0); const s = T0 + R.COUNTDOWN;
  const run = (id, tps, until) => { for (let t = 0; t <= until; t += 1000 / tps) R.tap(r, id, 1, s + t); };
  run('kid0001', 7, 10000); run('mom0001', 6, 12000); run('dad0001', 5, 14000);
  R.step(r, s + 15000);
  assert.equal(r.phase, 'done');
  const order = R.results(r).map((p) => p.id);
  assert.deepEqual(order, ['kid0001', 'mom0001', 'dad0001']);
});
test('달리기: 컴퓨터 주자는 시간에 따라 같은 자리, 쉬움은 아이가 이길 수 있는 빠르기', () => {
  const r = R.newRoom(T0); R.addPlayer(r, { id: 'kid0001', name: '세윤' }, T0); R.setAi(r, 'kid0001', 3, 'easy', T0);
  assert.equal(r.players.length, 4);
  const ai = r.players[1];
  assert.equal(R.aiTaps(ai, 5000), R.aiTaps(ai, 5000));
  for (let t = 0; t < 30000; t += 50) assert.ok(R.aiTaps(ai, t + 50) >= R.aiTaps(ai, t) - 1e-9);
  // 1초에 5번 누르는 아이는 쉬움 컴퓨터보다 먼저 들어온다
  R.start(r, 'kid0001', T0); const s = T0 + R.COUNTDOWN;
  for (let t = 0; t < 20000; t += 200) { R.tap(r, 'kid0001', 1, s + t); R.step(r, s + t); }
  assert.equal(r.players.find((p) => p.id === 'kid0001').place, 1);
  const hardTime = (() => { let lo = 0, hi = 60000; const p = { level: 'hard', seed: 0 }; for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (R.aiTaps(p, m) >= R.LEN) hi = m; else lo = m; } return hi; })();
  assert.ok(hardTime > 9000 && hardTime < 11500, String(hardTime));
});
test('달리기: 나간 사람·방장 넘기기·다시 하기', () => {
  const r = room3(); R.setAi(r, 'mom0001', 1, 'normal', T0);
  R.removePlayer(r, 'mom0001', T0); assert.equal(r.host, 'dad0001');
  R.start(r, 'dad0001', T0); R.removePlayer(r, 'kid0001', T0 + 100);
  assert.ok(r.players.find((p) => p.id === 'kid0001').gone); // 달리는 중에는 자리 남김
  R.addPlayer(r, { id: 'kid0001', name: '세윤' }, T0 + 200); // 다시 연결
  assert.ok(!r.players.find((p) => p.id === 'kid0001').gone);
  R.step(r, T0 + R.COUNTDOWN + R.LIMIT + 1); assert.equal(r.phase, 'done');
  R.again(r, 'dad0001', T0 + 60000); assert.equal(r.phase, 'lobby');
  assert.ok(r.players.every((p) => p.taps === 0));
  R.removePlayer(r, 'dad0001', T0); R.removePlayer(r, 'kid0001', T0);
  assert.equal(r.players.length, 0); assert.equal(r.host, '');
});
