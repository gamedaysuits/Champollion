#!/usr/bin/env node
/**
 * capture_seam_frames.mjs — render the homepage seam beat by beat to PNGs.
 *
 * WHY THIS EXISTS. The seam is a pinned scroll over a canvas engine whose rAF
 * loop stops when the page reports `document.hidden`. Every embedded/preview
 * browser surface we have reports exactly that, so screenshots taken there are
 * stale frames — the canvas never repainted after the timeline moved. This
 * drives a real headless Chrome over CDP instead, sets the story progress via
 * `window.__SEAM.drive(p)`, and forces one SYNCHRONOUS `drawBase`/`drawFx`
 * pass before each capture so the image cannot be stale.
 *
 * No puppeteer dependency: Node >= 22 ships a global `WebSocket`, which is all
 * CDP needs. It uses the Chrome that puppeteer's cache already has.
 *
 * Usage — start the dev server first (npm start --prefix cli/website), then:
 *   node scripts/capture_seam_frames.mjs <out-dir> [origin]
 *
 * Beat positions are vh markers over SCROLL_VH (see cli/website/src/utils/
 * seamStory.mjs LAYOUT_VH); update them when the runway changes.
 */
import {spawn} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {existsSync, readdirSync} from 'node:fs';
import {homedir} from 'node:os';
// Resolve whatever Chrome the puppeteer cache happens to hold, newest first.
const CACHE = `${homedir()}/.cache/puppeteer/chrome`;
const CHROME = (() => {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  if (!existsSync(CACHE)) throw new Error(`no chrome cache at ${CACHE} — set CHROME_PATH`);
  const rel = readdirSync(CACHE).sort().reverse();
  for (const r of rel) {
    const p = `${CACHE}/${r}/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`;
    if (existsSync(p)) return p;
    const l = `${CACHE}/${r}/chrome-linux64/chrome`;
    if (existsSync(l)) return l;
  }
  throw new Error('no chrome binary found in the puppeteer cache — set CHROME_PATH');
})();
const PORT = 9334;
const OUT = process.argv[2];
const ORIGIN = process.argv[3] || 'http://localhost:3711';
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run',
  '--window-size=1440,900', '--hide-scrollbars', '--force-device-scale-factor=1', '--disable-gpu',
  '--user-data-dir=/tmp/cdp-beats', 'about:blank'], {stdio: 'ignore'});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws, id = 0; const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const m = ++id; pending.set(m, {res, rej}); ws.send(JSON.stringify({id: m, method, params})); });
(async () => {
  for (let i = 0; i < 80; i++) { try { await fetch(`http://127.0.0.1:${PORT}/json/list`); break; } catch { await sleep(250); } }
  const t = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).find((x) => x.type === 'page');
  ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r) => { ws.onopen = r; });
  ws.onmessage = (ev) => { const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const {res, rej} = pending.get(m.id); pending.delete(m.id);
      m.error ? rej(new Error(JSON.stringify(m.error))) : res(m.result); } };
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', {features: [{name: 'prefers-color-scheme', value: 'dark'}]});
  await send('Page.navigate', {url: ORIGIN + '/'});
  await sleep(13000);
  const ev = async (e) => (await send('Runtime.evaluate', {expression: e, returnByValue: true, awaitPromise: true})).result?.value;
  console.log('ready:', await ev('!!(window.__SEAM && window.__GRAPH_ENGINE && window.__GRAPH_ENGINE.w)'));
  // vh markers from LAYOUT_VH / SCROLL_VH=2070
  const beats = [
    ['01-hero-waveAll',    60/2070],  ['02-gap-red',        330/2070],
    ['03-omni-hubs',      500/2070],  ['04-meta-quote',     720/2070],
    ['05-communities',    860/2070],  ['06-measure-tape',  1010/2070],
    ['07-map-network',   1060/2070],  ['08-lowest-loss',   1225/2070],
    ['09-improve-chain', 1440/2070],  ['10-one-command',   1840/2070],
    ['11-rights-seal',   1975/2070],  ['12-end-in-view',   2040/2070],
  ];
  for (const [name, p] of beats) {
    await ev(`window.__SEAM.drive(${p})`);
    await sleep(900);
    // force a synchronous render — the headless page reports hidden, so rAF is idle
    await ev(`(()=>{const e=window.__GRAPH_ENGINE;const n=performance.now();e.dirty=true;e.drawBase(n);e.drawFx(n,16);return 1})()`);
    await sleep(200);
    const {data} = await send('Page.captureScreenshot', {format: 'png'});
    writeFileSync(`${OUT}/${name}.png`, Buffer.from(data, 'base64'));
    console.log('wrote', name);
  }
  ws.close(); proc.kill();
})().catch((e) => { console.error('FAIL', e); proc.kill(); process.exit(1); });
