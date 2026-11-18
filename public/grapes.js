// 포도송이 칭찬 스티커판 (30알). 우리집 보드와 공부방이 함께 쓴다.
window.Grapes = (() => {
  const GOAL = 30;
  const SUBJ = {
    han: { name: '한글', mark: '가' },
    math: { name: '셈하기', mark: '+' },
    times: { name: '구구단', mark: '×' },
    abc: { name: '파닉스', mark: 'A' },
  };
  // 위에서부터 8,7,6,5,3,1알 = 30알
  const ROWS = [8, 7, 6, 5, 3, 1];
  const R = 19, DX = 40, DY = 35;
  const spots = [];
  ROWS.forEach((n, r) => { for (let i = 0; i < n; i++) spots.push({ x: (i - (n - 1) / 2) * DX + (r % 2 ? 0 : 0), y: 60 + r * DY }); });

  function svg(board, newIndex = -1) {
    const dots = spots.map((p, i) => {
      const s = board[i];
      return `<circle class="g${s ? ' on' : ''}${i === newIndex ? ' new' : ''}" cx="${p.x}" cy="${p.y}" r="${R}"></circle>` +
        (s ? `<text x="${p.x}" y="${p.y}">${SUBJ[s.subject]?.mark || '★'}</text>` : '');
    }).join('');
    return `<svg class="grapes" viewBox="-175 -5 350 260" role="img" aria-label="포도알 ${board.length}개 / ${GOAL}개">
      <path class="stem" d="M0 40 C 2 20, 8 10, 18 2"></path>
      <path class="leaf" d="M14 14 C 40 -6, 78 4, 92 22 C 64 34, 34 32, 14 14 Z"></path>
      ${dots}</svg>`;
  }
  return { GOAL, SUBJ, svg };
})();
