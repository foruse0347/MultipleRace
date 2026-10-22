// Telegram bot (long polling). Runs inside server.js by default, or alone via `npm run bot`.
try { require('dotenv').config(); } catch {}
const BOT_TOKEN = process.env.BOT_TOKEN || '';
const GAME_URL = process.env.GAME_URL || 'https://multiplerace-7fpw.onrender.com';
const BOT_USERNAME = process.env.BOT_USERNAME || 'MultipleRaceBot';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function api(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
  return r.json();
}
async function start() {
  if (!BOT_TOKEN) { console.error('[bot] BOT_TOKEN missing - bot not started.'); return; }
  await api('deleteWebhook', {});
  await api('setChatMenuButton', { menu_button: { type: 'web_app', text: 'Play Racing', web_app: { url: GAME_URL } } });
  console.log(`[bot] @${BOT_USERNAME} polling, game: ${GAME_URL}`);
  let offset = 0;
  for (;;) {
    try {
      const r = await api('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      if (!r.ok) { console.error('[bot]', r.description); await sleep(5000); continue; }
      for (const u of r.result) {
        offset = u.update_id + 1;
        const m = u.message;
        if (m && m.text && m.text.startsWith('/start')) {
          api('sendMessage', {
            chat_id: m.chat.id,
            text: '🏁 Welcome to MultipleRace!\n\nRace against up to 9 real drivers - every grid is filled to 10 cars with AI rivals. Tap below to hit the track.',
            reply_markup: { inline_keyboard: [[{ text: '🏎️ Play Racing', web_app: { url: GAME_URL } }]] }
          });
        }
      }
    } catch (e) { console.error('[bot] error', e.message); await sleep(3000); }
  }
}
module.exports = { start };
if (require.main === module) start();
