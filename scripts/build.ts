/**
 * 静态站点生成器。
 *
 * 这一步做的是「把数据渲染成文件」——没有服务器、没有框架、没有依赖。
 * 输入只有两份东西：
 *   - data/snapshot.json      同步管线产出的结构化快照
 *   - public/avatars/*.svg    形象生成器产出的 Q 版形象
 * 输出是 dist/ 下一整棵可以直接扔给任意静态托管的目录树。
 *
 * 为什么不做成带运行时的站点：这个站的每一条内容都来自构建期就已知的快照，
 * 运行时再算一遍除了引入故障面以外没有任何好处。产物是纯 HTML，
 * 打开就是最终结果，也不需要任何密钥。
 *
 * 路径约定：所有页面内部的链接都用**相对路径**（root 参数），
 * 所以 dist/ 既能挂在域名根目录，也能挂在 /sub/path/ 下，还能直接双击打开看。
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadSnapshot } from '../src/lib/snapshot.ts';
import { lineKeyOf } from '../src/lib/derive.ts';
import { CSS } from '../src/site/css.ts';
import { vendorProfile } from '../src/content/vendors.ts';
import {
  homePage,
  leaderboardPage,
  makeCtx,
  modelPage,
  pricingPage,
  vendorPage,
  vendorsPage,
} from '../src/site/pages.ts';
import type { Snapshot } from '../src/lib/types.ts';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'dist');
const AVATARS = path.join(ROOT, 'public', 'avatars');

/** 站点绝对地址。只在生成 sitemap 时用到；没配就跳过，不猜一个域名写进去。 */
const SITE_URL = (process.env.SITE_URL ?? '').replace(/\/+$/, '');

/**
 * 部署路径前缀。
 *
 * 全站页面之间的链接都是**相对路径**，所以挂在根目录还是子目录都一样能跑——
 * 唯一的例外是 404.html：它会被托管平台用于任意深度的无效 URL，
 * 相对路径在那个位置无从推断，只能在这里烘死一个前缀。
 * 用户主页/自定义域名用默认 '/'；GitHub Pages 的项目页设成 '/仓库名/'。
 */
const BASE_PATH = (() => {
  const raw = (process.env.BASE_PATH ?? '/').trim();
  return '/' + raw.replace(/^\/+|\/+$/g, '') + (raw.replace(/^\/+|\/+$/g, '') ? '/' : '');
})();


const started = Date.now();
let fileCount = 0;

function write(rel: string, content: string | Buffer): void {
  const dest = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content);
  fileCount++;
}

function step<T>(label: string, fn: () => T): T {
  const t = Date.now();
  const out = fn();
  const ms = Date.now() - t;
  console.log(`  ${label.padEnd(28, '·')} ${String(ms).padStart(5)} ms`);
  return out;
}

// ────────────────────────────────────────────────────────────
// 站标。和 :root 里的 --brand 同色，保证导航栏与标签页是同一个视觉身份。
// ────────────────────────────────────────────────────────────
const FAVICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<rect width="64" height="64" rx="14" fill="#4a4ee0"/>
<rect x="12" y="34" width="8" height="18" rx="4" fill="#c9caff"/>
<rect x="26" y="22" width="8" height="30" rx="4" fill="#ffffff"/>
<rect x="40" y="14" width="8" height="38" rx="4" fill="#c9caff"/>
</svg>`;

// ────────────────────────────────────────────────────────────
// 404。托管平台会拿它兜底任意深度的无效 URL，所以这一页刻意做到完全自包含：
// 样式内联、不引外部资源，唯一的路径依赖是 BASE_PATH（见上）。
// ────────────────────────────────────────────────────────────
function notFoundPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>页面不存在 · 大模型对比台</title>
<meta name="robots" content="noindex">
<style>${CSS}</style>
</head>
<body>
<main><div class="wrap" style="padding:60px 20px 80px">
  <div class="panel pad" style="max-width:660px">
    <div class="tag dim">404</div>
    <h1 style="margin-top:10px">没有这个页面</h1>
    <p class="lede" style="margin:10px 0 18px">
      你要找的模型可能已经被上游名单移除，或者链接里的标识拼错了。
      本站的模型清单完全跟随上游快照——模型退役后它的页面也会随之消失，
      不会有任何一个人工维护的「过时页面」留在这里。
    </p>
    <div class="pill-row">
      <a class="btn" href="${BASE_PATH}">回首页</a>
      <a class="btn ghost" href="${BASE_PATH}leaderboard/">看排行榜</a>
      <a class="btn ghost" href="${BASE_PATH}pricing/">比价格</a>
    </div>
  </div>
</div></main>
</body>
</html>`;
}

// ────────────────────────────────────────────────────────────
// 主流程
// ────────────────────────────────────────────────────────────
console.log('\n▌ 生成静态站点\n');

const snapshot: Snapshot = loadSnapshot();
console.log(`  快照 ${snapshot.generatedAt} · ${snapshot.models.length} 模型 / ${snapshot.vendors.length} 厂商\n`);

if (snapshot.models.length === 0) {
  console.error('✗ 快照里一个模型都没有，拒绝生成一个空站点。请先跑 npm run sync。');
  process.exit(1);
}

// 每次都从干净的目录开始，避免上一版的残留页面被当成还活着。
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const ctx = step('建标尺（全站分位）', () => makeCtx(snapshot));

// 样式与站标：站标不进 dist 也无所谓，但它是页面 <head> 里写死的引用，必须存在。
step('写样式与站标', () => {
  write('style.css', CSS);
  write('favicon.svg', FAVICON);
  // GitHub Pages 默认跑 Jekyll，会吞掉下划线开头的文件/目录。占位即关闭。
  write('.nojekyll', '');
});

// 形象是位图之外唯一的美术资产，直接整目录搬过去。
if (!fs.existsSync(AVATARS)) {
  console.error('✗ public/avatars 不存在。请先跑 npm run avatars。');
  process.exit(1);
}
const avatarFiles = fs.readdirSync(AVATARS).filter((f) => f.endsWith('.svg'));
step(`拷贝 ${avatarFiles.length} 张形象`, () => {
  // 逐个 copyFileSync，不用 fs.cpSync：后者在 Windows 的某些文件系统组合下
  // 会整个进程静默崩掉（退出码 127、没有任何错误输出），而这里只需要拷平铺的一层。
  fs.mkdirSync(path.join(OUT, 'avatars'), { recursive: true });
  for (const f of avatarFiles) {
    fs.copyFileSync(path.join(AVATARS, f), path.join(OUT, 'avatars', f));
    fileCount++;
  }
});

// 主页面。「数据与方法」不在这里——那份说明是给项目内部看的文档（docs/数据与方法.md），
// 做成站点页面会把「读者要的结论」和「维护者要的方法」混在一起，也会给静态站多加一个
// 与模型/价格无关的入口。
step('渲染主页面', () => {
  write('index.html', homePage(ctx, ''));
  write('leaderboard/index.html', leaderboardPage(ctx, '../'));
  write('pricing/index.html', pricingPage(ctx, '../'));
  write('vendors/index.html', vendorsPage(ctx, '../'));
  write('404.html', notFoundPage());
});

// 厂商页：根 → vendor/{id}/
step(`渲染 ${snapshot.vendors.length} 个厂商页`, () => {
  for (const v of snapshot.vendors) {
    write(`vendor/${v.id}/index.html`, vendorPage(ctx, v.id, '../../'));
  }
});

// 模型页：根 → model/{slug}/
step(`渲染 ${snapshot.models.length} 个模型页`, () => {
  const seen = new Set<string>();
  for (const m of snapshot.models) {
    if (seen.has(m.slug)) {
      // 上游有两个模型撞了同一个 slug。宁可少生成一个页面，也不要静默互相覆盖。
      console.warn(`  ! slug 冲突，跳过：${m.slug}（${m.key}）`);
      continue;
    }
    seen.add(m.slug);
    write(`model/${m.slug}/index.html`, modelPage(ctx, m, '../../'));
  }
});

// 搜索索引：顶栏那个搜索框唯一的数据来源。
// 字段名刻意压到一个字母——四千多条记录，字段名本身也是流量。
step('生成搜索索引', () => {
  const index = snapshot.models.map((m) => ({
    n: m.name, // 模型名
    v: vendorProfile(m.vendorId, m.vendorName).nameZh || m.vendorName, // 厂商中文名
    k: lineKeyOf(m), // 产品线键，用来支持「搜 gpt-5 出整条线」
    c: m.contextWindow ?? 0, // 上下文，命中的行会顺带显示
    s: m.slug, // 跳转用
  }));
  write('search-index.json', JSON.stringify(index));
});

// sitemap：只有在配了 SITE_URL 时才写。没有域名时写相对路径是无效的 sitemap，
// 与其产出一个错的，不如不产出。
if (SITE_URL) {
  step('生成 sitemap.xml', () => {
    const urls = [
      '',
      'leaderboard/',
      'pricing/',
      'vendors/',
      ...snapshot.vendors.map((v) => `vendor/${v.id}/`),
      ...snapshot.models.map((m) => `model/${m.slug}/`),
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) =>
      `  <url><loc>${SITE_URL}/${u}</loc>${
        snapshot.generatedAt ? `<lastmod>${snapshot.generatedAt.slice(0, 10)}</lastmod>` : ''
      }</url>`,
  )
  .join('\n')}
</urlset>`;
    write('sitemap.xml', xml);
    write('robots.txt', `User-agent: *\nAllow: /\nSitemap: ${SITE_URL}/sitemap.xml\n`);
  });
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
console.log(`\n✓ 完成：${fileCount} 个文件写入 dist/，用时 ${secs}s`);
console.log(`  预览：npm run serve  （或直接把 dist/index.html 拖进浏览器）`);
if (!SITE_URL) console.log('  提示：设 SITE_URL=https://你的域名 可额外生成 sitemap.xml 与 robots.txt');
console.log('');
