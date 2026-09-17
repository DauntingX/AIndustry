/**
 * 全站样式表。
 *
 * 手写而不是引框架，原因是这个站的版面其实只有四种骨架：
 * 卡片网格、榜单行、参数表、时间线。为四种骨架装一套原子类框架，
 * 换来的是构建期多一个依赖、以及一堆没人再去看的 class 名。
 *
 * 变量集中在 :root，换配色只改一处。整体是浅色主题。
 */
export const CSS = String.raw`
:root{
  --bg:#f6f7fb;
  --panel:#ffffff;
  --panel-2:#fbfcfe;
  --line:#e5e8f0;
  --line-strong:#d3d8e6;
  --ink:#161a24;
  --ink-2:#454c5e;
  --ink-3:#7a8398;
  --brand:#4a4ee0;
  --brand-soft:#eef0ff;
  --good:#0f9f7a;
  --good-soft:#e7f7f2;
  --warn:#c2761a;
  --warn-soft:#fdf3e3;
  --bad:#c2453f;
  --gold:#c99a1f;
  --radius:14px;
  --radius-sm:9px;
  --shadow:0 1px 2px rgba(22,26,36,.05), 0 8px 22px -14px rgba(22,26,36,.18);
  --mono:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace;
}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--bg);color:var(--ink);
  font:15px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif;
  font-feature-settings:"tnum";
}
a{color:var(--brand);text-decoration:none}
a:hover{text-decoration:underline}
img,svg{max-width:100%}
h1,h2,h3,h4{margin:0;font-weight:700;letter-spacing:-.01em;line-height:1.3}
h1{font-size:26px}
h2{font-size:19px}
h3{font-size:16px}
p{margin:0 0 10px}
hr{border:0;border-top:1px solid var(--line);margin:26px 0}

.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
.narrow{max-width:900px}

/* ── 顶栏 ── */
header.top{
  position:sticky;top:0;z-index:40;background:rgba(255,255,255,.9);
  backdrop-filter:saturate(1.6) blur(10px);border-bottom:1px solid var(--line);
}
.top-in{display:flex;align-items:center;gap:18px;height:60px}
.brand{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px;color:var(--ink)}
.brand:hover{text-decoration:none}
.brand .dot{width:22px;height:22px;border-radius:7px;background:linear-gradient(135deg,#4a4ee0,#8b5cf6);display:grid;place-items:center;color:#fff;font-size:12px;font-weight:800}
nav.main{display:flex;gap:4px;margin-left:6px;flex-wrap:wrap}
nav.main a{padding:6px 11px;border-radius:8px;color:var(--ink-2);font-size:14px;font-weight:500}
nav.main a:hover{background:var(--panel-2);text-decoration:none;color:var(--ink)}
nav.main a.on{background:var(--brand-soft);color:var(--brand)}
.top-search{margin-left:auto;position:relative}
.top-search input{
  width:230px;padding:8px 12px;border:1px solid var(--line-strong);border-radius:9px;
  background:var(--panel);font:inherit;font-size:14px;color:var(--ink);outline:none
}
.top-search input:focus{border-color:var(--brand);box-shadow:0 0 0 3px var(--brand-soft)}
.results{
  position:absolute;top:44px;right:0;width:420px;max-height:60vh;overflow:auto;
  background:var(--panel);border:1px solid var(--line-strong);border-radius:var(--radius);
  box-shadow:var(--shadow);display:none;padding:6px
}
.results.on{display:block}
.results a{display:block;padding:8px 10px;border-radius:8px;color:var(--ink)}
.results a:hover{background:var(--panel-2);text-decoration:none}
.results .meta{font-size:12px;color:var(--ink-3)}
.results .none{padding:14px;color:var(--ink-3);font-size:14px;text-align:center}

/* ── 版面 ── */
main{padding:26px 0 60px}
.sec{margin:0 0 34px}
.sec-head{display:flex;align-items:baseline;gap:10px;margin:0 0 12px}
.sec-head .more{margin-left:auto;font-size:13px;font-weight:500}
.lede{color:var(--ink-2);font-size:15px;margin:-4px 0 14px;max-width:70ch}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.pad{padding:18px}
.grid{display:grid;gap:14px}
.g-2{grid-template-columns:repeat(2,minmax(0,1fr))}
.g-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.g-4{grid-template-columns:repeat(4,minmax(0,1fr))}
@media(max-width:960px){.g-4{grid-template-columns:repeat(2,minmax(0,1fr))}.g-3{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:640px){.g-2,.g-3,.g-4{grid-template-columns:1fr}.top-search input{width:150px}}

/* ── 标签与徽章 ── */
.tag{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;font-size:12px;font-weight:600;background:var(--panel-2);color:var(--ink-2);border:1px solid var(--line)}
.tag.brand{background:var(--brand-soft);color:var(--brand);border-color:#dcdefb}
.tag.good{background:var(--good-soft);color:var(--good);border-color:#cdeee4}
.tag.warn{background:var(--warn-soft);color:var(--warn);border-color:#f2e0c2}
.tag.dim{background:#f2f4f8;color:var(--ink-3)}
.tag.gold{background:#fdf7e6;color:var(--gold);border-color:#efe0b6}
.rank{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:7px;font-size:12px;font-weight:800;background:var(--panel-2);color:var(--ink-3);border:1px solid var(--line)}
.rank.r1{background:#fdf3d0;color:#9a7300;border-color:#eddc9f}
.rank.r2{background:#eef1f6;color:#6b7488;border-color:#dde2ec}
.rank.r3{background:#fbeee3;color:#a4632b;border-color:#f0d9c4}

/* ── 模型卡片 ── */
.card{
  background:var(--panel);border:1px solid var(--line);border-radius:var(--radius);
  padding:14px;display:flex;flex-direction:column;gap:10px;position:relative;
  transition:border-color .15s,transform .15s,box-shadow .15s
}
.card:hover{border-color:var(--line-strong);transform:translateY(-2px);box-shadow:var(--shadow);text-decoration:none}
.card .hd{display:flex;gap:10px;align-items:center}
.card .av{width:52px;height:61px;flex:0 0 52px;border-radius:10px;background:var(--panel-2);border:1px solid var(--line);overflow:hidden;display:grid;place-items:center}
.card .av svg{width:46px;height:auto;display:block}
.card .nm{font-weight:700;font-size:15px;color:var(--ink);line-height:1.25}
.card .vd{font-size:12.5px;color:var(--ink-3);margin-top:1px}
.card .score{display:flex;align-items:baseline;gap:6px}
.card .score b{font-size:22px;font-weight:800;letter-spacing:-.02em;font-family:var(--mono)}
.card .score span{font-size:12px;color:var(--ink-3)}
.card .adv{font-size:13px;color:var(--ink-2);display:flex;flex-direction:column;gap:3px;margin:0;padding:0;list-style:none}
.card .adv li{display:flex;gap:6px;line-height:1.5}
.card .adv li:before{content:"";flex:0 0 5px;height:5px;border-radius:50%;background:var(--line-strong);margin-top:8px}
.card .adv li.w3:before{background:var(--brand)}
.card .price{display:flex;gap:14px;font-size:13px;border-top:1px dashed var(--line);padding-top:9px;margin-top:auto}
.card .price div{display:flex;flex-direction:column}
.card .price .k{font-size:11px;color:var(--ink-3)}
.card .price .v{font-family:var(--mono);font-weight:700;color:var(--ink)}
.card .price .v.low{color:var(--good)}

/* ── 横条 ── */
.bar{display:flex;align-items:center;gap:8px;font-size:12.5px}
.bar .lab{flex:0 0 84px;color:var(--ink-3)}
.bar .track{flex:1;height:7px;border-radius:4px;background:#eef0f6;overflow:hidden;position:relative}
.bar .fill{height:100%;border-radius:4px;background:linear-gradient(90deg,#6b6ff0,#8b5cf6)}
.bar .val{flex:0 0 74px;text-align:right;font-family:var(--mono);color:var(--ink-2)}
.bar.good .fill{background:linear-gradient(90deg,#22b48c,#0f9f7a)}

/* ── 表格 ── */
.tbl-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:var(--radius);background:var(--panel)}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:9px 12px;text-align:left;border-bottom:1px solid var(--line);white-space:nowrap}
th{background:var(--panel-2);font-size:12px;color:var(--ink-3);font-weight:600;position:sticky;top:0}
tbody tr:hover{background:var(--panel-2)}
td.num,th.num{text-align:right;font-family:var(--mono)}
tr.official td{background:#fbfbff}
.mut{color:var(--ink-3)}
.btn{
  display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:8px;
  background:var(--brand);color:#fff;font-size:12.5px;font-weight:600;border:1px solid var(--brand)
}
.btn:hover{text-decoration:none;filter:brightness(1.08)}
.btn.ghost{background:var(--panel);color:var(--brand);border-color:#dcdefb}
.btn.ghost:hover{background:var(--brand-soft);filter:none}

/* ── 时间线 ── */
.tl{position:relative;margin:0;padding:0 0 0 26px;list-style:none}
.tl:before{content:"";position:absolute;left:7px;top:6px;bottom:6px;width:2px;background:var(--line-strong)}
.tl li{position:relative;padding:0 0 20px}
.tl li:before{content:"";position:absolute;left:-23px;top:6px;width:10px;height:10px;border-radius:50%;background:var(--panel);border:2px solid var(--line-strong)}
.tl li.now:before{background:var(--brand);border-color:var(--brand);box-shadow:0 0 0 4px var(--brand-soft)}
.tl .when{font-size:12px;color:var(--ink-3);font-family:var(--mono)}
.tl .what{font-weight:700;font-size:14.5px;margin:1px 0 5px}
.tl .gain{display:flex;flex-wrap:wrap;gap:6px;margin:0}
.tl .gain span{font-size:12px;background:var(--good-soft);color:var(--good);border:1px solid #cdeee4;border-radius:6px;padding:2px 7px}
.tl .none{font-size:12.5px;color:var(--ink-3)}

/* ── 文章条目 ── */
.papers{display:flex;flex-direction:column;gap:0}
.paper{padding:15px 0;border-bottom:1px dashed var(--line)}
.paper:last-child{border-bottom:0}
.paper .unlock{font-size:14.5px;color:var(--ink);line-height:1.7}
.paper .unlock:before{content:"该模型因此新增的能力：";color:var(--brand);font-weight:700}
.paper .src{margin-top:6px;font-size:12.5px;color:var(--ink-3);display:flex;gap:8px;flex-wrap:wrap;align-items:center}

/* ── 其它 ── */
.kv{display:grid;grid-template-columns:auto 1fr;gap:7px 16px;font-size:13.5px}
.kv dt{color:var(--ink-3)}
.kv dd{margin:0;font-weight:600}
.hero{display:flex;gap:22px;align-items:flex-start;flex-wrap:wrap}
.hero .big-av{width:150px;height:175px;flex:0 0 150px;border-radius:18px;background:var(--panel);border:1px solid var(--line);display:grid;place-items:center;box-shadow:var(--shadow)}
.hero .big-av svg{width:126px;height:auto}
.hero .info{flex:1;min-width:280px}
.stat-row{display:flex;gap:26px;flex-wrap:wrap;margin:14px 0 0}
.stat b{display:block;font-family:var(--mono);font-size:22px;font-weight:800;letter-spacing:-.02em}
.stat span{font-size:12px;color:var(--ink-3)}
.callout{background:var(--brand-soft);border:1px solid #dcdefb;border-radius:var(--radius);padding:13px 16px;font-size:13.5px;color:#33379e}
.callout.warn{background:var(--warn-soft);border-color:#f2e0c2;color:#8a5710}
details.ch{border:1px solid var(--line);border-radius:var(--radius-sm);background:var(--panel)}
details.ch>summary{padding:10px 13px;cursor:pointer;font-weight:600;font-size:14px;display:flex;align-items:center;gap:8px;list-style:none}
details.ch>summary::-webkit-details-marker{display:none}
details.ch>summary:before{content:"▸";color:var(--ink-3);transition:transform .15s}
details.ch[open]>summary:before{transform:rotate(90deg)}
details.ch .inner{padding:0 13px 13px}
footer.bot{border-top:1px solid var(--line);background:var(--panel);padding:26px 0;color:var(--ink-3);font-size:13px}
footer.bot .cols{display:flex;gap:34px;flex-wrap:wrap}
footer.bot h4{font-size:13px;color:var(--ink-2);margin-bottom:7px}
footer.bot a{color:var(--ink-2)}
footer.bot ul{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:3px}
.pill-row{display:flex;gap:6px;flex-wrap:wrap}
.empty{padding:26px;text-align:center;color:var(--ink-3);font-size:14px}
.crumb{font-size:13px;color:var(--ink-3);margin-bottom:10px}
.crumb a{color:var(--ink-2)}
.src-note{font-size:12.5px;color:var(--ink-3);margin-top:8px}
.freshness{display:inline-flex;align-items:center;gap:6px;font-size:12.5px;color:var(--ink-3)}
.freshness i{width:7px;height:7px;border-radius:50%;background:var(--good);display:inline-block}
.freshness i.off{background:var(--bad)}
`;
