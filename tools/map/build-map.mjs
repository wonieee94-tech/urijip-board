// 공개 지도 자료(Natural Earth, world-atlas)로 나라별 색칠 세계지도를 만든다.
// 결과: public/world-map.js  (window.WORLD = { w, h, k, tx, ty, paths: [[d, colorIndex, id]] })
// 사용: node build-map.mjs [110m|50m]
import fs from 'node:fs';
import { feature, neighbors } from 'topojson-client';
import { geoProjection, geoPath } from 'd3-geo';

const res = process.argv[2] || '50m';
const topo = JSON.parse(fs.readFileSync(`node_modules/world-atlas/countries-${res}.json`, 'utf8'));
const geoms = topo.objects.countries.geometries;
const all = feature(topo, topo.objects.countries).features;
const keep = all.map((f, i) => ({ f, i })).filter(({ f }) => f.id !== '010'); // 남극 제외

// 밀러 도법 (학교 세계지도와 비슷한 모양)
const millerRaw = (l, p) => [l, 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * p))];
const W = 1000;
const proj = geoProjection(millerRaw).precision(0.6)
  .fitWidth(W, { type: 'FeatureCollection', features: keep.map((x) => x.f) });
const path = geoPath(proj).digits(0);
const box = path.bounds({ type: 'FeatureCollection', features: keep.map((x) => x.f) });
const H = Math.ceil(box[1][1] + 2);

// 붙어 있는 나라는 다른 색이 되게 칠한다
const nb = neighbors(geoms);
const color = new Array(geoms.length).fill(-1);
const order = [...geoms.keys()].sort((a, b) => nb[b].length - nb[a].length);
for (const i of order) {
  const used = new Set(nb[i].map((j) => color[j]));
  let c = (i * 7) % 6; for (let t = 0; t < 6 && used.has(c); t++) c = (c + 1) % 6;
  color[i] = c;
}
// 반올림 후 겹친 점을 빼고, 너무 작은 섬 조각(점 3개 이하)은 버려서 파일을 가볍게 한다
function compact(d) {
  if (!d) return '';
  return d.split('M').filter(Boolean).map((ring) => {
    const closed = ring.endsWith('Z');
    const pts = ring.replace('Z', '').split('L');
    const out = [];
    for (const p of pts) if (out[out.length - 1] !== p) out.push(p);
    if (out.length < 4) return '';
    return 'M' + out.join('L') + (closed ? 'Z' : '');
  }).join('');
}
const keepIds = new Set(['410', '392', '408']); // 한국·일본·북한은 작은 섬도 남긴다
const paths = keep.map(({ f, i }) => [keepIds.has(f.id) ? path(f) : compact(path(f)), color[i], f.id]).filter((p) => p[0]);
const [tx, ty] = proj.translate();
const out = { w: W, h: H, k: +proj.scale().toFixed(4), tx: +tx.toFixed(3), ty: +ty.toFixed(3), paths };
const js = '// 자동 생성: tools/map/build-map.mjs (Natural Earth 공개 지도 자료)\nwindow.WORLD=' + JSON.stringify(out) + ';\n';
fs.writeFileSync('../../public/world-map.js', js);
console.log(res, 'countries', paths.length, 'size', Math.round(js.length / 1024) + 'KB', 'h', H);
