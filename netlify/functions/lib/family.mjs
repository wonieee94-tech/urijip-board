// 가족 데이터 규칙: 서버(Netlify 함수)와 내 PC 테스트 서버가 함께 쓴다.
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const MAX = { members: 12, events: 400, routines: 30, notes: 60, keepDays: 60 };

const clip = (s, n) => String(s ?? '').trim().slice(0, n);
const id = () => Math.random().toString(36).slice(2, 10);
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const isTime = (s) => /^\d{2}:\d{2}$/.test(s || '');
const STATES = ['home', 'out', 'coming', 'school', 'work'];
const REPEATS = ['none', 'weekly', 'yearly'];

export function genCode() {
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return s.slice(0, 4) + '-' + s.slice(4);
}
export const validCode = (c) => /^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(c || '');

function member(p) {
  return { id: id(), name: clip(p.name, 12) || '가족', emoji: clip(p.emoji, 8) || '🙂', role: p.role === 'child' ? 'child' : 'adult' };
}

export function newFamily(p = {}) {
  const members = (Array.isArray(p.members) ? p.members : []).slice(0, MAX.members).map(member);
  const child = members.find((m) => m.role === 'child');
  const routines = [
    ['🪥', '양치하기'], ['🎒', '가방 챙기기'], ['📚', '책 읽기'], ['🧸', '장난감 정리'], ['🛁', '씻기'],
  ].map(([emoji, title]) => ({ id: id(), emoji, title, days: [0, 1, 2, 3, 4, 5, 6], who: child?.id || '' }));
  return {
    name: clip(p.name, 20) || '우리집', members, status: {}, events: [], routines, checks: {}, notes: [], study: {},
    stickers: { board: [], gift: '', history: [] },
    rev: 1, created: Date.now(), updated: Date.now(),
  };
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

function prune(doc) {
  const cut = new Date(Date.now() - MAX.keepDays * 864e5).toISOString().slice(0, 10);
  for (const k of Object.keys(doc.checks)) if (k < cut) delete doc.checks[k];
  for (const k of Object.keys(doc.study)) if (k < cut) delete doc.study[k];
}

export const GOAL = 30;
const SUBJECTS = ['han', 'math', 'times', 'abc'];

export function apply(doc, op, p = {}) {
  const findM = (mid) => doc.members.find((m) => m.id === mid);
  const st = (doc.stickers ||= { board: [], gift: '', history: [] });
  switch (op) {
    case 'addSticker': {
      if (!isDate(p.date) || !SUBJECTS.includes(p.subject)) throw new Error('스티커 정보가 올바르지 않아요');
      if (st.board.length < GOAL && !st.board.some((x) => x.date === p.date && x.subject === p.subject))
        st.board.push({ date: p.date, subject: p.subject, at: Date.now() });
      break; }
    case 'setGift': st.gift = clip(p.gift, 30); break;
    case 'setSkin':
      if (!['airport', 'stationery', 'yellow', 'dots', 'stars', 'stripes', 'pastel', 'sweet'].includes(p.skin)) throw new Error('없는 배경이에요');
      doc.skin = p.skin; break;
    case 'claimGift':
      if (st.board.length < GOAL) throw new Error(`포도알 ${GOAL}개를 다 채워야 해요`);
      st.history.unshift({ gift: st.gift, at: Date.now() }); st.history = st.history.slice(0, 20); st.board = []; break;
    case 'setName': doc.name = clip(p.name, 20) || doc.name; break;
    case 'addMember':
      if (doc.members.length >= MAX.members) throw new Error('가족은 12명까지예요');
      doc.members.push(member(p)); break;
    case 'updMember': { const m = findM(p.id); if (!m) throw new Error('없는 가족이에요');
      Object.assign(m, { name: clip(p.name, 12) || m.name, emoji: clip(p.emoji, 8) || m.emoji, role: p.role === 'child' ? 'child' : 'adult' }); break; }
    case 'delMember': doc.members = doc.members.filter((m) => m.id !== p.id); delete doc.status[p.id]; break;
    case 'setStatus': { if (!findM(p.id)) throw new Error('없는 가족이에요');
      doc.status[p.id] = { state: STATES.includes(p.state) ? p.state : 'home', eta: isTime(p.eta) ? p.eta : '', note: clip(p.note, 30), at: Date.now() }; break; }
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
    case 'toggleCheck': { if (!isDate(p.date)) throw new Error('날짜가 필요해요');
      const day = (doc.checks[p.date] ||= {}); if (day[p.rid]) delete day[p.rid]; else day[p.rid] = Date.now(); break; }
    case 'addNote': { const text = clip(p.text, 120); if (!text) throw new Error('내용을 적어 주세요');
      doc.notes.unshift({ id: id(), from: clip(p.from, 12), text, kid: !!p.kid, at: Date.now() });
      doc.notes = doc.notes.slice(0, MAX.notes); break; }
    case 'delNote': doc.notes = doc.notes.filter((n) => n.id !== p.id); break;
    case 'addStars': { if (!isDate(p.date)) throw new Error('날짜가 필요해요');
      const n = Math.max(0, Math.min(5, Number(p.n) || 0)); doc.study[p.date] = (doc.study[p.date] || 0) + n; break; }
    default: throw new Error('모르는 요청이에요');
  }
  prune(doc);
  doc.rev = (doc.rev || 0) + 1; doc.updated = Date.now();
  return doc;
}

// 요청 처리: store는 { get(key), set(key, value), del(key) } 형태
export async function handle(method, url, body, store) {
  const json = (data, status = 200) => ({ status, data });
  try {
    if (method === 'GET') {
      const code = new URL(url).searchParams.get('code');
      if (!validCode(code)) return json({ error: '가족 코드가 올바르지 않아요' }, 400);
      const doc = await store.get('f:' + code);
      return doc ? json(doc) : json({ error: '이 코드의 가족을 찾을 수 없어요' }, 404);
    }
    if (method !== 'POST') return json({ error: 'not allowed' }, 405);
    const { code, op, p } = body || {};
    if (op === 'create') {
      let c; do { c = genCode(); } while (await store.get('f:' + c));
      const doc = newFamily(p); await store.set('f:' + c, doc);
      return json({ code: c, doc });
    }
    if (!validCode(code)) return json({ error: '가족 코드가 올바르지 않아요' }, 400);
    const doc = await store.get('f:' + code);
    if (!doc) return json({ error: '이 코드의 가족을 찾을 수 없어요' }, 404);
    if (op === 'deleteFamily') { await store.del('f:' + code); return json({ deleted: true }); }
    apply(doc, op, p);
    await store.set('f:' + code, doc);
    return json(doc);
  } catch (e) {
    return json({ error: e.message || '처리하지 못했어요' }, 400);
  }
}
