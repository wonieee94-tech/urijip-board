// 가족 데이터 규칙: Cloudflare 함수(functions/api/family.js)와 내 PC 테스트 서버(dev-server.mjs)가 함께 쓴다.
// store는 { get(key), set(key, value, { ttl }), del(key) } 형태 (ttl은 초, 없으면 영구)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32자 → 난수 % 32 에 치우침이 없다
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
export const MAX = { members: 12, events: 400, routines: 30, notes: 60, keepDays: 60, stamps: 60, reviewPerKind: 40 };
export const GOAL = 30;
export const SUBJECTS = ['han', 'math', 'times', 'abc'];
export const KINDS = ['quiz', 'detective', 'vgame', 'write', 'add10', 'sub10', 'add20', 'sub20', 'tquiz', 'first', 'build'];
export const PASS_RATE = 0.75; // 8문제 중 6개
const PIN_LOCK = { tries: 5, minutes: 5 };
const TRASH_DAYS = 30;
const CREATE_PER_HOUR = 10;
const SKINS = ['airport', 'stationery', 'yellow', 'dots', 'stars', 'stripes', 'pastel', 'sweet'];
const STATES = ['home', 'out', 'coming', 'school', 'work'];
const REPEATS = ['none', 'weekly', 'yearly'];
const PROTECTED = new Set(['deleteFamily', 'delMember', 'setPin', 'clearPin']);

const rnd = (n) => crypto.getRandomValues(new Uint32Array(n));
const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const id = () => [...rnd(8)].map((x) => ID_CHARS[x % 36]).join('');
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || '');
const int = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
const ymdUTC = (t) => new Date(t).toISOString().slice(0, 10);

export function genCode() {
  const s = [...rnd(8)].map((x) => CODE_CHARS[x % 32]).join('');
  return s.slice(0, 4) + '-' + s.slice(4);
}
export const validCode = (c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c || '');

// 기기 시계와 시간대(한국 UTC+9 등) 차이를 감안해 '오늘' 앞뒤 하루씩만 받는다
export function nearToday(s, now = Date.now()) {
  if (!isDate(s)) return false;
  return s >= ymdUTC(now - 2 * 864e5) && s <= ymdUTC(now + 2 * 864e5);
}
function needDate(s, now) { if (!nearToday(s, now)) throw new Error('날짜가 올바르지 않아요'); }

function member(p) {
  return { id: id(), name: clip(p.name, 12) || '가족', emoji: clip(p.emoji, 8) || '🙂', role: p.role === 'child' ? 'child' : 'adult' };
}

export function newFamily(p = {}) {
  const members = (Array.isArray(p.members) ? p.members : []).slice(0, MAX.members).map(member);
  const child = members.find((m) => m.role === 'child');
  const routines = [
    ['🪥', '양치하기'], ['🎒', '가방 챙기기'], ['📚', '책 읽기'], ['🧸', '장난감 정리'], ['🛁', '씻기'],
  ].map(([emoji, title]) => ({ id: id(), emoji, title, days: [0, 1, 2, 3, 4, 5, 6], who: child?.id || '' }));
  return norm({
    name: clip(p.name, 20) || '우리집', members, status: {}, events: [], routines, checks: {}, notes: [], study: {},
    stickers: { board: [], gift: '', history: [], total: 0 },
    rev: 1, created: Date.now(), updated: Date.now(),
  });
}

// 예전 데이터에도 새 칸을 채워 준다 (지우는 것은 없다)
export function norm(doc) {
  doc.status ||= {}; doc.events ||= []; doc.routines ||= []; doc.checks ||= {}; doc.notes ||= []; doc.study ||= {};
  const st = (doc.stickers ||= { board: [], gift: '', history: [] });
  st.board ||= []; st.history ||= []; st.gift ??= '';
  if (typeof st.total !== 'number') st.total = st.history.length * GOAL + st.board.length;
  doc.learn ||= {}; doc.review ||= {}; doc.goal ||= { subjects: 2 };
  const tr = (doc.travel ||= {});
  tr.stamps ||= []; tr.stars ||= 0; tr.best ||= {}; tr.ok ||= 0;
  doc.seen ||= [];
  return doc;
}

function cleanEvent(e) {
  if (!e || !isDate(e.date)) throw new Error('날짜가 필요해요');
  const title = clip(e.title, 40);
  if (!title) throw new Error('일정 이름이 필요해요');
  return {
    id: e.id && /^[a-z0-9]{4,12}$/.test(e.id) ? e.id : id(),
    title, emoji: clip(e.emoji, 8), date: e.date,
    endDate: isDate(e.endDate) && e.endDate > e.date ? e.endDate : '',
    time: isTime(e.time) ? e.time : '', endTime: isTime(e.endTime) ? e.endTime : '',
    repeat: REPEATS.includes(e.repeat) ? e.repeat : 'none',
    who: Array.isArray(e.who) ? e.who.slice(0, MAX.members).map((x) => clip(x, 12)) : ['all'],
    pickup: clip(e.pickup, 12), bring: clip(e.bring, 60),
  };
}

function prune(doc, now = Date.now()) {
  const cut = ymdUTC(now - MAX.keepDays * 864e5);
  for (const box of [doc.checks, doc.study, doc.learn]) for (const k of Object.keys(box)) if (k < cut) delete box[k];
}

function giveSticker(doc, date, subject, now) {
  const st = doc.stickers;
  if (st.board.some((x) => x.date === date && x.subject === subject)) return 'had';
  if (st.board.length >= GOAL) return 'full';
  st.board.push({ date, subject, at: now }); st.total++;
  return 'added';
}
export const passed = (right, total) => total >= 4 && right >= Math.ceil(total * PASS_RATE);

function keysOf(a, n = 12) { return (Array.isArray(a) ? a : []).slice(0, n).map((k) => clip(k, 24)).filter(Boolean); }

function finishRound(doc, p, now) {
  needDate(p.date, now);
  const total = int(p.total, 1, 12), right = int(p.right, 0, total), stars = int(p.stars, 0, total);
  doc.study[p.date] = (doc.study[p.date] || 0) + stars;
  // 과목별 맞힌 수 / 푼 수
  const day = (doc.learn[p.date] ||= {});
  const tally = p.tally && typeof p.tally === 'object' ? p.tally : (SUBJECTS.includes(p.subject) ? { [p.subject]: [right, total] } : {});
  let sumT = 0;
  for (const [s, v] of Object.entries(tally)) {
    if (!SUBJECTS.includes(s) || !Array.isArray(v)) continue;
    const t = int(v[1], 0, 12), r = int(v[0], 0, t); if (sumT + t > 12) break; sumT += t;
    const x = (day[s] ||= { r: 0, t: 0, n: 0 }); x.r += r; x.t += t; x.n += 1;
  }
  // 틀린 문제 줄: 틀리면 줄에 서고(at = 줄 선 때), 다시 맞히면 바로 빠진다. 다음 판은 줄 앞(오래된 것)부터 먼저 낸다.
  // (t는 지금까지 틀린 횟수. 예전 기록의 n 2~3 이나 n 0 도 그대로 읽힘)
  const kind = KINDS.includes(p.kind) ? p.kind : '';
  for (const m of Array.isArray(p.fixed) ? p.fixed.slice(0, 12) : []) {
    const k = KINDS.includes(m?.kind) ? m.kind : kind, key = clip(m?.key ?? m, 24);
    if (doc.review[k]?.[key]) delete doc.review[k][key];
  }
  (Array.isArray(p.missed) ? p.missed.slice(0, 12) : []).forEach((m, i) => {
    const k = KINDS.includes(m?.kind) ? m.kind : kind, key = clip(m?.key ?? m, 24);
    if (!k || !key) return;
    const e = ((doc.review[k] ||= {})[key] ||= { n: 0, t: 0, at: now + i });
    if (!(e.n > 0)) e.at = now + i; // 같은 판 안에서는 푼 순서대로 줄 선다
    e.n = Math.max(1, e.n); e.t = (e.t || 0) + 1;
  });
  for (const k of Object.keys(doc.review)) {
    const ent = Object.entries(doc.review[k]);
    if (ent.length > MAX.reviewPerKind) { // 줄에 선 것 먼저, 그중 오래된 것부터 남긴다
      ent.sort((a, b) => ((b[1].n > 0) - (a[1].n > 0)) || (a[1].at - b[1].at));
      doc.review[k] = Object.fromEntries(ent.slice(0, MAX.reviewPerKind));
    }
  }
  // 포도알: 복습판이 아니고, 4문제 이상 중 75% 이상 맞혔을 때만
  let award = 'none';
  if (SUBJECTS.includes(p.subject) && !p.review) award = passed(right, total) ? giveSticker(doc, p.date, p.subject, now) : 'low';
  doc.lastRound = { id: clip(p.roundId, 24), award, right, total, stars };
}

export function apply(doc, op, p = {}, now = Date.now()) {
  norm(doc);
  const findM = (mid) => doc.members.find((m) => m.id === mid);
  const st = doc.stickers;
  switch (op) {
    case 'addSticker': { // 예전 공부방 화면용 (새 화면은 finishRound)
      needDate(p.date, now); if (!SUBJECTS.includes(p.subject)) throw new Error('스티커 정보가 올바르지 않아요');
      giveSticker(doc, p.date, p.subject, now); break; }
    case 'finishRound': finishRound(doc, p, now); break;
    case 'setGift': st.gift = clip(p.gift, 30); break;
    case 'setGoal': doc.goal = { subjects: int(p.subjects, 1, 4) }; break;
    case 'setSkin':
      if (!SKINS.includes(p.skin)) throw new Error('없는 배경이에요');
      doc.skin = p.skin; break;
    case 'claimGift':
      if (st.board.length < GOAL) throw new Error(`포도알 ${GOAL}개를 다 채워야 해요`);
      st.history.unshift({ gift: st.gift, at: now }); st.history = st.history.slice(0, 20); st.board = []; break;
    case 'setName': doc.name = clip(p.name, 20) || doc.name; break;
    case 'addMember':
      if (doc.members.length >= MAX.members) throw new Error('가족은 12명까지예요');
      doc.members.push(member(p)); break;
    case 'updMember': { const m = findM(p.id); if (!m) throw new Error('없는 가족이에요');
      Object.assign(m, { name: clip(p.name, 12) || m.name, emoji: clip(p.emoji, 8) || m.emoji, role: p.role === 'child' ? 'child' : 'adult' }); break; }
    case 'delMember': doc.members = doc.members.filter((m) => m.id !== p.id); delete doc.status[p.id]; break;
    case 'setStatus': { if (!findM(p.id)) throw new Error('없는 가족이에요');
      doc.status[p.id] = { state: STATES.includes(p.state) ? p.state : 'home', eta: isTime(p.eta) ? p.eta : '', note: clip(p.note, 30), at: now }; break; }
    case 'addEvent':
      if (doc.events.length >= MAX.events) throw new Error('일정이 너무 많아요. 지난 일정을 지워 주세요');
      doc.events.push(cleanEvent(p)); break;
    case 'updEvent': { const ev = cleanEvent(p); const i = doc.events.findIndex((x) => x.id === ev.id);
      if (i < 0) throw new Error('없는 일정이에요'); doc.events[i] = ev; break; }
    case 'delEvent': doc.events = doc.events.filter((x) => x.id !== p.id); break;
    case 'addRoutine': {
      if (doc.routines.length >= MAX.routines) throw new Error('루틴은 30개까지예요');
      const title = clip(p.title, 24); if (!title) throw new Error('루틴 이름이 필요해요');
      const days = Array.isArray(p.days) ? [...new Set(p.days.map(Number).filter((d) => d >= 0 && d <= 6))] : [];
      doc.routines.push({ id: id(), emoji: clip(p.emoji, 8) || '⭐', title, days: days.length ? days : [0, 1, 2, 3, 4, 5, 6], who: clip(p.who, 12) });
      break; }
    case 'delRoutine': doc.routines = doc.routines.filter((r) => r.id !== p.id); break;
    case 'toggleCheck': { needDate(p.date, now);
      if (!doc.routines.some((r) => r.id === p.rid)) throw new Error('없는 루틴이에요');
      const day = (doc.checks[p.date] ||= {}); if (day[p.rid]) delete day[p.rid]; else day[p.rid] = now; break; }
    case 'addNote': { const text = clip(p.text, 120); if (!text) throw new Error('내용을 적어 주세요');
      doc.notes.unshift({ id: id(), from: clip(p.from, 12), text, kid: !!p.kid, at: now });
      doc.notes = doc.notes.slice(0, MAX.notes); break; }
    case 'delNote': doc.notes = doc.notes.filter((n) => n.id !== p.id); break;
    case 'addStars': { needDate(p.date, now); // 예전 화면용
      doc.study[p.date] = (doc.study[p.date] || 0) + int(p.n, 0, 5); break; }
    case 'addTrip': { // 여행 도착: 여권 도장 + 여행 별
      const code = clip(p.code, 3).toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) throw new Error('공항 코드가 올바르지 않아요');
      const tr = doc.travel;
      tr.stamps.unshift({ code, nm: clip(p.nm, 12), date: clip(p.date, 5), at: now }); tr.stamps = tr.stamps.slice(0, MAX.stamps);
      tr.stars += int(p.stars, 0, 60); tr.ok++; break; }
    case 'gameResult': { // 이착륙·지도 퀴즈 결과
      const key = clip(p.key, 20); if (!/^[a-z0-9-]+$/.test(key)) throw new Error('놀이 이름이 올바르지 않아요');
      const tr = doc.travel, score = int(p.score, 0, 100);
      if (score > (tr.best[key] || 0)) tr.best[key] = score;
      if (p.ok) tr.ok++; tr.stars += int(p.stars, 0, 20); break; }
    default: throw new Error('모르는 요청이에요');
  }
  prune(doc, now);
  doc.rev = (doc.rev || 0) + 1; doc.updated = now;
  return doc;
}

// 화면으로 보내는 모양: PIN 정보는 빼고 PIN이 있는지만 알려 준다
export function publicDoc(doc) {
  const { pin, pinFail, seen, ...rest } = doc;
  return { ...rest, hasPin: !!pin };
}

/* ---------- 부모 PIN ---------- */
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  let h = await crypto.subtle.digest('SHA-256', data);
  for (let i = 0; i < 999; i++) h = await crypto.subtle.digest('SHA-256', h); // 조금 느리게
  return hex(h);
}
export const validPin = (s) => /^\d{4,6}$/.test(String(s ?? ''));
async function makePin(pin) { const salt = hex(rnd(4).buffer); return { salt, hash: await hashPin(pin, salt) }; }
// PIN이 없으면 통과. 틀리면 기록하고, 5번 틀리면 5분 동안 잠근다
async function checkPin(doc, pin, now) {
  if (!doc.pin) return { ok: true };
  const f = doc.pinFail || { n: 0, until: 0 };
  if (f.until > now) return { ok: false, locked: true, error: `PIN을 여러 번 틀려서 ${Math.ceil((f.until - now) / 60000)}분 뒤에 다시 할 수 있어요` };
  if (validPin(pin) && (await hashPin(pin, doc.pin.salt)) === doc.pin.hash) { doc.pinFail = { n: 0, until: 0 }; return { ok: true }; }
  f.n = (f.n || 0) + 1; if (f.n >= PIN_LOCK.tries) { f.until = now + PIN_LOCK.minutes * 60000; f.n = 0; }
  doc.pinFail = f;
  return { ok: false, error: 'PIN이 맞지 않아요' };
}

/* ---------- 요청 처리 ---------- */
export async function handle(method, url, body, store, meta = {}) {
  const now = meta.now || Date.now();
  const json = (data, status = 200) => ({ status, data });
  try {
    if (method === 'GET') {
      const code = new URL(url).searchParams.get('code');
      if (!validCode(code)) return json({ error: '가족 코드가 올바르지 않아요' }, 400);
      const doc = await store.get('f:' + code);
      return doc ? json(publicDoc(norm(doc))) : json({ error: '이 코드의 가족을 찾을 수 없어요' }, 404);
    }
    if (method !== 'POST') return json({ error: 'not allowed' }, 405);
    const { code, op, p = {}, pin } = body || {};
    if (op === 'create') {
      // 한 곳(IP)에서 한 시간에 너무 많이 만들지 못하게
      if (meta.ip) {
        const rk = `rl:create:${meta.ip}:${Math.floor(now / 3600e3)}`, n = (await store.get(rk)) || 0;
        if (n >= CREATE_PER_HOUR) return json({ error: '잠시 뒤에 다시 만들어 주세요' }, 429);
        await store.set(rk, n + 1, { ttl: 7200 });
      }
      let c; do { c = genCode(); } while (await store.get('f:' + c));
      const doc = newFamily(p); await store.set('f:' + c, doc);
      return json({ code: c, doc: publicDoc(doc) });
    }
    if (!validCode(code)) return json({ error: '가족 코드가 올바르지 않아요' }, 400);
    if (op === 'restoreFamily') {
      const t = await store.get('trash:' + code);
      if (!t) return json({ error: '되살릴 보드가 없어요 (30일이 지나면 완전히 지워져요)' }, 404);
      if (await store.get('f:' + code)) return json({ error: '이 코드의 보드가 이미 있어요' }, 409);
      const chk = await checkPin(t.doc, pin, now);
      if (!chk.ok) { await store.set('trash:' + code, t, { ttl: TRASH_DAYS * 86400 }); return json({ error: chk.error }, chk.locked ? 429 : 403); }
      t.doc.rev = (t.doc.rev || 0) + 1; await store.set('f:' + code, t.doc); await store.del('trash:' + code);
      return json(publicDoc(norm(t.doc)));
    }
    // 같은 순간 두 기기가 고쳐도 한쪽이 사라지지 않게: 쓰기 직전에 다시 읽어 rev가 바뀌었으면 새 문서에 다시 적용한다
    for (let attempt = 0; ; attempt++) {
      const doc = await store.get('f:' + code);
      if (!doc) return json({ error: '이 코드의 가족을 찾을 수 없어요' }, 404);
      norm(doc);
      const base = doc.rev;
      if (op === 'checkPin' || PROTECTED.has(op)) {
        const hadFail = !!doc.pinFail?.n;
        const chk = await checkPin(doc, pin, now);
        if (!chk.ok) { if (!chk.locked) await store.set('f:' + code, doc); return json({ error: chk.error }, chk.locked ? 429 : 403); }
        if (op === 'checkPin') { if (hadFail) await store.set('f:' + code, doc); return json({ ok: true, hasPin: !!doc.pin }); }
      }
      if (op === 'deleteFamily') {
        await store.set('trash:' + code, { doc, at: now }, { ttl: TRASH_DAYS * 86400 });
        await store.del('f:' + code);
        return json({ deleted: true, restoreDays: TRASH_DAYS });
      }
      // 같은 판 결과를 두 번 보내도 한 번만 센다
      const rid = clip(p.roundId, 24);
      if (rid && doc.seen.includes(rid)) return json(publicDoc(doc));
      if (op === 'setPin') {
        if (!validPin(p.newPin)) throw new Error('PIN은 숫자 4~6자리예요');
        doc.pin = await makePin(String(p.newPin)); doc.pinFail = { n: 0, until: 0 };
        doc.rev = (doc.rev || 0) + 1; doc.updated = now;
      } else if (op === 'clearPin') {
        delete doc.pin; delete doc.pinFail; doc.rev = (doc.rev || 0) + 1; doc.updated = now;
      } else apply(doc, op, p, now);
      if (rid) doc.seen = [rid, ...doc.seen].slice(0, 40);
      const latest = await store.get('f:' + code);
      if (latest && latest.rev !== base && attempt < 2) continue;
      await store.set('f:' + code, doc);
      return json(publicDoc(doc));
    }
  } catch (e) {
    return json({ error: e.message || '처리하지 못했어요' }, 400);
  }
}
