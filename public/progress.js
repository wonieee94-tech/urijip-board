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
  // 다시 풀 문제: [{kind, key, n, t}] 많이 틀린 순
  const reviewList = (doc) => Object.entries(doc.review || {}).flatMap(([kind, m]) => Object.entries(m).map(([key, v]) => ({ kind, key, ...v })));
  return { KIND, SUBJ_OF, streak, doneToday, lastDays, reviewList, ymd };
})();
