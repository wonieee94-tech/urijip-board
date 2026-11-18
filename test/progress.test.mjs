import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../public/progress.js', import.meta.url), 'utf8'), ctx);
const P0 = ctx.window.Progress;
const J = (x) => JSON.parse(JSON.stringify(x)); // vm 안의 배열을 보통 배열로
const P = { queueOf: (...a) => J(P0.queueOf(...a)), planRound: (...a) => J(P0.planRound(...a)), applyReview: (...a) => P0.applyReview(...a) };
const pool = Array.from({ length: 30 }, (_, i) => ({ a: i, b: 1 }));
const keyOf = (q) => `${q.a}+${q.b}`;
const resolve = (k) => { const m = /^(\d+)\+(\d+)$/.exec(k); return m ? { a: +m[1], b: +m[2] } : null; };

test('다음 판: 틀린 문제를 맨 앞에, 나머지는 새 문제', () => {
  const doc = { review: { add10: { '7+1': { n: 1, t: 1, at: 20 }, '3+1': { n: 1, t: 2, at: 10 }, '5+1': { n: 0, t: 1, at: 5 } } } };
  const q = P.queueOf(doc, 'add10');
  assert.deepEqual([...q], ['3+1', '7+1']); // 먼저 틀린 것부터, n 0(예전에 맞힌 것)은 빼고
  const plan = P.planRound(q, resolve, pool, keyOf, 8);
  assert.equal(plan.length, 8);
  assert.deepEqual(plan.slice(0, 2).map((x) => [keyOf(x.q), x.again]), [['3+1', true], ['7+1', true]]);
  assert.ok(plan.slice(2).every((x) => !x.again));
  assert.equal(new Set(plan.map((x) => keyOf(x.q))).size, 8); // 같은 문제 두 번 없음
});
test('틀린 문제가 8개보다 많으면 오래된 8개, 나머지는 다음 판으로', () => {
  const review = {};
  for (let i = 0; i < 11; i++) P.applyReview(review, 'add10', [{ key: `${i}+1` }], [], 100 + i);
  let plan = P.planRound(P.queueOf({ review }, 'add10'), resolve, pool, keyOf, 8);
  assert.ok(plan.every((x) => x.again)); assert.deepEqual(plan.map((x) => keyOf(x.q)), Array.from({ length: 8 }, (_, i) => `${i}+1`));
  // 이번 판에서 6개 맞히고 2개(0+1, 1+1) 또 틀림 → 다음 판: 8+1, 9+1, 10+1 먼저(줄 선 순서 유지), 그다음 0+1, 1+1
  const fixed = plan.slice(2).map((x) => ({ key: keyOf(x.q) })), missed = plan.slice(0, 2).map((x) => ({ key: keyOf(x.q) }));
  P.applyReview(review, 'add10', missed, fixed, 999);
  const q = P.queueOf({ review }, 'add10');
  assert.deepEqual([...q], ['0+1', '1+1', '8+1', '9+1', '10+1']);
  plan = P.planRound(q, resolve, pool, keyOf, 8);
  assert.deepEqual(plan.filter((x) => x.again).map((x) => keyOf(x.q)), ['0+1', '1+1', '8+1', '9+1', '10+1']);
  assert.equal(review.add10['2+1'], undefined); // 맞힌 것은 빠짐
});
test('찾을 수 없는 key는 건너뛴다', () => {
  const plan = P.planRound(['oops', '2+1'], resolve, pool, keyOf, 3);
  assert.deepEqual(plan.map((x) => [keyOf(x.q), x.again]), [['2+1', true], ['0+1', false], ['1+1', false]]);
});
