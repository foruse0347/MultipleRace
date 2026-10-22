// Starts the server, joins 2 real clients, checks 10 cars, synced snapshots, AI laps.
const { spawn } = require('child_process'); const { io } = require('socket.io-client');
const port = 3999, env = Object.assign({}, process.env, { PORT: port, LOBBY_SECONDS: 2, COUNTDOWN_SECONDS: 1, RUN_BOT: '0', ALLOW_NO_BOT: '1' });
const srv = spawn('node', ['server.js'], { env, stdio: 'inherit' });
const fail = m => { console.error('FAIL:', m); srv.kill(); process.exit(1); };
setTimeout(async () => {
  const h = await (await fetch(`http://127.0.0.1:${port}/health`)).json(); if (!h.ok) fail('health');
  console.log('health ok');
  const mk = n => io(`http://127.0.0.1:${port}`, { transports: ['websocket'] }), a = mk(), b = mk();
  let room = null, maxLap = 0, snaps = 0, ok2 = false;
  const seen = {};
  a.on('connect', () => a.emit('join', { uid: 'guestaaaaaaa1', name: 'A', carId: 1, color: '#e10600' }));
  b.on('connect', () => b.emit('join', { uid: 'guestbbbbbbb2', name: 'B', carId: 2, color: '#0a84ff' }));
  const onRoom = k => d => { seen[k] = d; if (k === 'a') room = d; };
  a.on('room', onRoom('a')); b.on('room', onRoom('b'));
  a.on('snap', s => { snaps++; if (s.c.length !== 10) fail('snapshot cars != 10'); maxLap = Math.max(maxLap, ...s.c.map(c => c[6])); });
  setTimeout(() => {
    if (!room || room.cars.length !== 10) fail('room not 10 cars');
    const humans = room.cars.filter(c => c.human).length; if (humans !== 2) fail('humans != 2');
    if (!seen.b || seen.b.cars.length !== 10) fail('second client not in same room');
    console.log(`room ok: ${room.cars.length} cars = ${humans} humans + ${10 - humans} AI`);
  }, 6000);
  const t = setInterval(() => { if (maxLap >= 1) { clearInterval(t); console.log(`AI completed a lap (snaps received: ${snaps}). ALL OK`); srv.kill(); process.exit(0); } }, 500);
  setTimeout(() => fail('no lap completed in 90s'), 90000);
}, 1200);
