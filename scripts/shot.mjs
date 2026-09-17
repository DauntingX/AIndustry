// 整页截图工具：直接用 Chrome DevTools Protocol 驱动本机 Chrome。
//
// 为什么不用 `chrome --screenshot`：那个 flag 在本机很不稳定，
// 进程退了 0 却什么都不写，也不报错。CDP 能把「加载完成 → 取真实内容高度 →
// 按整页高度重设视口 → 截图」每一步都卡住，失败时还能读到错误。
//
// 零依赖：Node 22 自带全局 WebSocket，不需要 ws / playwright。
//
// 用法：node scripts/shot.mjs <url> <out.png> [width] [extraWaitMs] [maxHeight]

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
];

const [, , url, out, widthArg, waitArg, maxHeightArg] = process.argv;
if (!url || !out) {
  console.error('用法: node scripts/shot.mjs <url> <out.png> [width] [extraWaitMs] [maxHeight]');
  process.exit(2);
}
const WIDTH = Number(widthArg ?? 1440);
const EXTRA_WAIT = Number(waitArg ?? 700);
// 传了 maxHeight 就只截首屏那段。排行榜/比价页能有两万像素高，
// 整页缩略之后字全糊了，什么都核不出来。
const MAX_HEIGHT = Number(maxHeightArg ?? 0);
const PORT = 9333 + Math.floor(Math.random() * 400);

const chromePath = CHROME_CANDIDATES.find((p) => p && fs.existsSync(p));
if (!chromePath) {
  console.error('找不到 Chrome/Edge 可执行文件');
  process.exit(2);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aishot-'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const child = spawn(
  chromePath,
  [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--hide-scrollbars',
    '--disable-extensions',
    '--disable-background-networking',
    '--force-device-scale-factor=1',
    'about:blank',
  ],
  { stdio: ['ignore', 'ignore', 'pipe'] },
);
let chromeErr = '';
child.stderr.on('data', (d) => {
  chromeErr += d.toString();
});

/** 轮询直到 CDP 端点活过来 */
async function waitForDevtools(timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (r.ok) return await r.json();
    } catch {
      /* 还没起来 */
    }
    await sleep(150);
  }
  throw new Error(`DevTools 端口 ${PORT} 在 ${timeoutMs}ms 内没起来\n${chromeErr.slice(0, 800)}`);
}

/** 极简 CDP 客户端：发 id、等同一个 id 的回包 */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  const pending = new Map();
  const listeners = [];
  let nextId = 1;
  const ready = new Promise((res, rej) => {
    ws.addEventListener('open', () => res());
    ws.addEventListener('error', (e) => rej(new Error(`WebSocket 失败: ${e.message ?? e.type}`)));
  });
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${msg.error.message} (${JSON.stringify(msg.error.data ?? '')})`));
      else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners) fn(msg);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error(`CDP 调用超时: ${method}`));
        }
      }, 30000);
    });
  const once = (method) =>
    new Promise((resolve) => {
      const fn = (msg) => {
        if (msg.method === method) {
          listeners.splice(listeners.indexOf(fn), 1);
          resolve(msg.params);
        }
      };
      listeners.push(fn);
    });
  return { ready, send, once, close: () => ws.close() };
}

let cdp;
try {
  await waitForDevtools();

  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('没有可用的 page target');

  cdp = connect(page.webSocketDebuggerUrl);
  await cdp.ready;

  await cdp.send('Page.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const loaded = cdp.once('Page.loadEventFired');
  await cdp.send('Page.navigate', { url });
  await Promise.race([loaded, sleep(15000)]);
  await sleep(EXTRA_WAIT); // 等字体与站点脚本（搜索框等）落地

  // 取真实内容高度，按整页重设视口，避免长页面被截断
  const metrics = await cdp.send('Page.getLayoutMetrics');
  const contentHeight = Math.ceil(
    metrics.cssContentSize?.height ?? metrics.contentSize?.height ?? 1000,
  );
  const fullHeight = MAX_HEIGHT > 0 ? Math.min(contentHeight, MAX_HEIGHT) : Math.min(contentHeight, 20000);
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: WIDTH,
    height: fullHeight,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await sleep(250);

  const shot = await cdp.send('Page.captureScreenshot', {
    format: 'png',
    captureBeyondViewport: !MAX_HEIGHT,
    optimizeForSpeed: false,
  });

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, Buffer.from(shot.data, 'base64'));
  console.log(`OK ${out}  ${WIDTH}x${fullHeight}  ${fs.statSync(out).size} bytes`);
} catch (e) {
  console.error(`FAIL ${url}\n  ${e.message}`);
  if (chromeErr.trim()) console.error(`  chrome stderr: ${chromeErr.trim().slice(0, 500)}`);
  process.exitCode = 1;
} finally {
  try {
    cdp?.close();
  } catch {
    /* ignore */
  }
  child.kill();
  await sleep(200);
  try {
    fs.rmSync(profile, { recursive: true, force: true });
  } catch {
    /* 清理失败不影响结果 */
  }
}
