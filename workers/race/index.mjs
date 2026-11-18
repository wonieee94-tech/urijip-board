// 가족 달리기 실시간 방 (Cloudflare Durable Object + WebSocket)
// 가족 코드마다 방 하나. 규칙은 public/race-core.mjs (브라우저 혼자 모드와 같은 파일).
// 배포: workers/race 폴더에서 `npx wrangler deploy` → Pages 프로젝트에 RACE 바인딩 (UPGRADE_NOTES_ko.md 참고)
import { DurableObject } from 'cloudflare:workers';
import { newRoom, addPlayer, removePlayer, setAi, start, again, tap, step, view } from '../../public/race-core.mjs';

const MAX_SOCKETS = 12;
const json = (status, data) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export class RaceRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = newRoom();
    this.timer = null;
    ctx.blockConcurrencyWhile(async () => { this.room = (await ctx.storage.get('room')) || newRoom(); });
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async fetch(request) {
    const now = Date.now();
    this.tick(now);
    if (request.headers.get('Upgrade') !== 'websocket') return json(200, { ok: true, room: view(this.room, now) });
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return json(429, { error: '방에 기기가 너무 많아요' });
    const pair = new WebSocketPair(); const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ pid: '' });
    server.send(JSON.stringify({ t: 'state', room: view(this.room, now) }));
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws, raw) {
    const now = Date.now();
    if (typeof raw !== 'string' || raw.length > 600) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    const me = ws.deserializeAttachment() || {};
    const r = this.room; const before = r.phase;
    try {
      this.tick(now);
      switch (m.t) {
        case 'hello': {
          const pl = addPlayer(r, m.p || {}, now); me.pid = pl.id; ws.serializeAttachment(me);
          ws.send(JSON.stringify({ t: 'you', id: pl.id })); break; }
        case 'leave': if (me.pid) { removePlayer(r, me.pid, now); me.pid = ''; ws.serializeAttachment(me); } break;
        case 'ai': setAi(r, me.pid, m.n, m.level, now); break;
        case 'start': start(r, me.pid, now); this.loop(); break;
        case 'again': again(r, me.pid, now); break;
        case 'tap': { const ok = tap(r, me.pid, m.n, now); if (r.phase === 'race' && !ok) return; break; }
        default: return;
      }
    } catch (e) { ws.send(JSON.stringify({ t: 'err', msg: String(e.message || e) })); return; }
    if (m.t !== 'tap' || r.phase !== before) await this.save();
    if (m.t !== 'tap') this.broadcast(now);
  }
  async webSocketClose(ws) { await this.gone(ws); }
  async webSocketError(ws) { await this.gone(ws); }
  async gone(ws) {
    const me = ws.deserializeAttachment() || {};
    if (!me.pid) return;
    // 같은 사람이 다른 연결로 다시 들어와 있으면 빼지 않는다
    const still = this.ctx.getWebSockets().some((w) => w !== ws && (w.deserializeAttachment() || {}).pid === me.pid);
    if (!still) { removePlayer(this.room, me.pid, Date.now()); await this.save(); this.broadcast(Date.now()); }
  }
  tick(now) {
    const before = this.room.phase;
    step(this.room, now);
    if (this.room.phase !== before) this.save();
    if (this.room.phase === 'countdown' || this.room.phase === 'race') this.loop();
  }
  // 카운트다운·달리기 동안 0.1초마다 모두에게 위치를 보낸다
  loop() {
    if (this.timer) return;
    this.timer = setInterval(() => {
      const now = Date.now(); const before = this.room.phase;
      step(this.room, now);
      this.broadcast(now);
      if (this.room.phase !== before) this.save();
      if (this.room.phase !== 'countdown' && this.room.phase !== 'race') { clearInterval(this.timer); this.timer = null; }
    }, 100);
  }
  broadcast(now) {
    const msg = JSON.stringify({ t: 'state', room: view(this.room, now) });
    for (const w of this.ctx.getWebSockets()) { try { w.send(msg); } catch {} }
  }
  save() { return this.ctx.storage.put('room', this.room); }
}

export default {
  fetch() { return new Response('우리집 보드 달리기 방 서버예요. 화면은 Pages 쪽에 있어요.', { status: 404, headers: { 'content-type': 'text/plain; charset=utf-8' } }); },
};
