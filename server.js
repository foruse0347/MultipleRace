try { require('dotenv').config(); } catch {}
const path = require('path'), http = require('http'), crypto = require('crypto');
const express = require('express'), { Server } = require('socket.io');
const S = require('./public/shared.js');

const PORT = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const TOTAL = 10;
const LOBBY_MS = (+process.env.LOBBY_SECONDS || 15) * 1000;
const COUNT_MS = (+process.env.COUNTDOWN_SECONDS || 5) * 1000;
if (!BOT_TOKEN) {
  console.error('[config] BOT_TOKEN is not set. Telegram login verification and the bot are disabled (guest mode only).');
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_NO_BOT !== '1') { console.error('[config] Refusing to start in production without BOT_TOKEN (set ALLOW_NO_BOT=1 to override).'); process.exit(1); }
}

const app = express();
app.get('/health', (q, r) => r.json({ ok: true, rooms: rooms.size, uptime: Math.round(process.uptime()) }));
app.use('/vendor', express.static(path.join(__dirname, 'node_modules/three/build')));
app.use('/vendor/examples', express.static(path.join(__dirname, 'node_modules/three/examples/js'))); // GLTF/Draco loaders
app.use(express.static(path.join(__dirname, 'public')));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: false }, pingInterval: 10000, pingTimeout: 15000 });

// Validate Telegram initData (HMAC) - never trust client-provided IDs.
function verify(initData) {
  if (!BOT_TOKEN || !initData) return null;
  try {
    const p = new URLSearchParams(initData), hash = p.get('hash'); p.delete('hash');
    const str = [...p.entries()].map(([k, v]) => k + '=' + v).sort().join('\n');
    const key = crypto.createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
    const h = crypto.createHmac('sha256', key).update(str).digest('hex');
    if (!hash || h.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(h), Buffer.from(hash))) return null;
    if (Date.now() / 1000 - Number(p.get('auth_date')) > 86400) return null;
    return JSON.parse(p.get('user'));
  } catch { return null; }
}

const rooms = new Map(); let openRoom = null, rid = 0;
const AI_NAMES = ['Apex', 'Blaze', 'Cipher', 'Drift', 'Echo', 'Flux', 'Ghost', 'Havoc', 'Ion', 'Jett', 'Kilo', 'Nitro'];
const COLORS = ['#e10600', '#0a84ff', '#ffd60a', '#30d158', '#bf5af2', '#ff9f0a', '#f2f2f7', '#2c2c30'];
const rnd = (a, b) => a + Math.random() * (b - a);
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pub = c => ({ id: c.id, name: c.name, carId: c.carId, color: c.color, human: c.human });

function newCar(o) {
  const c = Object.assign({ id: 0, uid: null, human: false, sock: null, vx: 0, vz: 0, vf: 0, vl: 0, idx: 0, lap: 0, cp: 1, pr: 0, fin: null, best: null, stuck: 0, lastResp: 0, in: { t: 0, b: 0, s: 0, hb: 0 }, lastIn: 0 }, o);
  S.place(c, S.gridPos(0)); return c;
}
function newRoom() {
  const r = { id: 'r' + (++rid), state: 'lobby', cars: [], lobbyEnd: Date.now() + LOBBY_MS, t0: 0, goAt: 0, endAt: 0, doneAt: 0, order: [] };
  rooms.set(r.id, r); openRoom = r; return r;
}
function emitLobby(r) {
  const n = r.cars.length;
  io.to(r.id).emit('lobby', { n, max: TOTAL, left: Math.max(0, Math.ceil((r.lobbyEnd - Date.now()) / 1000)) });
}
function startRoom(r) {
  if (r.state !== 'lobby') return;
  if (openRoom === r) openRoom = null;
  const all = r.cars.slice(); let k = all.length;
  while (all.length < TOTAL) {
    const nm = AI_NAMES[(k++ + (Math.random() * 12 | 0)) % AI_NAMES.length];
    all.push(newCar({ name: nm + ' (AI)', carId: Math.random() * 4 | 0, color: COLORS[Math.random() * COLORS.length | 0],
      ai: { lane: rnd(-5.5, 5.5), cur: 0, skill: rnd(0.8, 0.97), grip: rnd(22, 27) } }));
  }
  shuffle(all).forEach((c, i) => { c.id = i; S.place(c, S.gridPos(i)); if (!c.ai) c.ai = { lane: 0, cur: 0, skill: 0.9, grip: 24 }; });
  r.cars = all; r.state = 'countdown'; r.goAt = Date.now() + COUNT_MS;
  for (const c of all) if (c.sock) sendRoom(r, c);
}
function sendRoom(r, c) { c.sock.emit('room', { you: c.id, laps: S.LAPS, cars: r.cars.map(pub) }); }

function drive(r, c, dt) { // AI controller (also used for disconnected / finished humans)
  const st = S.CARS[c.carId], a = c.ai, sp = c.vf, N = S.N;
  const look = Math.max(3, Math.round((10 + Math.max(0, sp) * 0.55) / S.SP));
  let lane = a.lane, avoid = 0; const sh = Math.sin(c.h), ch = Math.cos(c.h);
  for (const o of r.cars) {
    if (o === c) continue; const dx = o.x - c.x, dz = o.z - c.z, f = dx * sh + dz * ch;
    if (f > 0 && f < 28) { const lat = dx * ch - dz * sh; if (Math.abs(lat) < 3.4) avoid += (lat >= 0 ? -1 : 1) * (1 - f / 28) * 5; }
  }
  lane = clamp(lane + avoid, -7.5, 7.5); a.cur += (lane - a.cur) * Math.min(1, dt * 3);
  const p = S.pts[(c.idx + look) % N], tx = p.x + p.tz * a.cur, tz = p.z - p.tx * a.cur;
  const err = S.angDiff(Math.atan2(tx - c.x, tz - c.z), c.h);
  let kmax = 1e-4; for (let j = 0; j < 16; j++) kmax = Math.max(kmax, S.pts[(c.idx + j) % N].k);
  let vt = Math.min(st.top * a.skill, Math.sqrt(a.grip / kmax)); if (Math.abs(err) > 0.5) vt *= 0.6;
  if (c.fin) vt = 12;
  return { s: clamp(-err * 2.2, -1, 1), t: sp < vt ? 1 : 0, b: clamp((sp - vt) / 10, 0, 1), hb: 0 };
}
const circ = (a, b) => { const d = Math.abs(a - b) % S.N; return Math.min(d, S.N - d); };

function stepRoom(r, dt, now, tick) {
  if (r.state === 'lobby') { if (now >= r.lobbyEnd || r.cars.length >= TOTAL) startRoom(r); else if (tick % 30 === 0) emitLobby(r); }
  else if (r.state === 'countdown') { if (now >= r.goAt) { r.state = 'race'; r.t0 = now; r.cars.forEach(c => c.lapT0 = now); } }
  else if (r.state === 'race') {
    const cars = r.cars;
    for (const c of cars) {
      const st = S.CARS[c.carId];
      const inp = (c.human && c.sock && !c.fin) ? c.in : drive(r, c, dt);
      S.step(c, inp, dt, st);
      if (Math.hypot(c.vx, c.vz) < 2 && (inp.t > 0.5 || !c.human) && !c.fin) c.stuck += dt; else c.stuck = 0;
      if (c.stuck > (c.human ? 4 : 2)) { respawn(c, now); }
      if (circ(c.idx, (c.cp * S.CPS) % S.N) <= 10) { // ordered checkpoints, anti-shortcut
        c.cp++;
        if (c.cp > 8) { c.cp = 1; c.lap++; const lt = now - c.lapT0; c.lapT0 = now; if (c.best === null || lt < c.best) c.best = lt;
          if (c.lap >= S.LAPS && !c.fin) { c.fin = now - r.t0; r.order.push(c); if (!r.endAt) r.endAt = now + 45000; } }
      }
      let d = (((c.idx - (c.cp - 1) * S.CPS) % S.N) + S.N) % S.N; if (d > S.N / 2) d -= S.N;
      c.pr = (c.lap * 8 + c.cp - 1) * S.CPS + d;
    }
    for (let i = 0; i < cars.length; i++) for (let j = i + 1; j < cars.length; j++) { // collisions
      const a = cars[i], b = cars[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 3 && d > 0.001) {
        const nx = dx / d, nz = dz / d, ov = 3 - d; a.x -= nx * ov / 2; a.z -= nz * ov / 2; b.x += nx * ov / 2; b.z += nz * ov / 2;
        const rv = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (rv > 0) { const im = rv * 0.6; a.vx -= nx * im; a.vz -= nz * im; b.vx += nx * im; b.vz += nz * im; }
      }
    }
    rank(r);
    const humans = cars.filter(c => c.human && c.sock);
    const allFin = cars.filter(c => c.human).every(c => c.fin) || humans.length === 0;
    if (allFin || (r.endAt && now > r.endAt) || now - r.t0 > 8 * 60000) finish(r, now);
  }
  if (r.state === 'done' && now - r.doneAt > 20000) { rooms.delete(r.id); }
  if (tick % 3 === 0 && (r.state === 'race' || r.state === 'countdown')) {
    io.to(r.id).volatile.emit('snap', { t: now, s: r.state === 'race' ? 1 : 0, cd: Math.max(0, (r.goAt - now) / 1000), et: r.t0 ? now - r.t0 : 0,
      c: r.cars.map(c => [c.id, +c.x.toFixed(2), +c.z.toFixed(2), +c.h.toFixed(3), +c.vx.toFixed(1), +c.vz.toFixed(1), c.lap, c.pos || 0, c.fin ? 1 : 0]) });
  }
}
function respawn(c, now) { S.place(c, S.at(c.idx, 0)); c.stuck = 0; c.lastResp = now; }
function rank(r) {
  const s = r.cars.slice().sort((a, b) => (a.fin !== null && b.fin !== null) ? a.fin - b.fin : a.fin !== null ? -1 : b.fin !== null ? 1 : b.pr - a.pr);
  s.forEach((c, i) => c.pos = i + 1);
}
function finish(r, now) {
  rank(r); r.state = 'done'; r.doneAt = now;
  const list = r.cars.slice().sort((a, b) => a.pos - b.pos).map(c => ({ pos: c.pos, name: c.name, human: c.human, carId: c.carId, color: c.color, time: c.fin, best: c.best, laps: c.lap, id: c.id }));
  io.to(r.id).emit('results', { list });
}
function leave(sock) {
  const d = sock.data; if (!d || !d.r) return; const { r, c } = d; sock.leave(r.id); sock.data = {};
  if (r.state === 'lobby') { r.cars = r.cars.filter(x => x !== c); if (!r.cars.length) { rooms.delete(r.id); if (openRoom === r) openRoom = null; } else emitLobby(r); }
  else c.sock = null; // AI takes over; slot stays so the race keeps 10 cars
}

io.on('connection', sock => {
  sock.data = {};
  sock.on('join', (d, ack) => {
    d = d || {}; const u = verify(String(d.initData || ''));
    const uid = u ? 'tg' + u.id : 'g' + String(d.uid || '').replace(/[^a-z0-9]/gi, '').slice(0, 24);
    if (uid.length < 7) return;
    const name = String(u ? (u.first_name || u.username || 'Racer') : d.name || 'Racer').replace(/[^\p{L}\p{N} _.-]/gu, '').slice(0, 16) || 'Racer';
    leave(sock);
    for (const r of rooms.values()) { // reconnect
      const c = r.cars.find(x => x.human && x.uid === uid);
      if (c && r.state !== 'done') { if (c.sock && c.sock !== sock) c.sock.disconnect(true); c.sock = sock; sock.data = { r, c }; sock.join(r.id); if (r.state === 'lobby') emitLobby(r); else sendRoom(r, c); return ack && ack({ ok: true, re: true, verified: !!u }); }
    }
    const r = (openRoom && openRoom.state === 'lobby' && openRoom.cars.length < TOTAL) ? openRoom : newRoom();
    const c = newCar({ human: true, uid, sock, name, carId: clamp(d.carId | 0, 0, 3), color: COLORS.includes(d.color) ? d.color : COLORS[0] });
    r.cars.push(c); sock.data = { r, c }; sock.join(r.id); emitLobby(r);
    ack && ack({ ok: true, verified: !!u });
  });
  sock.on('in', d => {
    const c = sock.data.c, now = Date.now(); if (!c || !d || now - c.lastIn < 10) return; c.lastIn = now;
    c.in = { t: clamp(+d.t || 0, 0, 1), b: clamp(+d.b || 0, 0, 1), s: clamp(+d.s || 0, -1, 1), hb: d.hb ? 1 : 0 }; // only inputs - never position/speed/laps
  });
  sock.on('respawn', () => { const { r, c } = sock.data; if (r && c && r.state === 'race' && !c.fin && Date.now() - c.lastResp > 4000) respawn(c, Date.now()); });
  sock.on('ping2', cb => typeof cb === 'function' && cb());
  sock.on('leave', () => leave(sock));
  sock.on('disconnect', () => leave(sock));
});

let tick = 0, last = Date.now();
setInterval(() => { const now = Date.now(), dt = Math.min(0.05, (now - last) / 1000); last = now; tick++; for (const r of rooms.values()) stepRoom(r, dt, now, tick); }, 1000 / 60);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] MultipleRace listening on 0.0.0.0:${PORT}`);
  if (BOT_TOKEN && process.env.RUN_BOT !== '0') require('./bot.js').start();
});
