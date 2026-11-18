import test from 'node:test';
import assert from 'node:assert/strict';
import { apply, newFamily, handle, genCode, validCode, nearToday, passed, publicDoc, norm } from '../lib/family.mjs';

const NOW = Date.UTC(2026, 10, 18, 3, 0); // 2026-11-18 12:00 KST
const TODAY = '2026-11-18';
const fam = () => newFamily({ name: '테스트', members: [{ name: '엄마' }, { name: '세윤', role: 'child' }] });
const memStore = () => { const db = {}; return { db, get: async (k) => (db[k] ? structuredClone(db[k]) : null), set: async (k, v) => { db[k] = structuredClone(v); }, del: async (k) => { delete db[k]; } }; };

test('가족 코드: 형식과 난수', () => {
  const s = new Set(); for (let i = 0; i < 500; i++) { const c = genCode(); assert.ok(validCode(c), c); s.add(c); }
  assert.equal(s.size, 500);
});
test('날짜는 오늘 앞뒤만 받는다', () => {
  assert.ok(nearToday(TODAY, NOW)); assert.ok(nearToday('2026-11-17', NOW)); assert.ok(nearToday('2026-11-19', NOW));
  assert.ok(!nearToday('2030-01-01', NOW)); assert.ok(!nearToday('2026-11-01', NOW)); assert.ok(!nearToday('bad', NOW));
  assert.throws(() => apply(fam(), 'addSticker', { date: '2030-01-01', subject: 'han' }, NOW), /날짜/);
  assert.throws(() => apply(fam(), 'addStars', { date: '2030-01-01', n: 5 }, NOW), /날짜/);
});
test('루틴 체크는 있는 루틴만', () => {
  const d = fam(); const rid = d.routines[0].id;
  apply(d, 'toggleCheck', { date: TODAY, rid }, NOW); assert.ok(d.checks[TODAY][rid]);
  apply(d, 'toggleCheck', { date: TODAY, rid }, NOW); assert.ok(!d.checks[TODAY][rid]);
  assert.throws(() => apply(d, 'toggleCheck', { date: TODAY, rid: 'nope' }, NOW), /루틴/);
});
test('포도알 기준: 8문제 중 6개 이상', () => {
  assert.ok(passed(6, 8)); assert.ok(!passed(5, 8)); assert.ok(passed(3, 4)); assert.ok(!passed(3, 3));
  const d = fam();
  apply(d, 'finishRound', { roundId: 'r1', date: TODAY, subject: 'math', kind: 'add10', right: 5, total: 8, stars: 5 }, NOW);
  assert.equal(d.lastRound.award, 'low'); assert.equal(d.stickers.board.length, 0); assert.equal(d.study[TODAY], 5);
  apply(d, 'finishRound', { roundId: 'r2', date: TODAY, subject: 'math', kind: 'add10', right: 7, total: 8, stars: 7 }, NOW);
  assert.equal(d.lastRound.award, 'added'); assert.equal(d.stickers.board.length, 1); assert.equal(d.stickers.total, 1);
  apply(d, 'finishRound', { roundId: 'r3', date: TODAY, subject: 'math', kind: 'add10', right: 8, total: 8, stars: 8 }, NOW);
  assert.equal(d.lastRound.award, 'had');
  assert.deepEqual(d.learn[TODAY].math, { r: 20, t: 24, n: 3 });
  apply(d, 'finishRound', { roundId: 'r4', date: TODAY, subject: 'han', kind: 'quiz', right: 8, total: 8, stars: 8, review: true }, NOW);
  assert.equal(d.lastRound.award, 'none'); // 복습판은 포도알 없음
});
test('다시 풀기 목록: 틀리면 올라가고 맞히면 내려간다', () => {
  const d = fam();
  apply(d, 'finishRound', { date: TODAY, subject: 'times', kind: 'tquiz', right: 6, total: 8, stars: 6, missed: ['7×8', '6×9'] }, NOW);
  apply(d, 'finishRound', { date: TODAY, subject: 'times', kind: 'tquiz', right: 7, total: 8, stars: 7, missed: ['7×8'] }, NOW);
  assert.deepEqual([d.review.tquiz['7×8'].n, d.review.tquiz['7×8'].t], [2, 2]);
  apply(d, 'finishRound', { date: TODAY, kind: 'tquiz', right: 2, total: 2, stars: 2, review: true, tally: { times: [2, 2] }, fixed: [{ kind: 'tquiz', key: '7×8' }, { kind: 'tquiz', key: '6×9' }] }, NOW);
  assert.equal(d.review.tquiz['7×8'].n, 1); assert.equal(d.review.tquiz['6×9'].n, 0); assert.equal(d.review.tquiz['6×9'].t, 1);
  assert.throws(() => apply(d, 'finishRound', { date: '1999-01-01', right: 1, total: 1 }, NOW));
});
test('입력 범위 제한', () => {
  const d = fam();
  apply(d, 'finishRound', { date: TODAY, subject: 'abc', kind: 'build', right: 99, total: 99, stars: 999 }, NOW);
  assert.equal(d.study[TODAY], 12); assert.deepEqual(d.learn[TODAY].abc, { r: 12, t: 12, n: 1 });
});
test('여행: 도장과 별, 최고 점수', () => {
  const d = fam();
  apply(d, 'addTrip', { code: 'nrt', nm: '도쿄', date: '11.18', stars: 9 }, NOW);
  apply(d, 'gameResult', { key: 'landing-2', score: 80, ok: true, stars: 3 }, NOW);
  apply(d, 'gameResult', { key: 'landing-2', score: 60, ok: true, stars: 1 }, NOW);
  assert.equal(d.travel.stamps[0].code, 'NRT'); assert.equal(d.travel.stars, 13); assert.equal(d.travel.best['landing-2'], 80); assert.equal(d.travel.ok, 3);
  assert.throws(() => apply(d, 'addTrip', { code: '<x>' }, NOW));
  assert.throws(() => apply(d, 'gameResult', { key: 'A B' }, NOW));
});
test('예전 데이터도 그대로 읽힌다', () => {
  const old = { name: '옛집', members: [], status: {}, events: [], routines: [], checks: {}, notes: [], study: {}, stickers: { board: [{ date: TODAY, subject: 'han' }], gift: '레고', history: [{ gift: 'a' }] }, rev: 5 };
  norm(old);
  assert.equal(old.stickers.total, 31); assert.deepEqual(old.travel.stamps, []); assert.equal(old.goal.subjects, 2);
});
test('PIN: 지우기는 PIN이 있어야 하고, 30일 안에 되살릴 수 있다', async () => {
  const st = memStore();
  const c = (await handle('POST', 'http://x/api/family', { op: 'create', p: { name: '집' } }, st, { now: NOW })).data.code;
  let r = await handle('POST', 'http://x/api/family', { code: c, op: 'setPin', p: { newPin: '12' } }, st, { now: NOW });
  assert.equal(r.status, 400);
  r = await handle('POST', 'http://x/api/family', { code: c, op: 'setPin', p: { newPin: '2468' } }, st, { now: NOW });
  assert.equal(r.status, 200); assert.equal(r.data.hasPin, true); assert.equal(r.data.pin, undefined);
  r = await handle('GET', `http://x/api/family?code=${c}`, null, st);
  assert.equal(r.data.pin, undefined); assert.equal(r.data.hasPin, true);
  r = await handle('POST', 'http://x/api/family', { code: c, op: 'deleteFamily' }, st, { now: NOW });
  assert.equal(r.status, 403);
  r = await handle('POST', 'http://x/api/family', { code: c, op: 'checkPin', pin: '2468' }, st, { now: NOW });
  assert.equal(r.data.ok, true);
  r = await handle('POST', 'http://x/api/family', { code: c, op: 'deleteFamily', pin: '2468' }, st, { now: NOW });
  assert.equal(r.data.deleted, true); assert.ok(!st.db['f:' + c]); assert.ok(st.db['trash:' + c]);
  r = await handle('POST', 'http://x/api/family', { code: c, op: 'restoreFamily', pin: '0000' }, st, { now: NOW });
  assert.equal(r.status, 403);
  r = await handle('POST', 'http://x/api/family', { code: c, op: 'restoreFamily', pin: '2468' }, st, { now: NOW });
  assert.equal(r.status, 200); assert.ok(st.db['f:' + c]);
});
test('PIN을 5번 틀리면 잠긴다', async () => {
  const st = memStore();
  const c = (await handle('POST', 'http://x/api/family', { op: 'create', p: {} }, st, { now: NOW })).data.code;
  await handle('POST', 'http://x/api/family', { code: c, op: 'setPin', p: { newPin: '1357' } }, st, { now: NOW });
  for (let i = 0; i < 5; i++) await handle('POST', 'http://x/api/family', { code: c, op: 'checkPin', pin: '0000' }, st, { now: NOW });
  const r = await handle('POST', 'http://x/api/family', { code: c, op: 'checkPin', pin: '1357' }, st, { now: NOW });
  assert.equal(r.status, 429);
  const later = await handle('POST', 'http://x/api/family', { code: c, op: 'checkPin', pin: '1357' }, st, { now: NOW + 6 * 60000 });
  assert.equal(later.data.ok, true);
});
test('같은 판을 두 번 보내도 한 번만 센다', async () => {
  const st = memStore();
  const c = (await handle('POST', 'http://x/api/family', { op: 'create', p: {} }, st, { now: NOW })).data.code;
  const body = { code: c, op: 'finishRound', p: { roundId: 'abc123', date: TODAY, subject: 'han', kind: 'quiz', right: 8, total: 8, stars: 8 } };
  await handle('POST', 'http://x', body, st, { now: NOW }); const r = await handle('POST', 'http://x', body, st, { now: NOW });
  assert.equal(r.data.study[TODAY], 8); assert.equal(r.data.stickers.board.length, 1);
});
test('쓰는 사이 다른 기기가 고쳤으면 새 문서에 다시 적용한다', async () => {
  const st = memStore();
  const c = (await handle('POST', 'http://x/api/family', { op: 'create', p: {} }, st, { now: NOW })).data.code;
  let raced = false;
  const racy = { ...st, get: async (k) => {
    const v = await st.get(k);
    if (!raced && k === 'f:' + c && v) { raced = true; const other = structuredClone(v); apply(other, 'addNote', { text: '다른 기기' }, NOW); await st.set(k, other); }
    return v;
  } };
  const r = await handle('POST', 'http://x', { code: c, op: 'addNote', p: { text: '이 기기' } }, racy, { now: NOW });
  assert.deepEqual(r.data.notes.map((n) => n.text).sort(), ['다른 기기', '이 기기']);
});
test('만들기 횟수 제한', async () => {
  const st = memStore(); let last;
  for (let i = 0; i < 11; i++) last = await handle('POST', 'http://x', { op: 'create', p: {} }, st, { now: NOW, ip: '1.2.3.4' });
  assert.equal(last.status, 429);
});
test('publicDoc은 PIN 정보를 감춘다', () => {
  const d = fam(); d.pin = { salt: 'a', hash: 'b' }; d.pinFail = { n: 1 };
  const p = publicDoc(d); assert.equal(p.pin, undefined); assert.equal(p.pinFail, undefined); assert.equal(p.hasPin, true);
});
