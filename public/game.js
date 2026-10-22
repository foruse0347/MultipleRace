(() => {
'use strict';
const S = window.RaceShared, { N, W, LIM, SP, pts, CARS, LAPS } = S;
const $ = q => document.querySelector(q), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const tg = window.Telegram && window.Telegram.WebApp;
const touchDev = matchMedia('(pointer:coarse)').matches || 'ontouchstart' in window;
const mobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || touchDev;
const store = { get(k, d) { try { const v = localStorage.getItem('mr_' + k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem('mr_' + k, JSON.stringify(v)); } catch {} } };
const COLORS = ['#e10600', '#0a84ff', '#ffd60a', '#30d158', '#bf5af2', '#ff9f0a', '#f2f2f7', '#2c2c30'];
const cfg = { car: store.get('car', 0), color: store.get('color', 0), name: store.get('name', ''), q: store.get('q', 'auto'), snd: store.get('snd', 1), fps: store.get('fps', 0), sens: store.get('sens', 1), assist: store.get('assist', touchDev ? 1 : 0), auto: store.get('auto', 0), uid: store.get('uid', null) || ('g' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36).slice(-4)) };
store.set('uid', cfg.uid);
if (!cfg.name) cfg.name = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.first_name) || 'Racer' + (100 + Math.random() * 900 | 0);
document.body.classList.toggle('touch', touchDev);

// ---- Telegram integration
if (tg) {
  tg.ready(); tg.expand();
  try { tg.setHeaderColor('#0c0f16'); tg.setBackgroundColor('#0c0f16'); tg.disableVerticalSwipes && tg.disableVerticalSwipes(); } catch {}
  const fit = () => {
    const r = document.documentElement.style;
    r.setProperty('--vh', (tg.viewportStableHeight || innerHeight) + 'px');
    const t = ((tg.safeAreaInset && tg.safeAreaInset.top) || 0) + ((tg.contentSafeAreaInset && tg.contentSafeAreaInset.top) || 0);
    r.setProperty('--tgt', t + 'px'); onResize();
  };
  tg.onEvent('viewportChanged', fit); tg.onEvent('safeAreaChanged', fit); tg.onEvent('contentSafeAreaChanged', fit); setTimeout(fit, 0);
}

// ---- renderer / scene
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene(); scene.fog = new THREE.Fog(0xa9bdd6, 160, 720);
const camera = new THREE.PerspectiveCamera(62, 1, 0.5, 1600);
const skyMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
  vertexShader: 'varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader: 'varying vec3 p;void main(){vec3 d=normalize(p);float h=d.y;vec3 c=mix(vec3(.78,.86,.95),vec3(.16,.4,.78),smoothstep(0.,.6,h));c=mix(vec3(.93,.84,.7),c,smoothstep(-.05,.25,h));c+=vec3(1.,.85,.6)*pow(max(dot(d,normalize(vec3(.5,.6,.3))),0.),160.)*2.5;gl_FragColor=vec4(c,1.);}' });
scene.add(new THREE.Mesh(new THREE.SphereGeometry(1000, 24, 12), skyMat));
if (!mobileUA) try { const pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene(); const em = skyMat.clone(); em.fragmentShader = skyMat.fragmentShader.replace('gl_FragColor=vec4(c,1.)', 'gl_FragColor=vec4(c*.28,1.)'); es.add(new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), em)); scene.environment = pm.fromScene(es).texture; } catch {}
scene.add(new THREE.HemisphereLight(0xdbe9ff, 0x56663f, mobileUA ? 0.95 : 0.8));
const fill = new THREE.DirectionalLight(0xaec6ff, 0.7); fill.position.set(-60, 40, -40); scene.add(fill);
const sun = new THREE.DirectionalLight(0xfff0d8, 2.1); sun.position.set(80, 120, 50); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 10, far: 300 }); sun.shadow.bias = -0.0004;
scene.add(sun, sun.target);

const cv = (w, h, fn) => { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t; };
const grass = cv(128, 128, (g, w, h) => { g.fillStyle = '#3f6e38'; g.fillRect(0, 0, w, h); for (let i = 0; i < 1800; i++) { g.fillStyle = `rgba(${20 + Math.random() * 40},${70 + Math.random() * 60},${20 + Math.random() * 30},.5)`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } });
grass.repeat.set(160, 160);
const ground = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshStandardMaterial({ map: grass, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.position.y = -0.05; ground.receiveShadow = true; scene.add(ground);
const asphalt = cv(256, 256, (g, w, h) => { g.fillStyle = '#434650'; g.fillRect(0, 0, w, h); for (let i = 0; i < 4000; i++) { const v = 60 + Math.random() * 40 | 0; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); } g.fillStyle = '#f1f1f1'; g.fillRect(8, 0, 6, h); g.fillRect(w - 14, 0, 6, h); g.fillStyle = '#ffd60a'; g.fillRect(w / 2 - 3, 0, 6, h / 2); });
asphalt.wrapS = THREE.ClampToEdgeWrapping;

function ribbon(o1, o2, y, mat, colFn, uv) {
  const P = [], C = [], U = [], I = [], Nn = []; let vi = 0;
  for (let i = 0; i < N; i++) {
    const a = pts[i], b = pts[(i + 1) % N];
    for (const [p, o] of [[a, o1], [a, o2], [b, o2], [b, o1]]) { P.push(p.x + p.tz * o, y, p.z - p.tx * o); Nn.push(0, 1, 0); }
    if (colFn) { const c = colFn(i); for (let k = 0; k < 4; k++) C.push(c[0], c[1], c[2]); }
    if (uv) U.push(0, i * SP / 20, 1, i * SP / 20, 1, (i + 1) * SP / 20, 0, (i + 1) * SP / 20);
    I.push(vi, vi + 2, vi + 1, vi, vi + 3, vi + 2); vi += 4;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  if (colFn) g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setIndex(I);
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
ribbon(-W / 2, W / 2, 0.02, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85, side: THREE.DoubleSide }), null, true);
const curb = i => (i >> 1) & 1 ? [0.95, 0.95, 0.95] : [0.85, 0.05, 0.05];
const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide });
ribbon(W / 2, W / 2 + 1.6, 0.04, curbMat, curb); ribbon(-W / 2 - 1.6, -W / 2, 0.04, curbMat, curb);
ribbon(W / 2 + 1.6, W / 2 + 7, 0.0, new THREE.MeshStandardMaterial({ color: 0x57634a, roughness: 1, side: THREE.DoubleSide }));
ribbon(-W / 2 - 7, -W / 2 - 1.6, 0.0, new THREE.MeshStandardMaterial({ color: 0x57634a, roughness: 1, side: THREE.DoubleSide }));
{ // start line + gantry
  const t = cv(256, 32, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) & 1 ? '#fff' : '#111'; g.fillRect(x * 16, y * 16, 16, 16); } });
  const l = new THREE.Mesh(new THREE.PlaneGeometry(W, 3), new THREE.MeshBasicMaterial({ map: t })); l.rotation.x = -Math.PI / 2; l.rotation.order = 'YXZ'; l.rotation.y = pts[0].h; l.position.set(pts[0].x, 0.05, pts[0].z); scene.add(l);
  const ban = cv(512, 64, (g, w, h) => { g.fillStyle = '#10131b'; g.fillRect(0, 0, w, h); g.fillStyle = '#ff3b30'; g.fillRect(0, 0, 14, h); g.fillStyle = '#fff'; g.font = 'italic 900 40px sans-serif'; g.textAlign = 'center'; g.fillText('MULTIPLERACE', w / 2, 46); });
  const gm = new THREE.MeshStandardMaterial({ color: 0x20242e, metalness: .6, roughness: .4 }), p0 = pts[0];
  const gr = new THREE.Group(); gr.position.set(p0.x, 0, p0.z); gr.rotation.y = p0.h;
  for (const s of [-1, 1]) { const m = new THREE.Mesh(new THREE.BoxGeometry(.8, 9, .8), gm); m.position.set(s * (W / 2 + 2.5), 4.5, 0); m.castShadow = true; gr.add(m); }
  const bn = new THREE.Mesh(new THREE.BoxGeometry(W + 5, 2.2, .5), new THREE.MeshBasicMaterial({ map: ban })); bn.position.y = 8.6; gr.add(bn); scene.add(gr);
}
{ // barriers (instanced)
  const geo = new THREE.BoxGeometry(5, 1, .6), mat = new THREE.MeshStandardMaterial({ roughness: .6, metalness: .1 });
  const im = new THREE.InstancedMesh(geo, mat, N), d = new THREE.Object3D(), col = new THREE.Color(); let k = 0;
  for (let i = 0; i < N; i += 2) for (const s of [-1, 1]) {
    const p = pts[i], o = s * (W / 2 + 4.6); d.position.set(p.x + p.tz * o, .5, p.z - p.tx * o); d.rotation.set(0, p.h - Math.PI / 2, 0); d.updateMatrix(); im.setMatrixAt(k, d.matrix); im.setColorAt(k++, col.set((i >> 1) & 1 ? '#f2f2f2' : '#d9261c'));
  }
  im.count = k; im.castShadow = im.receiveShadow = true; scene.add(im);
}
{ // trees, buildings, grandstands
  const near = (x, z, m) => { for (let i = 0; i < N; i += 2) if ((x - pts[i].x) ** 2 + (z - pts[i].z) ** 2 < m * m) return true; return false; };
  const tr = new THREE.InstancedMesh(new THREE.CylinderGeometry(.3, .45, 3, 6), new THREE.MeshStandardMaterial({ color: 0x5b3d26 }), 380);
  const lf = new THREE.InstancedMesh(new THREE.ConeGeometry(2.4, 7, 8), new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 1 }), 380), d = new THREE.Object3D(); let n = 0, tries = 0;
  while (n < 380 && tries++ < 4000) { const x = (Math.random() - .5) * 900, z = (Math.random() - .5) * 700; if (near(x, z, W / 2 + 16)) continue; const s = .8 + Math.random() * .7;
    d.position.set(x, 1.5 * s, z); d.scale.set(s, s, s); d.updateMatrix(); tr.setMatrixAt(n, d.matrix); d.position.set(x, 6 * s, z); d.updateMatrix(); lf.setMatrixAt(n++, d.matrix); }
  tr.count = lf.count = n; lf.castShadow = true; scene.add(tr, lf);
  const bm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ roughness: .5, metalness: .3 }), 30), c = new THREE.Color();
  for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2 + Math.random() * .1, r = 520 + Math.random() * 120, w = 30 + Math.random() * 40, h = 25 + Math.random() * 70;
    d.position.set(Math.cos(a) * r * 1.2, h / 2, Math.sin(a) * r * .95); d.scale.set(w, h, w); d.rotation.set(0, Math.random(), 0); d.updateMatrix(); bm.setMatrixAt(i, d.matrix); bm.setColorAt(i, c.setHSL(.6 + Math.random() * .08, .15, .25 + Math.random() * .2)); }
  scene.add(bm);
  const seatM = [0xd9261c, 0x37d7ff, 0xf2f2f2].map(h => new THREE.MeshStandardMaterial({ color: h, roughness: .8 }));
  for (const [idx, s] of [[8, 1], [8, -1], [N - 14, 1]]) {
    const p = pts[idx], g = new THREE.Group(); g.position.set(p.x + p.tz * s * (W / 2 + 22), 0, p.z - p.tx * s * (W / 2 + 22)); g.rotation.y = p.h;
    for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(new THREE.BoxGeometry(2.5 * 12, 1.6 * (k + 1), 3), seatM[k % 3]); m.position.set(0, .8 * (k + 1), -s * k * 3 * 0 + s * k * 3); g.add(m); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(34, .4, 20), new THREE.MeshStandardMaterial({ color: 0x20242e })); roof.position.set(0, 10, s * 5); g.add(roof); g.rotation.y = p.h + Math.PI / 2; scene.add(g);
  }
}

// ---- premium procedural cars
const MODELS = [
  { L: 4.5, w: 1.9, bh: .82, ch: .5, hood: .62, cs: -.22, ce: .12, wing: 1, wr: .36 },
  { L: 4.7, w: 2.05, bh: .7, ch: .42, hood: .5, cs: -.18, ce: .1, wing: 2, wr: .37 },
  { L: 4.9, w: 1.95, bh: .95, ch: .55, hood: .8, cs: -.25, ce: .14, wing: 0, wr: .38 },
  { L: 4.4, w: 1.95, bh: .72, ch: .4, hood: .45, cs: -.1, ce: .2, wing: 1, wr: .35 }];
const gc = {}, paints = {};
const carbon = new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: .45, metalness: .5 });
const glass = mobileUA ? new THREE.MeshStandardMaterial({ color: 0x0b1220, metalness: .8, roughness: .12 }) : new THREE.MeshPhysicalMaterial({ color: 0x0b1220, metalness: .9, roughness: .04, clearcoat: 1, envMapIntensity: 1.2 });
const tireM = new THREE.MeshStandardMaterial({ color: 0x0d0d0f, roughness: .9 }), rimM = new THREE.MeshStandardMaterial({ color: 0xd8dde6, metalness: 1, roughness: .2 });
const headM = new THREE.MeshBasicMaterial({ color: 0xeaf6ff });
function paint(c) { return paints[c] || (paints[c] = mobileUA ? new THREE.MeshStandardMaterial({ color: c, metalness: .35, roughness: .3 }) : new THREE.MeshPhysicalMaterial({ color: c, metalness: .5, roughness: .32, clearcoat: 1, clearcoatRoughness: .05, envMapIntensity: 1.1 })); }
function geos(i) {
  if (gc[i]) return gc[i]; const m = MODELS[i], L = m.L, g = {};
  const s = new THREE.Shape(), y0 = .3;
  s.moveTo(-L / 2, y0); s.lineTo(-L / 2, m.bh * .92); s.quadraticCurveTo(-L / 2, m.bh, -L * .4, m.bh); s.lineTo(L * .1, m.bh); s.quadraticCurveTo(L * .28, m.bh, L * .38, m.hood); s.lineTo(L / 2 - .1, m.hood * .82); s.quadraticCurveTo(L / 2, m.hood * .78, L / 2, y0 + .1); s.lineTo(L / 2, y0); s.lineTo(-L / 2, y0);
  const bw = m.w - .3; g.body = new THREE.ExtrudeGeometry(s, { depth: bw, bevelEnabled: true, bevelThickness: .15, bevelSize: .15, bevelSegments: 3, curveSegments: 8 }); g.body.translate(0, 0, -bw / 2);
  const c = new THREE.Shape(); c.moveTo(L * m.cs, m.bh); c.lineTo(L * (m.cs + .1), m.bh + m.ch); c.lineTo(L * (m.ce - .04), m.bh + m.ch); c.lineTo(L * (m.ce + .14), m.bh); c.lineTo(L * m.cs, m.bh);
  const cw = m.w * .72; g.cab = new THREE.ExtrudeGeometry(c, { depth: cw, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2 }); g.cab.translate(0, 0, -cw / 2);
  g.roof = new THREE.BoxGeometry(L * (m.ce - m.cs - .14), .05, cw * .92);
  g.tire = new THREE.CylinderGeometry(m.wr, m.wr, .3, 22).rotateZ(Math.PI / 2); g.rim = new THREE.CylinderGeometry(m.wr * .62, m.wr * .62, .32, 12).rotateZ(Math.PI / 2);
  g.head = new THREE.BoxGeometry(.4, .09, .06); g.tail = new THREE.BoxGeometry(m.w * .8, .08, .05); g.splitter = new THREE.BoxGeometry(m.w * .95, .06, .5);
  g.wing = new THREE.BoxGeometry(m.w * .95, .05, .42); g.post = new THREE.BoxGeometry(.06, .4, .1); return gc[i] = g;
}
function makeCar(i, color) {
  if (glb[i]) return makeGlb(i, color);
  const m = MODELS[i], g = geos(i), grp = new THREE.Group(), body = new THREE.Group(); grp.add(body);
  const add = (geo, mat, x, y, z, parent) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; (parent || body).add(o); return o; };
  const b = add(g.body, paint(color), 0, 0, 0); b.rotation.y = -Math.PI / 2;
  const cab = add(g.cab, glass, 0, 0, 0); cab.rotation.y = -Math.PI / 2;
  add(g.roof, paint(color), m.L * (m.cs + m.ce) / 2 + .05, m.bh + m.ch + .04, 0);
  add(g.splitter, carbon, 0, .32, m.L / 2 - .02).rotation.y = Math.PI / 2; add(g.splitter, carbon, 0, .3, -m.L / 2 + .1).scale.set(.8, 1, .6);
  for (const s of [-1, 1]) add(g.head, headM, s * m.w * .3, m.hood * .66, m.L / 2 + .03);
  const tail = new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1010, emissiveIntensity: .8 }); add(g.tail, tail, 0, m.bh * .78, -m.L / 2 - .04);
  if (m.wing) { const wy = m.bh + .3 + (m.wing === 2 ? .2 : 0); add(g.wing, carbon, 0, wy, -m.L / 2 + .25); for (const s of [-1, 1]) add(g.post, carbon, s * m.w * .3, wy - .2, -m.L / 2 + .25); }
  const wheels = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Group(); w.position.set(sx * (m.w / 2 - .12), m.wr, sz * m.L * .31);
    const t = new THREE.Mesh(g.tire, tireM), r = new THREE.Mesh(g.rim, rimM); t.castShadow = true; w.add(t, r); grp.add(w); wheels.push(w);
  }
  grp.userData = { body, wheels, tail, wr: m.wr }; return grp;
}

// ---- optional real car models: put car0.glb..car3.glb in /public/models (see models/README.txt)
const glb = {}; let glbCfg = {}; const gpaint = {};
function prepModel(root, i) {
  const c = glbCfg[i] || {}, hold = new THREE.Group(), out = new THREE.Group(); hold.add(root);
  let b = new THREE.Box3().setFromObject(root), sz = b.getSize(new THREE.Vector3());
  root.rotation.y = (sz.x > sz.z ? -Math.PI / 2 : 0) + THREE.MathUtils.degToRad(c.rotY || 0); hold.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(hold); sz = b.getSize(new THREE.Vector3()); const ctr = b.getCenter(new THREE.Vector3());
  const k = (c.length || MODELS[i].L) / Math.max(.01, sz.z) * (c.scale || 1);
  hold.scale.setScalar(k); hold.position.set(-ctr.x * k, -b.min.y * k + (c.y || 0), -ctr.z * k); out.add(hold);
  out.traverse(o => { if (o.isMesh) { o.castShadow = true; (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if (m && /body|paint|carpaint|exterior|shell|lak/i.test(m.name || '')) m.userData.paint = 1; }); } });
  return out;
}
function makeGlb(i, color) {
  const grp = new THREE.Group(), body = glb[i].clone(true), spin = (glbCfg[i] || {}).spin, wheels = [];
  body.traverse(o => {
    if (o.isMesh) { const fix = m => { if (!m || !m.userData.paint) return m; const key = m.uuid + color; if (!gpaint[key]) { gpaint[key] = m.clone(); gpaint[key].color.set(color); } return gpaint[key]; }; o.material = Array.isArray(o.material) ? o.material.map(fix) : fix(o.material); }
    if (spin && /wheel|tire|tyre/i.test(o.name) && !(o.parent && /wheel|tire|tyre/i.test(o.parent.name))) wheels.push(o);
  });
  grp.add(body); grp.userData = { body, wheels, tail: { emissiveIntensity: 0 }, wr: .35 }; return grp;
}
async function loadModels() {
  if (!THREE.GLTFLoader) return 0;
  try { glbCfg = await (await fetch('/models/config.json')).json(); } catch {}
  const loader = new THREE.GLTFLoader(); if (THREE.DRACOLoader) { const d = new THREE.DRACOLoader(); d.setDecoderPath('/vendor/examples/libs/draco/gltf/'); loader.setDRACOLoader(d); }
  let n = 0;
  await Promise.all(CARS.map(async (_, i) => { try { const h = await fetch(`/models/car${i}.glb`, { method: 'HEAD' }); if (!h.ok) return;
    const gltf = await new Promise((res, rej) => loader.load(`/models/car${i}.glb`, res, undefined, rej)); glb[i] = prepModel(gltf.scene, i); n++; } catch (e) { console.warn('model ' + i + ' failed', e); } }));
  return n;
}

// ---- state
const st = { mode: 'menu', room: null, my: -1, me: null, tgt: null, snaps: [], cars: {}, laps: LAPS, cd: 0, lastCd: -1, camH: 0, camMode: 0, paused: false, rtt: 80, lastSnap: null, shake: 0 };
let sock = null, menuCar = null, menuAng = 0;
function showMenuCar() {
  if (menuCar) scene.remove(menuCar); menuCar = makeCar(cfg.car, COLORS[cfg.color]); const p = S.at(4, 0); menuCar.position.set(p.x, 0, p.z); menuCar.rotation.y = p.h; scene.add(menuCar);
}

// ---- quality / resize / loop
let ql = 2, fpsAcc = 0, fpsN = 0, fpsT = 0, lowT = 0;
function applyQ(l) { // never toggles shadows/materials at runtime (that broke some mobile GPUs)
  if (!applyQ.init) { applyQ.init = 1; renderer.shadowMap.enabled = !mobileUA; sun.castShadow = !mobileUA; }
  ql = l; renderer.setPixelRatio(Math.min(devicePixelRatio || 1, [0.8, 1.1, 2][l])); scene.fog.far = [520, 640, 720][l]; onResize();
}
function onResize() { const h = (tg && tg.viewportStableHeight) || innerHeight; renderer.setSize(innerWidth, h, false); camera.aspect = innerWidth / h; camera.updateProjectionMatrix(); }
addEventListener('resize', onResize);

applyQ(cfg.q === 'auto' ? (mobileUA ? 1 : 2) : +cfg.q);

// ---- audio
let ac, eng, gain;
function audioInit() { if (ac) { ac.resume && ac.resume(); return; } try { ac = new (window.AudioContext || window.webkitAudioContext)(); eng = ac.createOscillator(); eng.type = 'sawtooth'; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; gain = ac.createGain(); gain.gain.value = 0; eng.connect(f); f.connect(gain); gain.connect(ac.destination); eng.start(); } catch {} }
function beep(f, d) { if (!ac || !cfg.snd) return; const o = ac.createOscillator(), g = ac.createGain(); o.frequency.value = f; g.gain.value = .12; o.connect(g); g.connect(ac.destination); o.start(); g.gain.exponentialRampToValueAtTime(.0001, ac.currentTime + d); o.stop(ac.currentTime + d); }

// ---- input
const keys = {}, touch = { l: 0, r: 0, gas: 0, brk: 0, hb: 0 }, inp = { t: 0, b: 0, s: 0, hb: 0 }; let sSm = 0;
addEventListener('keydown', e => {
  keys[e.code] = 1; audioInit();
  if (e.code === 'KeyC') st.camMode = (st.camMode + 1) % 3; if (e.code === 'KeyR' && sock) sock.emit('respawn');
  if ((e.code === 'Escape' || e.code === 'KeyP') && st.mode === 'race') setPause(!st.paused);
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code) && e.target.tagName !== 'INPUT') e.preventDefault();
});
addEventListener('keyup', e => { keys[e.code] = 0; });
for (const [id, k] of [['tl', 'l'], ['trr', 'r'], ['tg', 'gas'], ['tbk', 'brk'], ['thb', 'hb']]) {
  const el = $('#' + id), on = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch {} touch[k] = 1; el.classList.add('on'); audioInit(); }, off = e => { e.preventDefault(); touch[k] = 0; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off); el.addEventListener('contextmenu', e => e.preventDefault());
}
function readInput(dt) {
  const k = keys, sens = [0.7, 1, 1.35][cfg.sens];
  inp.b = (k.KeyS || k.ArrowDown) ? 1 : touch.brk;
  inp.t = (k.KeyW || k.ArrowUp) ? 1 : (touch.gas || (cfg.auto && !inp.b) ? 1 : 0);
  const tgt = clamp(((k.KeyD || k.ArrowRight) ? 1 : 0) - ((k.KeyA || k.ArrowLeft) ? 1 : 0) + touch.r - touch.l, -1, 1);
  const rate = (tgt !== 0 && Math.sign(tgt) === Math.sign(sSm || tgt) ? 4.5 * sens : 11); // progressive: hold longer = turn harder, release = recentre fast
  sSm += clamp(tgt - sSm, -rate * dt, rate * dt);
  let s = sSm;
  if (cfg.assist && st.me) { const p = pts[(st.me.idx + 5) % N], e = S.angDiff(p.h, st.me.h); s += clamp(-e * 1.6, -1, 1) * 0.6 * (1 - Math.abs(sSm)); } // gentle lane assist, fades when you steer
  s = clamp(s, -1, 1); inp.s = Math.abs(s) < .03 ? 0 : s; inp.hb = (k.Space || touch.hb) ? 1 : 0;
}
if (tg && tg.BackButton) tg.BackButton.onClick(() => { if (st.mode === 'race') setPause(!st.paused); else show('home'); });

// ---- UI
const screens = ['home', 'garage', 'lobby', 'pause', 'settings', 'results'];
function show(id) { for (const s of screens) $('#' + s).classList.toggle('hide', s !== id && !(id === 'settings' && s === 'pause' && st.paused)); if (id === 'settings' && st.paused) $('#pause').classList.add('hide'); if (tg && tg.BackButton) (id === 'home' || !id) ? tg.BackButton.hide() : tg.BackButton.show(); }
function setHud(on) { $('#hud').classList.toggle('hide', !on); $('#pbtn').classList.toggle('hide', !on); $('#touch').classList.toggle('hide', !(on && touchDev)); }
function setPause(p) { st.paused = p; $('#pause').classList.toggle('hide', !p); if (p) { for (const k in touch) touch[k] = 0; } if (tg && tg.BackButton) p ? tg.BackButton.show() : tg.BackButton.hide(); }
$('#nm').value = cfg.name; $('#nm').onchange = e => { cfg.name = e.target.value.trim().slice(0, 16) || cfg.name; store.set('name', cfg.name); };
$('#play').onclick = () => { audioInit(); cfg.name = $('#nm').value.trim().slice(0, 16) || cfg.name; store.set('name', cfg.name); queue(); };
$('#bgar').onclick = () => { show('garage'); }; $('#gback').onclick = $('#gok').onclick = () => show('home');
$('#bset').onclick = () => show('settings'); $('#sclose').onclick = () => { $('#settings').classList.add('hide'); if (st.paused) $('#pause').classList.remove('hide'); else show('home'); };
$('#pbtn').onclick = () => setPause(true); $('#presume').onclick = () => setPause(false);
$('#pset').onclick = () => { $('#pause').classList.add('hide'); $('#settings').classList.remove('hide'); };
$('#pquit').onclick = () => { setPause(false); leaveRace(); }; $('#lcancel').onclick = () => leaveRace();
$('#again').onclick = () => { $('#results').classList.add('hide'); resetRace(); queue(); }; $('#rmenu').onclick = () => leaveRace();
function buildGarage() {
  const box = $('#cars'); box.innerHTML = '';
  CARS.forEach((c, i) => { const d = document.createElement('div'); d.className = 'card' + (i === cfg.car ? ' on' : '');
    const bar = (n, v) => `<div class="bar">${n}<i><s style="width:${v}%"></s></i></div>`;
    d.innerHTML = `<h3>${c.name}</h3><small>${c.cls}</small>${bar('Top speed', (c.top - 45) / 25 * 100)}${bar('Acceleration', (c.acc - 15) / 15 * 100)}${bar('Handling', (c.hand * 0.3 + c.grip * 0.1 - .3) * 85)}${bar('Braking', (c.brk - 22) / 20 * 100)}`;
    d.onclick = () => { cfg.car = i; store.set('car', i); buildGarage(); showMenuCar(); }; box.appendChild(d); });
  const sw = $('#sw'); sw.innerHTML = ''; COLORS.forEach((c, i) => { const s = document.createElement('span'); s.style.background = c; s.className = i === cfg.color ? 'on' : ''; s.onclick = () => { cfg.color = i; store.set('color', i); buildGarage(); showMenuCar(); }; sw.appendChild(s); });
}
function seg(id, get, set) { const el = $(id); const paint = () => [...el.children].forEach(b => b.classList.toggle('on', String(get()) === b.dataset.v)); el.onclick = e => { const v = e.target.dataset && e.target.dataset.v; if (v == null) return; set(v); paint(); }; paint(); }
seg('#sq', () => cfg.q, v => { cfg.q = v; store.set('q', v); applyQ(v === 'auto' ? (mobileUA ? 1 : 2) : +v); });
seg('#sn', () => cfg.sens, v => { cfg.sens = +v; store.set('sens', +v); }); seg('#sa', () => cfg.assist, v => { cfg.assist = +v; store.set('assist', +v); }); seg('#sg', () => cfg.auto, v => { cfg.auto = +v; store.set('auto', +v); });
seg('#ss', () => cfg.snd, v => { cfg.snd = +v; store.set('snd', +v); }); seg('#sf', () => cfg.fps, v => { cfg.fps = +v; store.set('fps', +v); $('#fps').classList.toggle('hide', !+v); });
$('#fps').classList.toggle('hide', !cfg.fps);

// ---- networking
function conn(ok) { $('#cd').className = 'dot ' + (ok ? 'ok' : 'bad'); if (!ok) $('#pg').textContent = 'reconnecting…'; }
function ensureSock() {
  if (sock) return; sock = io({ transports: ['websocket', 'polling'], reconnection: true });
  sock.on('connect', () => { conn(true); if (st.mode === 'lobby' || st.mode === 'race') join(); });
  sock.on('disconnect', () => conn(false)); sock.on('connect_error', e => { conn(false); if (st.mode === 'lobby') $('#lt').textContent = 'Cannot reach server - retrying…'; });
  sock.on('lobby', d => { if (st.mode !== 'lobby') return; $('#lt').textContent = d.left > 0 ? `Race starts in ${d.left}s` : 'Starting…'; $('#ln').textContent = `${d.n}/${d.max}`; $('#la').textContent = `${d.n} driver${d.n > 1 ? 's' : ''} + ${d.max - d.n} AI rivals fill the grid`; });
  sock.on('room', d => { st.room = d; st.my = d.you; st.laps = d.laps; st.mode = 'race'; st.snaps = []; st.me = null; st.lastCd = -1; clearCars(); d.cars.forEach(c => { const m = makeCar(c.carId, c.color); m.visible = false; scene.add(m); st.cars[c.id] = { m, prev: 0, vf: 0, spin: 0 }; }); if (menuCar) menuCar.visible = false; show(''); setHud(true); buildBoardNames(); });
  sock.on('snap', onSnap);
  sock.on('results', showResults);
  setInterval(() => { if (sock.connected) { const t = performance.now(); sock.emit('ping2', () => { st.rtt = performance.now() - t; $('#pg').textContent = Math.round(st.rtt) + ' ms'; }); } }, 2000);
  setInterval(() => { if (st.mode === 'race' && sock.connected && !st.paused) sock.volatile.emit('in', inp); }, 33);
}
function join() { sock.emit('join', { uid: cfg.uid, name: cfg.name, carId: cfg.car, color: COLORS[cfg.color], initData: tg ? tg.initData : '' }); }
function queue() { ensureSock(); st.mode = 'lobby'; show('lobby'); $('#lt').textContent = 'Connecting…'; $('#ln').textContent = '…'; $('#la').textContent = ''; if (sock.connected) join(); }
function clearCars() { for (const k in st.cars) scene.remove(st.cars[k].m); st.cars = {}; }
function resetRace() { clearCars(); st.room = null; st.me = null; st.snaps = []; setHud(false); if (menuCar) menuCar.visible = true; }
function leaveRace() { if (sock) sock.emit('leave'); st.mode = 'menu'; resetRace(); setPause(false); show('home'); }
function onSnap(s) {
  const now = performance.now(), by = {}; for (const c of s.c) by[c[0]] = c;
  st.snaps.push({ at: now, t: s.t, by }); if (st.snaps.length > 30) st.snaps.shift(); st.lastSnap = s; st.cd = s.cd; st.go = s.s;
  const me = by[st.my]; if (!me) return;
  const owd = st.rtt / 2000 + 0.03;
  if (!st.me) { st.me = { x: me[1], z: me[2], h: me[3], vx: me[4], vz: me[5], vf: 0, vl: 0, idx: 0, off: 0 }; S.nearest(st.me); for (let i = 0; i < 20; i++) S.nearest(st.me); }
  st.tgt = { x: me[1] + me[4] * owd, z: me[2] + me[5] * owd, h: me[3], vx: me[4], vz: me[5] };
}

// ---- results
const fmt = ms => ms == null ? '--' : `${Math.floor(ms / 60000)}:${(ms / 1000 % 60).toFixed(2).padStart(5, '0')}`;
function showResults(d) {
  st.mode = 'results'; setHud(false); setTimeout(() => {
    const mine = d.list.find(r => r.id === st.my); $('#rt').textContent = mine ? `You finished P${mine.pos}` : 'Results'; $('#rs').textContent = mine ? `Best lap ${fmt(mine.best)}` : '';
    $('#rtab').innerHTML = d.list.map(r => `<tr class="${r.id === st.my ? 'me' : ''}"><td>${r.pos}</td><td>${r.human ? '' : '🤖 '}${r.name.replace(/[<>&]/g, '')}</td><td>${CARS[r.carId].name}</td><td style="text-align:right">${r.time != null ? fmt(r.time) : 'DNF'}</td></tr>`).join('');
    show('results'); }, 1200);
}

// ---- HUD
const mm = $('#mm'), mg = mm.getContext('2d'); let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
for (const p of pts) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
const mscale = Math.min((mm.width - 24) / (maxX - minX), (mm.height - 24) / (maxZ - minZ)), mp = (x, z) => [12 + (x - minX) * mscale, 12 + (z - minZ) * mscale];
let boardNames = [];
function buildBoardNames() { boardNames = st.room.cars.map(c => c.name.replace(' (AI)', '')); }
let hudT = 0;
function updateHud(now) {
  if (now - hudT < 120 || !st.lastSnap) return; hudT = now; const s = st.lastSnap, mine = s.c.find(c => c[0] === st.my); if (!mine) return;
  $('#hp').textContent = mine[7]; $('#hl').textContent = `Lap ${Math.min(st.laps, mine[6] + 1)}/${st.laps}`;
  const sp = st.me ? Math.hypot(st.me.vx, st.me.vz) : 0; $('#sv').textContent = Math.round(sp * 3.6); $('#gf').setAttribute('stroke-dasharray', `${clamp(sp / 70 * 100, 0, 100)} 100`);
  const t = s.et / 1000; $('#tm').textContent = s.s ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : '';
  $('#board').innerHTML = s.c.slice().sort((a, b) => a[7] - b[7]).slice(0, 6).map(c => `<div class="${c[0] === st.my ? 'me' : ''}">${c[7]}. ${boardNames[c[0]] || ''}</div>`).join('');
  mg.clearRect(0, 0, mm.width, mm.height); mg.lineWidth = 7; mg.strokeStyle = 'rgba(255,255,255,.35)'; mg.lineJoin = 'round'; mg.beginPath(); pts.forEach((p, i) => { const [x, y] = mp(p.x, p.z); i ? mg.lineTo(x, y) : mg.moveTo(x, y); }); mg.closePath(); mg.stroke();
  for (const c of s.c) { const [x, y] = mp(c[1], c[2]); mg.fillStyle = c[0] === st.my ? '#37d7ff' : (st.room.cars[c[0]].human ? '#ffd60a' : '#ff3b30'); mg.beginPath(); mg.arc(x, y, c[0] === st.my ? 7 : 5, 0, 7); mg.fill(); }
  const cdn = $('#cdn'); if (!s.s) { const n = Math.ceil(s.cd); cdn.textContent = n; if (n !== st.lastCd) { st.lastCd = n; beep(440, .2); } } else { if (st.lastCd !== 0) { st.lastCd = 0; beep(880, .5); cdn.textContent = 'GO!'; setTimeout(() => { if (st.lastCd === 0) cdn.textContent = ''; }, 900); } }
}

// ---- update & render
const sunOff = new THREE.Vector3(80, 120, 50), tmp = { x: 0, z: 0, idx: 0 };
const lerpA = (a, b, t) => a + S.angDiff(b, a) * t;
function updateRace(dt, now) {
  const me = st.me; if (!me) return; const my = st.room.cars[st.my], stats = CARS[my.carId];
  readInput(dt);
  if (st.go && !st.paused) S.step(me, inp, dt, stats); else if (st.tgt) { me.x = st.tgt.x; me.z = st.tgt.z; me.h = st.tgt.h; me.vx = st.tgt.vx; me.vz = st.tgt.vz; }
  if (st.tgt) { // gentle server reconciliation
    const t = st.tgt; t.x += t.vx * dt; t.z += t.vz * dt; const err = Math.hypot(t.x - me.x, t.z - me.z), k = err > 15 ? 1 : err < 2 ? 0 : 1 - Math.exp(-dt * 1.5); // trust local driving; only correct real drift
    me.x += (t.x - me.x) * k; me.z += (t.z - me.z) * k; me.h = lerpA(me.h, t.h, k); me.vx += (t.vx - me.vx) * k; me.vz += (t.vz - me.vz) * k;
  }
  const rt = now - 110, A = st.snaps; let i = A.length - 1; while (i > 0 && A[i - 1].at > rt) i--;
  const a = A[Math.max(0, i - 1)], b = A[i];
  for (const id in st.cars) {
    const o = st.cars[id], m = o.m; let x, z, h, vx, vz;
    if (+id === st.my) { x = me.x; z = me.z; h = me.h; vx = me.vx; vz = me.vz; }
    else { const ca = a && a.by[id], cb = b && b.by[id]; if (!cb) continue;
      if (ca && cb !== ca && rt >= a.at && rt <= b.at) { const f = (rt - a.at) / (b.at - a.at); x = ca[1] + (cb[1] - ca[1]) * f; z = ca[2] + (cb[2] - ca[2]) * f; h = lerpA(ca[3], cb[3], f); }
      else { const e = Math.min(.25, Math.max(0, (rt - b.at) / 1000)); x = cb[1] + cb[4] * e; z = cb[2] + cb[5] * e; h = cb[3]; }
      vx = cb[4]; vz = cb[5]; }
    m.visible = true; m.position.set(x, 0, z); m.rotation.y = h;
    const vf = vx * Math.sin(h) + vz * Math.cos(h), vl = vx * Math.cos(h) - vz * Math.sin(h);
    m.userData.body.rotation.z = lerpA(m.userData.body.rotation.z, clamp(vl * .006, -.08, .08), .15); m.userData.body.rotation.x = lerpA(m.userData.body.rotation.x, clamp((o.vf - vf) * .01, -.05, .05), .15);
    m.userData.tail.emissiveIntensity = (o.vf - vf > .25 * dt * 60 * .1 || (+id === st.my && inp.b > 0)) ? 3 : .7; o.vf = vf;
    for (const w of m.userData.wheels) w.rotation.x += vf * dt / m.userData.wr;
  }
  // camera
  const sp = Math.hypot(me.vx, me.vz); st.camH = lerpA(st.camH, me.h, 1 - Math.exp(-dt * (st.camMode === 1 ? 20 : 5)));
  const sh = Math.sin(st.camH), ch = Math.cos(st.camH); let cx, cy, cz, lx, ly, lz;
  if (st.camMode === 1) { cx = me.x + Math.sin(me.h) * .6; cy = 1.1; cz = me.z + Math.cos(me.h) * .6; lx = me.x + sh * 30; ly = 1; lz = me.z + ch * 30; }
  else { const d = st.camMode === 2 ? 20 : 11 + sp * .04, hgt = st.camMode === 2 ? 9 : 4.2; cx = me.x - sh * d; cy = hgt; cz = me.z - ch * d; lx = me.x + sh * 10; ly = 1; lz = me.z + ch * 10; }
  tmp.x = cx; tmp.z = cz; tmp.idx = me.idx; S.nearest(tmp); if (Math.abs(tmp.off) > LIM + 2) { const p = pts[tmp.idx], e = (Math.abs(tmp.off) - LIM - 2) * Math.sign(tmp.off); cx -= p.tz * e; cz += p.tx * e; } // camera stays inside the barriers
  camera.position.set(cx, Math.max(.8, cy), cz); camera.lookAt(lx, ly, lz); camera.fov += (62 + Math.min(18, sp * .28) - camera.fov) * .1; camera.updateProjectionMatrix();
  sun.position.set(me.x + sunOff.x, sunOff.y, me.z + sunOff.z); sun.target.position.set(me.x, 0, me.z);
  if (ac && gain) { eng.frequency.value = 55 + sp * 3.4; gain.gain.value = cfg.snd && !st.paused ? .035 + .04 * inp.t : 0; }
  updateHud(now);
}
function updateMenu(dt) {
  menuAng += dt * .35; const p = S.at(4, 0); camera.position.set(p.x + Math.sin(menuAng) * 11, 2.4, p.z + Math.cos(menuAng) * 11); camera.lookAt(p.x, -1.1, p.z); camera.fov = 50; camera.updateProjectionMatrix();
  sun.position.set(p.x + 80, 120, p.z + 50); sun.target.position.set(p.x, 0, p.z); if (menuCar) menuCar.userData.wheels.forEach(w => w.rotation.x += dt * 2); if (gain) gain.gain.value = 0;
}
let raf = 0, last = performance.now();
function frame(now) {
  raf = requestAnimationFrame(frame); const dt = Math.min(.05, (now - last) / 1000); last = now;
  if (st.mode === 'race' || st.mode === 'results') { if (st.room && st.me) updateRace(dt, now); else updateMenu(dt); } else updateMenu(dt);
  renderer.render(scene, camera);
  fpsAcc += dt; fpsN++; if (fpsAcc >= 1) { const f = fpsN / fpsAcc; if (cfg.fps) $('#fps').textContent = Math.round(f) + ' fps'; fpsAcc = 0; fpsN = 0;
    if (cfg.q === 'auto' && st.mode === 'race' && f < 38 && ql > 0) { if (++lowT >= 2) { applyQ(ql - 1); lowT = 0; } } else lowT = 0; }
}
document.addEventListener('visibilitychange', () => { cancelAnimationFrame(raf); if (!document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } });

// ---- boot
addEventListener('error', e => { $('#pg').textContent = 'err: ' + String(e.message).slice(0, 40); });
buildGarage(); showMenuCar(); onResize(); show('home'); ensureSock();
loadModels().then(n => { if (n) { $('#mdl').textContent = n + '/4 models'; showMenuCar(); } });
requestAnimationFrame(frame);
$('#lbar').style.width = '100%'; setTimeout(() => { const l = $('#load'); l.style.opacity = 0; setTimeout(() => l.remove(), 600); }, 700);
})();
