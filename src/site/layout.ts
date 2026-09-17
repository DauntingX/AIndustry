import { esc, freshnessBadge, type Root } from './components.ts';
import type { Snapshot } from '../lib/types.ts';

export interface NavItem {
  href: string;
  text: string;
  key: string;
}

export const NAV: NavItem[] = [
  { href: '', text: '首页', key: 'home' },
  { href: 'leaderboard/', text: '排行榜', key: 'leaderboard' },
  { href: 'pricing/', text: '价格与购买', key: 'pricing' },
  { href: 'vendors/', text: '厂商', key: 'vendors' },
];

export interface LayoutOpts {
  title: string;
  description: string;
  root: Root;
  active: string;
  snapshot: Snapshot;
  body: string;
  /** 额外的 <head> 内容 */
  head?: string;
}

/**
 * 页面外壳。
 *
 * 站点是纯静态的：没有后端、没有运行时 API 调用、没有密钥。
 * 数据是构建期读进来的快照，所以页面上能直接写出「最近同步时间」，
 * 而那个时间来自同步管线自己记录的抓取时间戳，不是构建时间。
 */
export function layout(o: LayoutOpts): string {
  const { root, title, description, active, snapshot, body } = o;
  const srcOk = Object.values(snapshot.sources).filter((s) => s.ok).length;
  const srcAll = Object.keys(snapshot.sources).length;
  // 首页的 root 是空串，直接拼出来就是 href="" —— 浏览器虽然能处理，
  // 但空 href 会被读屏软件当成「当前页」以外的含糊目标，也让爬虫多绕一圈。
  // 统一写成 './'，语义明确：就在当前位置。
  const at = (p: string) => root + p || './';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${at('style.css')}">
<link rel="icon" href="${at('favicon.svg')}" type="image/svg+xml">
${o.head ?? ''}
</head>
<body>
<header class="top"><div class="wrap top-in">
  <a class="brand" href="${root || './'}"><span class="dot">模</span>大模型对比台</a>
  <nav class="main">${NAV.map(
    (n) => `<a href="${at(n.href)}"${n.key === active ? ' class="on"' : ''}>${esc(n.text)}</a>`,
  ).join('')}</nav>
  <div class="top-search">
    <input id="q" type="search" placeholder="搜模型 / 厂商 / 能力" autocomplete="off" aria-label="搜索">
    <div class="results" id="results"></div>
  </div>
</div></header>
<main><div class="wrap">${body}</div></main>
<footer class="bot"><div class="wrap">
  <div class="cols">
    <div style="flex:1 1 300px">
      <h4>大模型对比台</h4>
      <p style="margin:0 0 8px">把各家大模型的评分、优点、价格、发展路线与关键文章放在同一张桌子上，全部由公开数据自动生成。</p>
      <p style="margin:0 0 10px">${freshnessBadge(srcOk === srcAll, snapshot.generatedAt)} · 快照时间 ${esc(
        snapshot.generatedAt.replace('T', ' ').slice(0, 16),
      )} UTC · 上游源 ${srcOk}/${srcAll} 正常</p>
      <p style="margin:0">本站不调用任何 LLM 生成文案；所有结论都由结构化数据套模板得出，可逐条回溯到上游。</p>
    </div>
    <div>
      <h4>数据来源</h4>
      <ul>
        <li><a href="https://epoch.ai" target="_blank" rel="noopener">Epoch AI</a> · 综合智力与逐榜成绩（CC-BY 4.0）</li>
        <li><a href="https://models.dev" target="_blank" rel="noopener">models.dev</a> · 规格、定价与渠道（MIT）</li>
        <li><a href="https://livebench.ai" target="_blank" rel="noopener">LiveBench</a> · 分维度能力成绩（Apache-2.0）</li>
      </ul>
    </div>
    <div>
      <h4>站内导航</h4>
      <ul>
        ${NAV.map((n) => `<li><a href="${at(n.href)}">${esc(n.text)}</a></li>`).join('')}
      </ul>
    </div>
  </div>
</div></footer>
<script>
(function(){
  var q=document.getElementById('q'),box=document.getElementById('results'),idx=null,base=${JSON.stringify(root)};
  function load(){ if(!idx){ idx=fetch(base+'search-index.json').then(function(r){return r.json()}); } return idx; }
  function hide(){ box.classList.remove('on'); }
  q.addEventListener('focus',function(){ if(q.value.trim()) q.dispatchEvent(new Event('input')); });
  q.addEventListener('input',function(){
    var t=q.value.trim().toLowerCase();
    if(!t){ hide(); return; }
    load().then(function(items){
      var hits=items.filter(function(it){
        return it.n.toLowerCase().indexOf(t)>=0 || it.v.toLowerCase().indexOf(t)>=0 || (it.k||'').toLowerCase().indexOf(t)>=0;
      }).slice(0,30);
      if(!hits.length){ box.innerHTML='<div class="none">没有匹配的模型或厂商</div>'; box.classList.add('on'); return; }
      box.innerHTML=hits.map(function(it){
        return '<a href="'+base+'model/'+it.s+'/"><b>'+it.n+'</b> <span class="meta">'+it.v+(it.c?(' · '+(it.c/1000000>=1?Math.round(it.c/100000)/10+'M':Math.round(it.c/1000)+'K')+' 上下文'):'')+'</span></a>';
      }).join('');
      box.classList.add('on');
    });
  });
  document.addEventListener('click',function(e){ if(!box.contains(e.target)&&e.target!==q) hide(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') hide(); });
})();
</script>
</body>
</html>`;
}
