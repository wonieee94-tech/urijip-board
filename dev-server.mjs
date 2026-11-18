// 내 PC에서 확인용 서버: node dev-server.mjs → http://localhost:8830
// 실제 배포에서는 Netlify 함수(netlify/functions/family.mjs)가 같은 규칙으로 동작한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './netlify/functions/lib/family.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');
const dataFile = path.join(root, '.dev-data.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch {}
const store = {
  get: async (k) => (db[k] ? structuredClone(db[k]) : null),
  set: async (k, v) => { db[k] = v; fs.writeFileSync(dataFile, JSON.stringify(db)); },
  del: async (k) => { delete db[k]; fs.writeFileSync(dataFile, JSON.stringify(db)); },
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/family') {
    let body = '';
    for await (const c of req) body += c;
    let parsed = null; try { parsed = body ? JSON.parse(body) : null; } catch {}
    const { status, data } = await handle(req.method, url.href, parsed, store);
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(data));
  }
  let file = path.join(pub, decodeURIComponent(url.pathname));
  if (!file.startsWith(pub)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(+process.env.PORT || 8830, () => console.log('http://localhost:' + (process.env.PORT || 8830)));
