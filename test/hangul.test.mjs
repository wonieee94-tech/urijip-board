import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = {}; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(new URL('../public/hangul.js', import.meta.url), 'utf8'), ctx);
const H = ctx.Hangul;

test('dec/comp 왕복', () => {
  for (const ch of ['가', '밑', '꽃', '앉', '힣']) { const d = H.dec(ch); assert.equal(H.comp(d.cho, d.jung, d.jong), ch); }
  assert.equal(H.dec('a'), null); assert.equal(H.dec(''), null);
});
test('연음: 받침이 뒤 글자로 이사 간다', () => {
  assert.equal(H.soundOf('밑에'), '미테');
  assert.equal(H.soundOf('꽃이'), '꼬치');
  assert.equal(H.soundOf('옷을'), '오슬');
  assert.equal(H.soundOf('부엌에서'), '부어케서');
  assert.equal(H.soundOf('앉아요'), '안자요');
  assert.equal(H.soundOf('읽어요'), '일거요');
  assert.equal(H.soundOf('깎아요'), '까까요');
  assert.equal(H.soundOf('학교'), '학교'); // ㅇ이 아니면 그대로
});
test('movedOf: 남는 받침과 이사 가는 소리', () => {
  assert.deepEqual([H.movedOf('밑').base, H.movedOf('밑').chip], ['미', 'ㅌ']);
  assert.deepEqual([H.movedOf('앉').base, H.movedOf('앉').chip], ['안', 'ㅈ']);
});
test('숫자 조사', () => {
  assert.equal(H.eun(2), '는'); assert.equal(H.eun(3), '은'); assert.equal(H.eun(10), '은'); assert.equal(H.eun(9), '는');
  assert.equal(H.eul(4), '를'); assert.equal(H.eul(7), '을');
  assert.equal(H.rang(5), '랑'); assert.equal(H.rang(1), '이랑');
  assert.equal(H.ro(1), '로'); assert.equal(H.ro(3), '으로'); assert.equal(H.ro(2), '로'); assert.equal(H.ro(6), '으로'); assert.equal(H.ro(8), '로');
});
