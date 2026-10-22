// Shared by server (require) and client (script tag): track + vehicle physics.
(function (root) {
  const N = 240, W = 20, LIM = W / 2 + 3.6, LAPS = 3, CPS = N / 8, TAU = Math.PI * 2;
  const pts = [];
  for (let i = 0; i < N; i++) { const a = i / N * TAU; pts.push({ x: 260 * Math.cos(a) + 40 * Math.cos(3 * a), z: 170 * Math.sin(a) + 30 * Math.sin(2 * a) }); }
  function angDiff(a, b) { let d = a - b; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU; return d; }
  for (let i = 0; i < N; i++) { const n = pts[(i + 1) % N], q = pts[(i + N - 1) % N], p = pts[i]; const dx = n.x - q.x, dz = n.z - q.z, l = Math.hypot(dx, dz); p.tx = dx / l; p.tz = dz / l; p.h = Math.atan2(p.tx, p.tz); }
  let len = 0; for (let i = 0; i < N; i++) { const n = pts[(i + 1) % N]; len += Math.hypot(n.x - pts[i].x, n.z - pts[i].z); }
  const SP = len / N;
  for (let i = 0; i < N; i++) pts[i].k = Math.abs(angDiff(pts[(i + 3) % N].h, pts[(i + N - 3) % N].h)) / (6 * SP);
  const CARS = [
    { name: 'Falcon GT', cls: 'Balanced coupe', top: 60, acc: 24, hand: 2.3, grip: 6.5, brk: 34 },
    { name: 'Vortex RS', cls: 'Track supercar', top: 66, acc: 22, hand: 2.1, grip: 6.0, brk: 36 },
    { name: 'Titan V8', cls: 'Muscle monster', top: 63, acc: 27, hand: 1.9, grip: 5.2, brk: 30 },
    { name: 'Nova X', cls: 'Corner hunter', top: 58, acc: 26, hand: 2.6, grip: 7.5, brk: 38 }
  ];
  function at(f, off) {
    f = ((f % N) + N) % N; const i = Math.floor(f), t = f - i, a = pts[i], b = pts[(i + 1) % N];
    const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, h = a.h + angDiff(b.h, a.h) * t;
    return { x: x + Math.cos(h) * off, z: z - Math.sin(h) * off, h, idx: Math.round(f) % N };
  }
  function gridPos(slot) { const row = slot >> 1, side = slot & 1; return at(N - (8 + row * 9 + side * 4) / SP, side ? 3.6 : -3.6); }
  function place(c, p) { c.x = p.x; c.z = p.z; c.h = p.h; c.vx = 0; c.vz = 0; c.vf = 0; c.vl = 0; c.idx = p.idx; c.off = 0; }
  function nearest(c) {
    let best = 1e9, bi = c.idx | 0;
    for (let d = -8; d <= 8; d++) { const i = (((c.idx | 0) + d) % N + N) % N, p = pts[i], q = (c.x - p.x) ** 2 + (c.z - p.z) ** 2; if (q < best) { best = q; bi = i; } }
    const p = pts[bi]; c.idx = bi; c.off = (c.x - p.x) * p.tz - (c.z - p.z) * p.tx;
  }
  function step(c, i, dt, st) {
    nearest(c);
    const on = Math.abs(c.off) <= W / 2 + 1.6;
    let fx = Math.sin(c.h), fz = Math.cos(c.h), vf = c.vx * fx + c.vz * fz;
    const k = Math.min(1, Math.abs(vf) / 8) / (1 + Math.abs(vf) / 45);
    c.h -= i.s * st.hand * k * dt * (vf >= 0 ? 1 : -1);
    fx = Math.sin(c.h); fz = Math.cos(c.h); const lx = fz, lz = -fx;
    vf = c.vx * fx + c.vz * fz; let vl = c.vx * lx + c.vz * lz;
    let a = 0;
    if (i.t > 0) a += i.t * st.acc * Math.max(0, 1 - Math.max(0, vf) / st.top);
    if (i.b > 0) { if (vf > 0.5) a -= i.b * st.brk; else if (vf > -12) a -= i.b * st.acc * 0.5; }
    const sg = vf > 0 ? 1 : vf < 0 ? -1 : 0;
    a -= vf * 0.05 + sg * 1.2; if (!on) a -= vf * 0.7; if (i.hb) a -= sg * 10;
    const old = vf; vf += a * dt; if (!i.t && old * vf < 0) vf = 0;
    let g = i.hb ? st.grip * 0.18 : st.grip; if (!on) g += 3;
    vl *= Math.exp(-g * dt);
    c.vx = fx * vf + lx * vl; c.vz = fz * vf + lz * vl; c.x += c.vx * dt; c.z += c.vz * dt; c.vf = vf; c.vl = vl;
    nearest(c); c.hit = 0;
    if (Math.abs(c.off) > LIM) { // barrier
      const sgn = c.off > 0 ? 1 : -1, over = Math.abs(c.off) - LIM, p = pts[c.idx];
      c.x -= p.tz * sgn * over; c.z += p.tx * sgn * over;
      const vo = sgn * (c.vx * p.tz - c.vz * p.tx);
      if (vo > 0) { c.vx -= sgn * p.tz * vo * 1.2; c.vz += sgn * p.tx * vo * 1.2; c.hit = Math.min(1, vo / 20); }
      c.vx *= 0.98; c.vz *= 0.98;
    }
  }
  const api = { N, W, LIM, LAPS, CPS, SP, pts, CARS, angDiff, at, gridPos, place, nearest, step };
  if (typeof module !== 'undefined') module.exports = api; else root.RaceShared = api;
})(this);
