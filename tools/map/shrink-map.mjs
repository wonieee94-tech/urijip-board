// public/world-map.js 를 가볍게 만든다 (의존성 없음).
// 1) 같은 줄 위의 점·아주 작은 굴곡을 줄이고(더글러스-포커, 기본 0.6px)
// 2) 아주 작은 섬(넓이 < 2px²)은 빼고  3) 좌표를 상대 좌표(m/l)로 짧게 적는다.
// 사용: node tools/map/shrink-map.mjs [입력=public/world-map.js] [출력=입력] [허용오차=0.6]
import fs from 'node:fs';

const src = process.argv[2] || 'public/world-map.js';
const out = process.argv[3] || src;
const EPS = Number(process.argv[4] || 0.6);

const text = fs.readFileSync(src, 'utf8');
const json = text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1);
const W = JSON.parse(json);

// 절대 좌표(M/L/Z) 또는 이미 줄인 상대 좌표(m/l/z) 경로를 고리 목록으로 읽는다
function rings(d) {
  const res = []; let cur = null, x = 0, y = 0, sx = 0, sy = 0, cmd = 'M';
  const tok = d.match(/[MLZmlz]|-?\d*\.?\d+/g) || [];
  for (let i = 0; i < tok.length;) {
    const t = tok[i];
    if (/[MLZmlz]/.test(t)) { cmd = t; i++; if (t === 'Z' || t === 'z') { if (cur) res.push(cur); cur = null; x = sx; y = sy; } continue; }
    const a = +tok[i], b = +tok[i + 1]; i += 2;
    if (cmd === 'M' || cmd === 'm') {
      if (cur) res.push(cur);
      if (cmd === 'm') { x += a; y += b; } else { x = a; y = b; }
      sx = x; sy = y; cur = [[x, y]]; cmd = cmd === 'M' ? 'L' : 'l';
    } else if (cmd === 'L') { x = a; y = b; cur.push([x, y]); }
    else { x += a; y += b; cur.push([x, y]); }
  }
  if (cur) res.push(cur);
  return res;
}
function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [a, b] = st.pop(); const [x1, y1] = pts[a], [x2, y2] = pts[b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    let md = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = L === 1 && dx === 0 && dy === 0 ? Math.hypot(pts[i][0] - x1, pts[i][1] - y1) : Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L;
      if (d > md) { md = d; mi = i; }
    }
    if (md > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const area = (p) => Math.abs(p.reduce((s, [x, y], i) => { const [u, v] = p[(i + 1) % p.length]; return s + x * v - u * y; }, 0)) / 2;

let before = 0, after = 0;
W.paths = W.paths.map(([d, c, id]) => {
  before += d.length;
  let rs = rings(d).map((r) => {
    // 시작점으로 돌아오는 점은 떼고, 가장 먼 두 점으로 나눠 단순화 (고리 모양 유지)
    if (r.length > 1 && r[0][0] === r.at(-1)[0] && r[0][1] === r.at(-1)[1]) r = r.slice(0, -1);
    if (r.length < 4) return r;
    let far = 0, fd = -1; for (let i = 1; i < r.length; i++) { const dd = (r[i][0] - r[0][0]) ** 2 + (r[i][1] - r[0][1]) ** 2; if (dd > fd) { fd = dd; far = i; } }
    const a = dp(r.slice(0, far + 1), EPS), b = dp([...r.slice(far), r[0]], EPS);
    return [...a, ...b.slice(1, -1)];
  });
  const big = rs.filter((r) => r.length >= 3 && area(r) >= 2);
  rs = big.length ? big : [rs.sort((p, q) => area(q) - area(p))[0]];
  let s = '', px = 0, py = 0, first = true;
  for (const r of rs) {
    const [x0, y0] = r[0];
    s += first ? `M${x0},${y0}` : `m${x0 - px},${y0 - py}`; first = false;
    let lx = x0, ly = y0, parts = [];
    for (let i = 1; i < r.length; i++) { const [x, y] = r[i]; parts.push(`${x - lx},${y - ly}`); lx = x; ly = y; }
    if (parts.length) s += 'l' + parts.join(' ').replace(/ -/g, '-');
    s += 'z'; px = x0; py = y0; // z 다음 현재점은 고리의 시작점
  }
  after += s.length;
  return [s, c, id];
});
const head = text.slice(0, text.indexOf('window.WORLD')).replace(/\n*$/, '\n');
fs.writeFileSync(out, (head.includes('shrink-map') ? head : head + '// 줄이기: tools/map/shrink-map.mjs (상대 좌표, 단순화)\n') + 'window.WORLD=' + JSON.stringify(W) + ';\n');
console.log(`경로 글자 수 ${before} → ${after} (${Math.round(after / before * 100)}%), 파일 ${fs.statSync(out).size} bytes`);
