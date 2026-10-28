#!/usr/bin/env node
/* Opens the game in headless Chrome (no npm: Chrome's DevTools protocol over Node's own WebSocket), muted, and
     node tools/browser.js check [url]        boots it, runs game.check({ quick: true }) and game.provePlayCheck(), lists console errors
     node tools/browser.js shot out.jpg [url]  the title screen at 1200x750, as a JPEG (docs/screenshot.jpg)
   The url defaults to index.html as a file:// page, which is what a double-click opens. */
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = path.join(__dirname, '..');
const [mode = 'check', a1, a2] = process.argv.slice(2);
const url = (mode === 'shot' ? a2 : a1) || 'file://' + path.join(root, 'index.html');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'jb-chrome-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--window-size=1200,750',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--autoplay-policy=user-gesture-required',
  '--hide-scrollbars', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function main() {
  // Chrome picks a free port and writes it into our own profile, so two sessions' runs can never meet on one port
  let port = 0, targets;
  for (let k = 0; k < 100 && !port; k++) {
    try { port = +fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (e) { await sleep(100); }
  }
  for (let k = 0; k < 50; k++) {
    try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch (e) { await sleep(200); }
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) { waiting.get(msg.id)(msg); waiting.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push(msg.params.args.map((x) => x.value || x.description).join(' '));
  });
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; waiting.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'evaluate failed');
    return r.result.result.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 750, deviceScaleFactor: 1, mobile: false });
  // muted before the game's first script runs, and a first visit (no saved progress)
  await send('Page.addScriptToEvaluateOnNewDocument', { source: "try { localStorage.setItem('claudeGames.muted', '1'); localStorage.removeItem('juiceBarTT.v1'); localStorage.removeItem('claudeGames.lang'); } catch (e) {}" });
  await send('Page.navigate', { url });
  for (let k = 0; k < 100; k++) {
    await sleep(150);
    try { if (await evaluate("!!window.game && document.getElementById('loading').classList.contains('hidden')")) break; } catch (e) { /* loading */ }
  }
  if (mode === 'shot') {
    await sleep(2500); // the attract demo runs a little and the fonts settle
    const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
    fs.writeFileSync(a1, Buffer.from(shot.result.data, 'base64'));
    console.log(`wrote ${a1}`);
  } else {
    const boot = await evaluate('JSON.stringify({ screen: game.G.screen, muted: Kit.sound.isMuted(), title: document.title })');
    console.log('boot:', boot);
    const rules = await evaluate('JSON.stringify((({ ok, fails, fps, catches, empties, splashes }) => ({ ok, fails: fails.slice(0, 5), fps, catches, empties, splashes }))(game.check({ quick: true })))');
    console.log('game.check({ quick: true }):', rules);
    const play = await evaluate('JSON.stringify(game.provePlayCheck())');
    const p = JSON.parse(play);
    console.log(`game.provePlayCheck(): ok ${p.ok}; real ${p.real.passed} passed, ${p.real.failed} failed; sabotage failures: mirror ${p.mirror.failed}, flipRows ${p.flipRows.failed}, stuckFill ${p.stuckFill.failed}, stuckOops ${p.stuckOops.failed}`);
    for (const l of p.real.log || []) console.log('  ' + l);
    for (const f of p.real.fails) console.log('  FAIL ' + f);
  }
  console.log(errors.length ? `console errors: ${errors.length}\n  ${errors.slice(0, 5).join('\n  ')}` : 'console errors: none');
  ws.close();
}
main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => { chrome.kill(); });
