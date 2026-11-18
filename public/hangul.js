// 한글 글자 조합 도구: 공부방(study.html)이 쓰고, test/hangul.test.mjs가 검사한다.
(function (g) {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
  function dec(ch) { if (!ch) return null; const c = ch.charCodeAt(0) - 0xAC00; if (c < 0 || c > 11171) return null; return { cho: Math.floor(c / 588), jung: Math.floor(c % 588 / 28), jong: c % 28 }; }
  function comp(cho, jung, jong) { return String.fromCharCode(0xAC00 + cho * 588 + jung * 28 + jong); }
  // 받침 번호 → [앞 글자에 남는 받침, 뒤 글자로 이사 가는 첫소리(-1이면 없음)]
  const MOVE = { 1: [0, 0], 2: [0, 1], 3: [1, 10], 4: [0, 2], 5: [4, 12], 6: [4, -1], 7: [0, 3], 8: [0, 5], 9: [8, 0], 10: [8, 6], 11: [8, 7], 12: [8, 10], 13: [8, 16], 14: [8, 17], 15: [8, -1], 16: [0, 6], 17: [0, 7], 18: [17, 10], 19: [0, 9], 20: [0, 10], 22: [0, 12], 23: [0, 14], 24: [0, 15], 25: [0, 16], 26: [0, 17], 27: [0, -1] };
  // 소리 나는 대로: 받침 뒤에 ㅇ으로 시작하는 글자가 오면 받침이 이사 간다 (연음)
  function soundOf(s) {
    const a = [...s];
    for (let i = 0; i < a.length - 1; i++) {
      const d = dec(a[i]), n = dec(a[i + 1]);
      if (d && n && d.jong && n.cho === 11 && MOVE[d.jong]) { const [r, m] = MOVE[d.jong]; a[i] = comp(d.cho, d.jung, r); if (m >= 0) a[i + 1] = comp(m, n.jung, n.jong); }
    }
    return a.join('');
  }
  function movedOf(w) { const d = dec(w[w.length - 1]); const mv = MOVE[d.jong]; return { base: comp(d.cho, d.jung, mv[0]), chip: mv[1] >= 0 ? CHO[mv[1]] : '', d }; }
  // 숫자 뒤 조사: 2(이) 4(사) 5(오) 9(구)로 끝나면 받침이 없다
  const VOW_END = (n) => [2, 4, 5, 9].includes(Math.abs(n) % 10);
  const eun = (n) => VOW_END(n) ? '는' : '은', eul = (n) => VOW_END(n) ? '를' : '을', rang = (n) => VOW_END(n) ? '랑' : '이랑';
  // ㄹ 받침(1 일, 7 칠, 8 팔)과 받침 없는 수는 '로', 나머지는 '으로'
  const ro = (n) => [3, 6, 0].includes(Math.abs(n) % 10) ? '으로' : '로';
  g.Hangul = { CHO, JONG, dec, comp, MOVE, soundOf, movedOf, VOW_END, eun, eul, rang, ro };
})(typeof window !== 'undefined' ? window : globalThis);
