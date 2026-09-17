/**
 * 产物体检。
 *
 * 这个站在线上是无人值守的，所以「构建成功」不等于「发布安全」——
 * 一个上游新模型的名字里带个斜杠，就可能让几百个页面里的链接指向不存在的路径，
 * 而构建过程会安安静静地全部成功。这类问题必须在发布前拦住。
 *
 * 检查六件事：
 *   1. 渲染残留 —— 页面上不该出现 undefined / NaN / [object Object]
 *   2. Markdown 泄漏 —— 页面上不该出现 **加粗** 这类没被渲染的标记
 *   3. 零价语义 —— 不该出现裸露的 $0（详见下方 ZERO_PRICE 说明）
 *   4. 内部链接 —— 每个 href 都要能在 dist/ 里找到对应文件
 *   5. 形象引用 —— 每个 <img src="...avatars/..."> 都要真实存在
 *   6. 搜索索引 —— 每一条都要指向一个真实生成的模型页
 *
 * 任何一条不过就以非零退出码结束，让 CI 直接红掉。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');

if (!fs.existsSync(DIST)) {
  console.error('✗ dist/ 不存在，先跑 npm run build。');
  process.exit(1);
}

/** 递归收集 dist 下的全部文件，返回相对 POSIX 路径。 */
function walk(dir: string, base = ''): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...walk(path.join(dir, e.name), rel));
    else out.push(rel);
  }
  return out;
}

const all = walk(DIST);
const files = new Set(all);
/** 目录集合：`model/xxx/` 这种以斜杠结尾的链接要命中它。 */
const dirs = new Set<string>(['']);
for (const f of all) {
  const parts = f.split('/');
  parts.pop();
  let acc = '';
  for (const p of parts) {
    acc = acc ? `${acc}/${p}` : p;
    dirs.add(acc);
  }
}

const pages = all.filter((f) => f.endsWith('.html'));

const problems: { file: string; kind: string; detail: string }[] = [];
const add = (file: string, kind: string, detail: string) => problems.push({ file, kind, detail });

// 从 URL 引用解析出 dist 内的目标路径（去掉 query/hash/相对前缀）。
function resolveRef(fromFile: string, ref: string): string | null {
  if (!ref || ref.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//')) return null;
  const clean = ref.split('#')[0].split('?')[0];
  if (!clean) return null;
  const fromDir = path.posix.dirname(fromFile);
  let joined = path.posix.normalize(path.posix.join(fromDir, decodeURIComponent(clean)));
  joined = joined.replace(/^\.\//, '').replace(/^\/+/, '');
  if (joined === '.' || joined === '') return '';
  return joined;
}

// ── 逐页扫描 ────────────────────────────────────────────────
for (const f of pages) {
  const raw = fs.readFileSync(path.join(DIST, f), 'utf8');

  // 内联脚本必须先剔除：顶栏搜索是用字符串拼出来的 href（'<a href="'+base+'model/'+...），
  // 那些片段会被链接正则当成真实链接，制造几百条假死链。
  const html = raw.replace(/<script[\s\S]*?<\/script>/gi, '');

  for (const bad of ['undefined', 'NaN', '[object Object]']) {
    // 只看标签之间的可见文本，避免误伤 data 属性里的合法出现；
    // <code> 里的字面量引用同样跳过（见下方零价语义检查的说明）。
    const textOnly = html.replace(/<code>[\s\S]*?<\/code>/gi, ' ').replace(/<[^>]+>/g, ' ');
    if (textOnly.includes(bad)) add(f, '渲染残留', `可见文本里出现了 ${bad}`);
  }

  // Markdown 泄漏：这些页面是手写 HTML 字符串拼出来的，而文案是从注释式的
  // Markdown 笔记里抄过来的，很容易把 `**强调**` 原样带进输出——它不会报错，
  // 只会在页面上显示成两个星号。曾经有 3 处这样的片段扩散到 426 个页面。
  {
    const textOnly = html.replace(/<code>[\s\S]*?<\/code>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const md = textOnly.match(/\*\*[^*\n]{1,80}\*\*|__[^_\n]{1,80}__/);
    if (md) add(f, 'Markdown 泄漏', `${md[0].slice(0, 60)} —— 应该渲染成标签，或改用「」`);
  }

  // 零价语义：上游有 241 条报价的 input/output 是 0，它们**不是免费**——
  // 有的是包月套餐（阿里云百炼 token 包、腾讯/智谱/MiniMax 的 coding plan），
  // 有的是试用额度（NVIDIA NIM、HuggingFace、ModelScope）。
  // 一旦某处格式化漏走 priceText()，页面就会写出「$0」，读者会以为这模型白送。
  // 排除 $0.xx（那是真实的小数价，比如 $0.05/M），只抓整数零。
  //
  // <code> 里的内容先剔除：那里放的是一句数据说明里**故意引用**的「$0」这个字面量
  // （为了说明「我们没这么写」），不是真的价格位。用 <code> 而不是注释标记，
  // 是因为让「字面量走等宽」本身就是更规范的排版，顺带把误报消掉。
  {
    const textOnly = html.replace(/<code>[\s\S]*?<\/code>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const zero = textOnly.match(/\$0(?![.\d])/);
    if (zero) add(f, '零价语义', '出现了裸露的 $0，应该走 priceText() 渲染成「套餐/免费」');
  }

  // 内部链接
  for (const m of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
    const ref = m[1];
    let target = resolveRef(f, ref);
    if (target === null) continue;
    // 目录链接统一去掉尾斜杠再比对：产物里存的是目录名，而链接写的是 `dir/`。
    // 静态托管会把 `dir/` 落到 `dir/index.html`，所以只要目录存在就算通。
    target = target.replace(/\/+$/, '');
    if (target === '') continue;
    if (files.has(target) || dirs.has(target)) continue;
    add(f, '死链', `${ref} → 目标不存在（${target}）`);
  }

  // 空锚点
  for (const m of html.matchAll(/<a\b[^>]*href=""[^>]*>/g)) add(f, '空链接', m[0].slice(0, 60));
}

// ── 搜索索引 ────────────────────────────────────────────────
const idxFile = path.join(DIST, 'search-index.json');
if (!fs.existsSync(idxFile)) {
  add('search-index.json', '缺失', '搜索索引没有生成，顶栏搜索会静默失效');
} else {
  const idx = JSON.parse(fs.readFileSync(idxFile, 'utf8')) as { s?: string; n?: string }[];
  if (!Array.isArray(idx) || idx.length === 0) add('search-index.json', '为空', '搜索索引是空数组');
  let missingPages = 0;
  let missingNames = 0;
  for (const it of idx) {
    if (!it.s || !files.has(`model/${it.s}/index.html`)) missingPages++;
    if (!it.n) missingNames++;
  }
  if (missingPages) add('search-index.json', '悬空', `${missingPages} 条指向不存在的模型页`);
  if (missingNames) add('search-index.json', '缺字段', `${missingNames} 条缺少模型名`);
  console.log(`  搜索索引 ${idx.length} 条`);
}

// ── 账号汇总 ────────────────────────────────────────────────
const avatarRefs = new Set<string>();
for (const f of pages) {
  const html = fs.readFileSync(path.join(DIST, f), 'utf8').replace(/<script[\s\S]*?<\/script>/gi, '');
  for (const m of html.matchAll(/src="[^"]*avatars\/([^"]+\.svg)"/g)) avatarRefs.add(m[1]);
}
const avatarFiles = new Set(all.filter((f) => f.startsWith('avatars/')).map((f) => f.slice('avatars/'.length)));
let missingAvatars = 0;
for (const a of avatarRefs) if (!avatarFiles.has(a)) missingAvatars++;
if (missingAvatars) add('avatars', '缺失', `${missingAvatars} 个被页面引用的形象不存在`);

const orphanAvatars = [...avatarFiles].filter((a) => !avatarRefs.has(a)).length;

// ── 报告 ────────────────────────────────────────────────────
console.log('');
console.log(`  页面          ${pages.length}`);
console.log(`  形象引用      ${avatarRefs.size} 个不同的形象（库存 ${avatarFiles.size}，未被引用 ${orphanAvatars}）`);

if (problems.length) {
  console.error(`\n✗ 发现 ${problems.length} 个问题：\n`);
  const byKind = new Map<string, typeof problems>();
  for (const p of problems) byKind.set(p.kind, [...(byKind.get(p.kind) ?? []), p]);
  for (const [kind, list] of byKind) {
    console.error(`  【${kind}】${list.length} 处`);
    for (const p of list.slice(0, 8)) console.error(`    ${p.file}: ${p.detail}`);
    if (list.length > 8) console.error(`    …… 其余 ${list.length - 8} 处省略`);
    console.error('');
  }
  process.exit(1);
}

console.log('\n✓ 产物体检通过：无死链、无渲染残留、无 Markdown 泄漏、零价语义正确，形象与搜索索引全部就位。\n');
