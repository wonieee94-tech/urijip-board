// 내 PC에서 확인용 서버: node dev-server.mjs → http://localhost:8830
// 실제 배포(Cloudflare Pages)에서는 functions/api/family.js가 같은 규칙(lib/family.mjs)으로 동작한다.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handle } from './lib/family.mjs';

const root = path.dirname(fileURLToPath(import.meta.url));
const pub = path.join(root, 'public');
const dataFile = process.env.DEV_DATA || path.join(root, '.dev-data.json');
let db = {};
try { db = JSON.parse(fs.readFileSync(dataFile, 'utf8')); } catch {}
const save = () => fs.writeFileSync(dataFile, JSON.stringify(db));
const store = {
  get: async (k) => (db[k] ? structuredClone(db[k]) : null),
  set: async (k, v) => { db[k] = structuredClone(v); save(); }, // ttl은 PC에서는 무시
  del: async (k) => { delete db[k]; save(); },
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.txt': 'text/plain' };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname === '/api/family') {
      let body = '';
      for await (const c of req) { body += c; if (body.length > 32 * 1024) { res.writeHead(413); return res.end(); } }
      let parsed = null; try { parsed = body ? JSON.parse(body) : null; } catch {}
      const { status, data } = await handle(req.method, url.href, parsed, store, { ip: req.socket.remoteAddress });
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(data));
    }
    let rel;
    try { rel = decodeURIComponent(url.pathname); } catch { res.writeHead(400); return res.end('bad path'); }
    let file = path.join(pub, rel);
    if (file !== pub && !file.startsWith(pub + path.sep)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e); if (!res.headersSent) res.writeHead(500); res.end();
  }
}).listen(+process.env.PORT || 8830, () => console.log('http://localhost:' + (process.env.PORT || 8830)));
