// 공부 기록 계산: 우리집 보드(공부 탭)와 공부방이 함께 쓴다.
window.Progress = (() => {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const KIND = { quiz: '이사 퀴즈', detective: '받침 탐정', vgame: 'ㅔ일까 ㅐ일까', write: '받아쓰기', add10: '10까지 덧셈', sub10: '10까지 뺄셈',
    add20: '10 만들기 덧셈', sub20: '10 넘는 뺄셈', tquiz: '구구단', first: '첫소리 찾기', build: '낱말 만들기' };
  const SUBJ_OF = { quiz: 'han', detective: 'han', vgame: 'han', write: 'han', add10: 'math', sub10: 'math', add20: 'math', sub20: 'math', tquiz: 'times', first: 'abc', build: 'abc' };
  const studied = (doc, day) => (doc.study?.[day] || 0) > 0 || Object.values(doc.learn?.[day] || {}).some((x) => x.n > 0);
  // 오늘(아직 안 했으면 어제)부터 거꾸로 하루도 안 빠지고 공부한 날 수
  function streak(doc, now = new Date()) {
    let d = new Date(now.getFullYear(), now.getMonth(), now.getDate()), n = 0;
    if (!studied(doc, ymd(d))) d.setDate(d.getDate() - 1);
    while (studied(doc, ymd(d)) && n < 400) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  // 오늘 한 판 이상 푼 과목
  const doneToday = (doc, now = new Date()) => Object.entries(doc.learn?.[ymd(now)] || {}).filter(([, x]) => x.n > 0).map(([k]) => k);
  // 최근 n일 날짜 목록 (오래된 날부터)
  const lastDays = (n = 7, now = new Date()) => [...Array(n)].map((_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - n + 1 + i); return { d, s: ymd(d) }; });
  // 틀린 문제 줄: 놀이(kind)마다 doc.review[kind][key] = {n, t, at}. n>0 이면 아직 다시 맞히지 못한 문제, at 은 줄에 선 때.
  // 서버 lib/family.mjs 의 finishRound 와 같은 규칙 (가족 코드 없이 쓸 때, 저장 전에 바로 다음 판에 넣을 때 씀)
  function applyReview(review, kind, missed = [], fixed = [], now = Date.now()) {
    for (const m of fixed) { const k = m.kind || kind, e = review[k]?.[m.key]; if (e) delete review[k][m.key]; } // 맞히면 줄에서 빠짐
    missed.forEach((m, i) => {
      const k = m.kind || kind, e = ((review[k] ||= {})[m.key] ||= { n: 0, t: 0, at: now + i });
      if (!(e.n > 0)) e.at = now + i; // 새로 줄 서면 맨 뒤 (같은 판 안에서는 푼 순서대로)
      e.n = Math.max(1, e.n); e.t = (e.t || 0) + 1;
    });
    return review;
  }
  // 이 놀이에서 다시 낼 문제 key 목록 (먼저 틀린 것부터)
  const queueOf = (doc, kind) => Object.entries(doc?.review?.[kind] || {}).filter(([, v]) => (v.n || 0) > 0)
    .sort((a, b) => (a[1].at || 0) - (b[1].at || 0) || (a[0] < b[0] ? -1 : 1)).map(([key]) => key);
  // 다음 판 만들기: 틀린 문제를 먼저(오래된 것부터 size 개까지, 남는 것은 다음 판으로), 나머지는 새 문제로 채운다
  function planRound(queue, resolve, fresh, keyOf, size = 8) {
    const out = [], used = new Set();
    for (const key of queue) { if (out.length >= size) break; const q = resolve(key); if (q && !used.has(key)) { used.add(key); out.push({ q, again: true }); } }
    for (const q of fresh) { if (out.length >= size) break; const key = keyOf(q); if (!used.has(key)) { used.add(key); out.push({ q, again: false }); } }
    for (const q of fresh) { if (out.length >= size) break; if (!queue.includes(keyOf(q))) out.push({ q, again: false }); } // 문제 수가 모자라면 겹쳐도 채움
    return out;
  }
  return { KIND, SUBJ_OF, streak, doneToday, lastDays, applyReview, queueOf, planRound, ymd };
})();
