// 가족 달리기 규칙 (한 파일을 브라우저·Durable Object·테스트가 같이 쓴다)
// 거리는 '탭 수'로 센다: LEN 번 누르면 결승선. 1초에 MAX_TPS 번까지만 센다(연타 기계·자동 클릭 막기).
export const LEN = 60;
export const MAX_TPS = 12;
export const BURST = 4;            // 잠깐 몰아서 와도 받아 주는 여유
export const MAX_PLAYERS = 4;
export const COUNTDOWN = 3000;     // 3·2·1
export const LIMIT = 45000;        // 출발 후 45초면 끝
export const AFTER_FIRST = 12000;  // 1등이 들어오고 12초 지나면 끝
export const AI = {
  easy:   { tps: 3.7, name: '느긋한 거북', emoji: '🐢' },
  normal: { tps: 5.0, name: '씩씩한 토끼', emoji: '🐰' },
  hard:   { tps: 6.3, name: '번개 치타', emoji: '🐆' },
};
const AI_EXTRA = [['🐢', '거북'], ['🐰', '토끼'], ['🐆', '치타'], ['🦊', '여우']];
const clip = (s, n) => String(s ?? '').slice(0, n);

export function newRoom(now = Date.now()) {
  return { phase: 'lobby', host: '', players: [], startAt: 0, endAt: 0, ai: { n: 0, level: 'easy' }, round: 0, at: now };
}
export function addPlayer(room, p, now = Date.now()) {
  const id = clip(p.id, 16); if (!/^[a-z0-9]{4,16}$/.test(id)) throw new Error('잘못된 참가자예요');
  const old = room.players.find((x) => x.id === id && !x.ai);
  if (old) { old.gone = false; if (room.phase === 'lobby') Object.assign(old, { name: clip(p.name, 12) || old.name, emoji: clip(p.emoji, 8) || old.emoji }); return old; } // 다시 연결
  if (room.phase !== 'lobby') throw new Error('이미 달리는 중이에요. 다음 판에 같이 해요');
  const info = { mid: clip(p.mid, 12), name: clip(p.name, 12) || '가족', emoji: clip(p.emoji, 8) || '🙂', child: !!p.child };
  if (room.players.filter((x) => !x.ai).length >= MAX_PLAYERS) throw new Error('4명까지 달릴 수 있어요');
  if (info.mid && room.players.some((x) => x.mid === info.mid)) throw new Error(`${info.name}은(는) 벌써 들어와 있어요`);
  const pl = { id, ...info, ai: false, taps: 0, fin: 0, bucket: BURST, last: now };
  room.players.push(pl);
  if (!room.host) room.host = id;
  fitAi(room); room.at = now;
  return pl;
}
export function removePlayer(room, id, now = Date.now()) {
  const pl = room.players.find((x) => x.id === id); if (!pl) return;
  if (room.phase === 'lobby' || room.phase === 'done') room.players = room.players.filter((x) => x.id !== id);
  else pl.gone = true; // 달리는 중에는 자리를 남긴다
  if (room.host === id) room.host = room.players.find((x) => !x.ai && !x.gone)?.id || '';
  if (!room.players.some((x) => !x.ai && !x.gone)) Object.assign(room, newRoom(now));
  else fitAi(room);
  room.at = now;
}
export function setAi(room, by, n, level, now = Date.now()) {
  if (by !== room.host) throw new Error('방을 만든 사람만 바꿀 수 있어요');
  if (room.phase !== 'lobby') return;
  room.ai = { n: Math.max(0, Math.min(3, n | 0)), level: AI[level] ? level : 'easy' };
  fitAi(room); room.at = now;
}
function fitAi(room) {
  const humans = room.players.filter((x) => !x.ai);
  const want = Math.max(0, Math.min(room.ai.n, MAX_PLAYERS - humans.length));
  const lv = AI[room.ai.level];
  const ais = [];
  for (let i = 0; i < want; i++) {
    const [emoji, nm] = i === 0 ? [lv.emoji, lv.name] : AI_EXTRA[(i + Object.keys(AI).indexOf(room.ai.level)) % AI_EXTRA.length];
    ais.push({ id: 'ai' + i, name: i === 0 ? nm : nm + ' ' + (i + 1), emoji, ai: true, level: room.ai.level, seed: (i * 1.7 + 0.4) % 6.28, taps: 0, fin: 0 });
  }
  room.players = [...humans, ...ais];
}
export function start(room, by, now = Date.now()) {
  if (by !== room.host) throw new Error('방을 만든 사람이 출발을 눌러요');
  if (room.phase !== 'lobby') return;
  if (!room.players.length) throw new Error('달릴 사람이 없어요');
  room.phase = 'countdown'; room.startAt = now + COUNTDOWN; room.endAt = 0; room.round++;
  for (const p of room.players) Object.assign(p, { taps: 0, fin: 0, place: 0, bucket: BURST, last: room.startAt, gone: false });
  room.at = now;
}
export function again(room, by, now = Date.now()) {
  if (by !== room.host) throw new Error('방을 만든 사람이 다시 하기를 눌러요');
  room.players = room.players.filter((x) => !x.gone);
  room.phase = 'lobby'; room.startAt = 0; room.endAt = 0;
  for (const p of room.players) Object.assign(p, { taps: 0, fin: 0, place: 0 });
  fitAi(room); room.at = now;
}
// 탭 n번 받기: 토큰 통 방식으로 1초에 MAX_TPS 번까지만 인정. 받아들인 수를 돌려준다.
export function tap(room, id, n, now = Date.now()) {
  step(room, now);
  if (room.phase !== 'race') return 0;
  const p = room.players.find((x) => x.id === id && !x.ai); if (!p || p.fin) return 0;
  p.bucket = Math.min(BURST, (p.bucket ?? BURST) + Math.max(0, now - (p.last || now)) * MAX_TPS / 1000); p.last = now;
  const ok = Math.max(0, Math.min(n | 0, Math.floor(p.bucket), 20));
  p.bucket -= ok; p.taps = Math.min(LEN, p.taps + ok);
  if (p.taps >= LEN) finish(room, p, now);
  return ok;
}
// 컴퓨터 주자의 위치(탭 수): 시간만으로 정해지는 식이라 어디서 계산해도 같다
export function aiTaps(p, ms) {
  if (ms <= 0) return 0;
  const s = ms / 1000, lv = AI[p.level] || AI.easy;
  const v = s < 0.6 ? 0 : lv.tps * (s - 0.6) + 0.55 * Math.sin(s * 1.6 + p.seed) - 0.55 * Math.sin(0.96 + p.seed);
  return Math.max(0, Math.min(LEN, v));
}
function finish(room, p, t) {
  p.fin = t; p.taps = LEN;
  p.place = room.players.filter((x) => x.fin).length;
}
// 시간 흐름: 카운트다운 → 달리기 → 끝. 바뀐 게 있으면 true
export function step(room, now = Date.now()) {
  let ch = false;
  if (room.phase === 'countdown' && now >= room.startAt) { room.phase = 'race'; ch = true; }
  if (room.phase !== 'race') return ch;
  const ms = now - room.startAt;
  for (const p of room.players) if (p.ai && !p.fin) {
    p.taps = aiTaps(p, ms);
    if (p.taps >= LEN) { // 정확히 들어온 시각을 거꾸로 찾는다
      let lo = 0, hi = ms; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (aiTaps(p, m) >= LEN) hi = m; else lo = m; }
      p.fin = room.startAt + Math.round(hi); ch = true;
    }
  }
  // 같은 틱에 들어온 주자들 순위 다시 매기기
  const fins = room.players.filter((x) => x.fin).sort((a, b) => a.fin - b.fin);
  fins.forEach((x, i) => { x.place = i + 1; });
  const live = room.players.filter((x) => !x.gone || x.fin);
  const humans = live.filter((x) => !x.ai);
  const allIn = live.every((x) => x.fin);
  const lastHuman = humans.length && humans.every((x) => x.fin) ? Math.max(...humans.map((x) => x.fin)) : 0;
  const first = fins[0]?.fin || 0;
  if (allIn || ms >= LIMIT || (first && now - first >= AFTER_FIRST) || (lastHuman && now - lastHuman >= 3000)) {
    room.phase = 'done'; room.endAt = now; ch = true;
    // 못 들어온 주자는 간 거리 순으로 뒤에 세운다
    const rest = room.players.filter((x) => !x.fin).sort((a, b) => b.taps - a.taps);
    rest.forEach((x, i) => { x.place = fins.length + i + 1; });
  }
  return ch;
}
// 화면에 보낼 모양 (통·시각 같은 속 내용은 빼고)
export function view(room, now = Date.now()) {
  return {
    phase: room.phase, host: room.host, startAt: room.startAt, endAt: room.endAt, ai: room.ai, round: room.round, now, len: LEN,
    players: room.players.map((p) => ({ id: p.id, name: p.name, emoji: p.emoji, mid: p.mid || '', child: !!p.child, ai: !!p.ai, level: p.level || '', seed: p.ai ? p.seed : 0,
      taps: Math.round(p.taps * 10) / 10, fin: p.fin ? p.fin - room.startAt : 0, place: p.place || 0, gone: !!p.gone })),
  };
}
// 끝난 판의 순위표
export function results(room) {
  return room.players.slice().sort((a, b) => (a.place || 99) - (b.place || 99));
}
