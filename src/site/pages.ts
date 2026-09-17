import type { Snapshot, ModelRecord } from '../lib/types.ts';
import {
  advantagesOf,
  buildScale,
  erasOf,
  fmtCount,
  fmtPrice,
  isSuspiciousDeal,
  lineageOf,
  lineKeyOf,
  siblingLines,
  CATEGORY_ZH,
  MODALITY_ZH,
  PLAN_PRICE_LABEL,
  type Advantage,
  type Scale,
} from '../lib/derive.ts';
import { PAPERS, papersFor } from '../content/papers.ts';
import { VENDORS, vendorProfile, REGION_LABEL } from '../content/vendors.ts';
import {
  abilityBars,
  avatarImg,
  channelTable,
  esc,
  kvList,
  modelCard,
  modelHref,
  percentileRuler,
  priceCell,
  priceText,
  rankBadge,
  sectionHead,
  vendorName,
} from './components.ts';
import { layout, NAV } from './layout.ts';

export interface Ctx {
  snapshot: Snapshot;
  scale: Scale;
  /** model.key → 全站 ECI 名次 */
  rank: Map<string, number>;
}

export function makeCtx(snapshot: Snapshot): Ctx {
  const scale = buildScale(snapshot);
  const rank = new Map<string, number>();
  snapshot.models
    .filter((m) => m.epoch?.eci != null)
    .sort((a, b) => (b.epoch!.eci ?? 0) - (a.epoch!.eci ?? 0))
    .forEach((m, i) => rank.set(m.key, i + 1));
  return { snapshot, scale, rank };
}

const rankOf = (c: Ctx, m: ModelRecord) => c.rank.get(m.key) ?? null;

/** 按某个取值挑出第一名，并要求它确实有值。挑不到就返回 null，绝不编一个。 */
function leader(
  c: Ctx,
  pick: (m: ModelRecord) => number | null,
  filter: (m: ModelRecord) => boolean = () => true,
): { model: ModelRecord; value: number } | null {
  let best: { model: ModelRecord; value: number } | null = null;
  for (const m of c.snapshot.models) {
    if (!filter(m)) continue;
    const v = pick(m);
    if (v == null || !Number.isFinite(v)) continue;
    if (!best || v > best.value) best = { model: m, value: v };
  }
  return best;
}

/** 要求另一项也有值，用于「在满足 X 的模型里挑 Y 最大」这种复合条件。 */
function leaderWith(
  c: Ctx,
  pick: (m: ModelRecord) => number | null,
  need: (m: ModelRecord) => number | null,
): { model: ModelRecord; value: number } | null {
  return leader(c, pick, (m) => need(m) != null);
}

// ────────────────────────────────────────────────────────────
// 首页
// ────────────────────────────────────────────────────────────

function podiumCard(c: Ctx, root: string, title: string, why: string, hit: { model: ModelRecord; value: number } | null, fmt: (v: number) => string, tag: string): string {
  if (!hit) {
    return `<div class="panel pad"><div class="tag dim">${esc(title)}</div><p class="mut" style="margin:10px 0 0;font-size:13px">上游数据暂不支持这项判断。</p></div>`;
  }
  const { model, value } = hit;
  return `<a class="panel pad" href="${modelHref(model, root)}" style="display:block;text-decoration:none">
    <div class="tag brand">${esc(title)}</div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:10px">
      <span class="av" style="width:44px;height:52px;flex:0 0 44px;border-radius:9px;background:var(--panel-2);border:1px solid var(--line);display:grid;place-items:center;overflow:hidden">${avatarImg(
        model,
        root,
      )}</span>
      <span style="min-width:0">
        <b style="display:block;font-size:15px;color:var(--ink)">${esc(model.name)}</b>
        <span style="font-size:12.5px;color:var(--ink-3)">${esc(vendorName(model))}</span>
      </span>
      <b style="margin-left:auto;font-family:var(--mono);font-size:19px">${esc(fmt(value))}</b>
    </div>
    <p style="margin:9px 0 0;font-size:12.5px;color:var(--ink-2)">${esc(why)}</p>
    <div style="margin-top:7px"><span class="tag dim">${esc(tag)}</span></div>
  </a>`;
}

export function homePage(c: Ctx, root: string): string {
  const { snapshot, scale } = c;
  const models = snapshot.models;
  const withEci = models.filter((m) => m.epoch?.eci != null);

  const best = leader(c, (m) => m.epoch?.eci ?? null);
  const bestCoding = leaderWith(c, (m) => m.livebench?.categories.Coding ?? null, (m) => m.livebench?.overall ?? null);
  const bestAgentic = leaderWith(c, (m) => m.livebench?.categories['Agentic Coding'] ?? null, (m) => m.livebench?.overall ?? null);
  const bestMath = leaderWith(c, (m) => m.livebench?.categories.Mathematics ?? null, (m) => m.livebench?.overall ?? null);
  const cheapest = (() => {
    let b: { model: ModelRecord; value: number } | null = null;
    for (const m of models) {
      if (m.epoch?.eci == null || m.pricing.input == null || m.pricing.input <= 0) continue;
      if (!b || m.pricing.input < b.value) b = { model: m, value: m.pricing.input };
    }
    return b;
  })();
  // 最划算：同 ECI 档里价格最低的那款，而不是「分最高除以价最低」这种会被极端值带跑的比值
  const bestValue = (() => {
    let b: { model: ModelRecord; value: number } | null = null;
    for (const m of models) {
      const e = m.epoch?.eci;
      const p = m.pricing.input;
      if (e == null || p == null || p <= 0) continue;
      const band = Math.floor(e / 5) * 5;
      const med = scale.priceByEciBand.get(band);
      if (med == null) continue;
      const ratio = med / p;
      if (!b || ratio > b.value) b = { model: m, value: ratio };
    }
    return b;
  })();
  const biggestCtx = leader(c, (m) => m.contextWindow ?? null);
  const bestOpen = leader(c, (m) => m.epoch?.eci ?? null, (m) => m.openWeights === true);
  const bestCn = leader(c, (m) => m.epoch?.eci ?? null, (m) => vendorProfile(m.vendorId).region === 'cn');
  const bestOverseas = leader(c, (m) => m.epoch?.eci ?? null, (m) => vendorProfile(m.vendorId).region === 'overseas');
  const newest = [...models]
    .filter((m) => m.releaseDate)
    .sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''))
    .slice(0, 12);

  // 各厂商当下的门面：ECI 最高的那一款
  const flagshipOf = new Map<string, ModelRecord>();
  for (const m of models) {
    if (m.epoch?.eci == null) continue;
    const cur = flagshipOf.get(m.vendorId);
    if (!cur || (m.epoch.eci ?? 0) > (cur.epoch?.eci ?? 0)) flagshipOf.set(m.vendorId, m);
  }
  const vendorGroups = (['cn', 'overseas'] as const).map((region) => ({
    region,
    vendors: snapshot.vendors
      .filter((v) => v.region === region)
      .sort((a, b) => (flagshipOf.get(b.id)?.epoch?.eci ?? -1) - (flagshipOf.get(a.id)?.epoch?.eci ?? -1)),
  }));

  const body = `
<div class="panel pad" style="margin-bottom:26px">
  <h1>把每一家的旗舰模型，摊在同一张桌子上看</h1>
  <p class="lede" style="margin:10px 0 0;max-width:82ch">
    综合智力来自 <b>Epoch AI</b> 的统一复跑，分维度能力来自 <b>LiveBench</b> 的逐任务原始得分，
    规格与价格来自 <b>models.dev</b> 收录的各家官方数据。这三份数据每天自动同步一次，
    页面上不会有任何一句由模型生成的话——每一条结论都能回溯到上面这三个来源。
  </p>
  <div class="stat-row">
    <div class="stat"><b>${snapshot.stats.models}</b><span>收录模型</span></div>
    <div class="stat"><b>${snapshot.vendors.length}</b><span>家厂商</span></div>
    <div class="stat"><b>${snapshot.stats.channels}</b><span>个可购渠道</span></div>
    <div class="stat"><b>${snapshot.stats.offers}</b><span>条渠道报价</span></div>
    <div class="stat"><b>${snapshot.stats.withEci}</b><span>款有第三方评分</span></div>
    <div class="stat"><b>${snapshot.stats.withLivebench}</b><span>款有分维度成绩</span></div>
  </div>
</div>

<section class="sec">
  ${sectionHead('今日格局', withEci.length ? `所有「第一名」都是在当前收录的 ${snapshot.stats.models} 款模型里现算的，不是写死的结论。` : '')}
  <div class="grid g-4">
    ${podiumCard(c, root, '最聪明', 'Epoch 综合智力指数最高', best, (v) => v.toFixed(1), 'Epoch 统一复跑')}
    ${podiumCard(c, root, '最会编程', 'LiveBench 编程维度最高', bestCoding, (v) => v.toFixed(1), 'LiveBench Coding')}
    ${podiumCard(c, root, '最会做代理任务', 'LiveBench 代理式编程最高', bestAgentic, (v) => v.toFixed(1), 'LiveBench Agentic')}
    ${podiumCard(c, root, '数学最强', 'LiveBench 数学维度最高', bestMath, (v) => v.toFixed(1), 'LiveBench Math')}
    ${podiumCard(c, root, '最便宜（有分的）', '在拿到第三方评分的模型里输入价最低', cheapest, (v) => '$' + fmtPrice(v), '官方挂牌价')}
    ${podiumCard(c, root, '同档最划算', '与同智力档位的中位数相比价格低得最多', bestValue, (v) => v.toFixed(1) + '×', '相对同档中位数')}
    ${podiumCard(c, root, '记性最好', '上下文窗口最大', biggestCtx, (v) => fmtCount(v), '官方规格')}
    ${podiumCard(c, root, '开源最强', '开放权重的模型里综合智力最高', bestOpen, (v) => v.toFixed(1), '权重可下载')}
  </div>
  <div class="grid g-2" style="margin-top:14px">
    ${podiumCard(c, root, '国内最强', '总部在中国大陆的厂商里综合智力最高', bestCn, (v) => v.toFixed(1), '国内厂商')}
    ${podiumCard(c, root, '国外最强', '其余厂商里综合智力最高', bestOverseas, (v) => v.toFixed(1), '国外厂商')}
  </div>
</section>

<section class="sec">
  ${sectionHead('各厂商当前门面', '每家只放当下最能打的那一款。点进去能看到它这一条产品线的完整世代演进，以及每一代新长出来的能力。', {
    href: `${root}vendors/`,
    text: `全部 ${snapshot.vendors.length} 家厂商`,
  })}
  ${vendorGroups
    .map(
      (g) => `<h3 style="margin:6px 0 10px;color:var(--ink-2)">${esc(REGION_LABEL[g.region])} · ${g.vendors.length} 家</h3>
    <div class="grid g-4" style="margin-bottom:18px">
      ${g.vendors
        .map((v) => {
          const f = flagshipOf.get(v.id);
          return `<a class="card" href="${root}vendor/${esc(v.id)}/" style="gap:8px">
          <div class="hd">
            <span class="av" style="width:44px;height:52px;flex:0 0 44px;border-radius:9px">${
              f ? avatarImg(f, root) : ''
            }</span>
            <span style="min-width:0">
              <span class="nm" style="display:block">${esc(v.nameZh ?? v.name)}</span>
              <span class="vd" style="display:block">${v.modelCount} 款模型${v.country ? ' · ' + esc(v.country) : ''}</span>
            </span>
          </div>
          ${
            f
              ? `<div style="font-size:12.5px;color:var(--ink-2)">门面：<b>${esc(f.name)}</b> <span class="mut">ECI ${
                  f.epoch?.eci?.toFixed(1) ?? '—'
                }</span></div>`
              : '<div class="mut" style="font-size:12.5px">暂无第三方评分</div>'
          }
        </a>`;
        })
        .join('')}
    </div>`,
    )
    .join('')}
</section>

<section class="sec">
  ${sectionHead('综合智力前十', `Epoch AI 用统一脚手架复跑所有模型，所以这一列跨厂商可比。共 ${snapshot.stats.withEci} 款模型有分。`, {
    href: `${root}leaderboard/`,
    text: '完整排行榜',
  })}
  <div class="grid g-3">
    ${withEci
      .slice(0, 9)
      .map((m) => modelCard(m, scale, root, { rank: rankOf(c, m), advantages: advantagesOf(m, scale, (k) => c.rank.get(k) ?? null) }))
      .join('')}
  </div>
</section>

<section class="sec">
  ${sectionHead('最近发布', '按官方发布日期倒序。发布日期缺失的模型不进这个列表——宁可少列，也不猜一个日期。')}
  <div class="grid g-4">
    ${newest
      .map((m) => {
        const p = vendorProfile(m.vendorId, m.vendorName);
        return `<a class="card" href="${modelHref(m, root)}" style="gap:8px">
        <div class="hd">
          <span class="av" style="width:40px;height:47px;flex:0 0 40px;border-radius:8px">${avatarImg(m, root)}</span>
          <span style="min-width:0">
            <span class="nm" style="display:block;font-size:14px">${esc(m.name)}</span>
            <span class="vd" style="display:block">${esc(p.nameZh)}</span>
          </span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12.5px;color:var(--ink-3)">
          <span style="font-family:var(--mono)">${esc(m.releaseDate)}</span>
          <span>${m.epoch?.eci != null ? 'ECI ' + m.epoch.eci.toFixed(1) : '暂无评分'}</span>
        </div>
      </a>`;
      })
      .join('')}
  </div>
</section>`;

  return layout({
    title: '大模型对比台 · 评分、价格、发展路线与关键文章',
    description: `横向对比 ${snapshot.stats.models} 款大模型的第三方评分、官方与第三方价格、发展路线图与关键论文。数据每天从 Epoch AI、models.dev、LiveBench 自动同步。`,
    root,
    active: 'home',
    snapshot,
    body,
  });
}

// ────────────────────────────────────────────────────────────
// 模型详情页
// ────────────────────────────────────────────────────────────

export function modelPage(c: Ctx, m: ModelRecord, root: string): string {
  const { snapshot, scale } = c;
  const p = vendorProfile(m.vendorId, m.vendorName);
  const adv = advantagesOf(m, scale, (k) => c.rank.get(k) ?? null);
  const line = lineageOf(snapshot, m);
  const siblings = siblingLines(snapshot, m);
  const eciPct = scale.eci.get(m.key);
  const rk = rankOf(c, m);
  const papers = papersFor(m.vendorId);

  // 只保留和这条产品线沾边的文章排前面，其余按通用相关度排后
  const familyTokens = lineKeyOf(m).split('-');
  const ranked = papers
    .map((pp) => {
      let score = 0;
      if (pp.families?.some((f) => familyTokens.some((t) => f.includes(t)))) score += 2;
      if (pp.appliesTo.includes(m.vendorId)) score += 2;
      if (pp.appliesTo.includes('*')) score += 1;
      return { pp, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.pp.year - a.pp.year)
    .slice(0, 8)
    .map((x) => x.pp);

  const specs: [string, string][] = [
    ['发布方', esc(p.nameZh)],
    ['发布日期', m.releaseDate ? `${esc(m.releaseDate)}` : '上游未收录'],
    ['知识截止', m.knowledgeCutoff ? esc(m.knowledgeCutoff) : '未公开'],
    ['上下文窗口', m.contextWindow != null ? `${fmtCount(m.contextWindow)} tokens` : '未公开'],
    ['单次最大输出', m.maxOutput != null ? `${fmtCount(m.maxOutput)} tokens` : '未公开'],
    ['输入模态', m.modalities.input.length ? m.modalities.input.map((x) => MODALITY_ZH[x] ?? x).join(' / ') : '未收录'],
    ['输出模态', m.modalities.output.length ? m.modalities.output.map((x) => MODALITY_ZH[x] ?? x).join(' / ') : '未收录'],
    ['权重开放', m.openWeights === true ? '是' : m.openWeights === false ? '否（闭源）' : '未收录'],
    ['推理模式', m.capabilities.reasoning === true ? '支持' : m.capabilities.reasoning === false ? '不支持' : '未收录'],
    ['工具调用', m.capabilities.toolCall === true ? '支持' : m.capabilities.toolCall === false ? '不支持' : '未收录'],
    ['结构化输出', m.capabilities.structuredOutput === true ? '支持' : m.capabilities.structuredOutput === false ? '不支持' : '未收录'],
    ['Epoch 访问方式', m.epoch?.accessibility ? esc(m.epoch.accessibility) : '未收录'],
  ];

  // Epoch 逐榜成绩，按覆盖模型数排序
  const benchRows = snapshot.benchmarks
    .map((b) => ({ b, v: m.epoch?.benchmarks[b.id] }))
    .filter((x) => x.v != null)
    .sort((a, b) => (b.b.models ?? 0) - (a.b.models ?? 0))
    .slice(0, 24);

  const body = `
<div class="crumb"><a href="${root}">首页</a> / <a href="${root}vendor/${esc(m.vendorId)}/">${esc(p.nameZh)}</a> / <span>${esc(m.name)}</span></div>

<div class="panel pad">
  <div class="hero">
    <div class="big-av">${avatarImg(m, root, 'big')}</div>
    <div class="info">
      <h1>${esc(m.name)}</h1>
      <div class="pill-row" style="margin:9px 0 0">
        <span class="tag" style="border-color:${p.accent}33;color:${p.accent};background:${p.accent}0f">${esc(p.nameZh)}</span>
        ${m.releaseDate ? `<span class="tag dim">${esc(m.releaseDate)} 发布</span>` : ''}
        ${m.openWeights === true ? '<span class="tag good">开放权重</span>' : ''}
        ${m.epoch?.eci != null ? `<span class="tag gold">ECI ${m.epoch.eci.toFixed(1)}</span>` : ''}
        ${rk ? `<span class="tag brand">全站第 ${rk} 名</span>` : ''}
      </div>
      <div class="stat-row">
        ${m.epoch?.eci != null ? `<div class="stat"><b>${m.epoch.eci.toFixed(1)}</b><span>Epoch 综合智力</span></div>` : ''}
        ${m.livebench?.overall != null ? `<div class="stat"><b>${m.livebench.overall.toFixed(1)}</b><span>LiveBench 综合</span></div>` : ''}
        <div class="stat"><b>${m.pricing.input != null ? priceText(m.pricing.input) : '—'}</b><span>输入 $/百万 token</span></div>
        <div class="stat"><b>${m.pricing.output != null ? priceText(m.pricing.output) : '—'}</b><span>输出 $/百万 token</span></div>
        <div class="stat"><b>${m.channelCount || '—'}</b><span>可购渠道</span></div>
      </div>
      ${
        eciPct
          ? `<div style="margin-top:14px;max-width:520px">
              ${percentileRuler('综合智力位置', eciPct.pct, `高于 ${Math.round(eciPct.pct)}% 的模型`)}
              ${scale.context.get(m.key) ? percentileRuler('上下文位置', scale.context.get(m.key)!.pct, '窗口大小在全站的位置') : ''}
              ${scale.inputPrice.get(m.key) ? percentileRuler('价格便宜程度', scale.inputPrice.get(m.key)!.pct, '越靠右越便宜') : ''}
            </div>`
          : ''
      }
    </div>
  </div>
</div>

${
  adv.length
    ? `<section class="sec" style="margin-top:22px">
  ${sectionHead('它凭什么值得看', '下面每一条都是当场从上游数据算出来的，句尾就是证据；算不出证据的话不会出现在这里。')}
  <div class="grid g-2">
    ${adv
      .map(
        (a) => `<div class="panel pad" style="display:flex;gap:11px">
      <span class="tag ${a.weight === 3 ? 'brand' : a.weight === 2 ? 'good' : 'dim'}" style="align-self:flex-start;white-space:nowrap">${esc(a.tag)}</span>
      <span style="font-size:14px;color:var(--ink)">${esc(a.text)}</span>
    </div>`,
      )
      .join('')}
  </div>
</section>`
    : ''
}

${
  m.livebench
    ? `<section class="sec">
  ${sectionHead('能力画像', `来自 LiveBench release ${esc(m.livebench.release)} 的 ${Object.keys(m.livebench.tasks).length} 项任务实测得分，按能力大类取平均。`)}
  <div class="panel pad" style="max-width:680px">${abilityBars(m, scale, root)}</div>
  <p class="src-note">灰色「暂无」表示该维度没有成绩，不等于这项能力弱。</p>
</section>`
    : ''
}

<section class="sec">
  ${sectionHead('发展路线图', `这是「${esc(lineKeyOf(m))}」这条产品线的完整世代。同一天发布的多个尺寸算作同一代，所以这里比较的是代与代之间确实发生的变化，而不是不同尺寸之间的差异。`)}
  ${
    line.length <= 1
      ? `<div class="panel pad"><p class="mut" style="margin:0">上游只收录了这条产品线的一个世代，无法构成时间线。完整的厂商演进见 <a href="${root}vendor/${esc(
          m.vendorId,
        )}/">${esc(p.nameZh)}厂商页</a>。</p></div>`
      : `<ol class="tl">
    ${line
      .map(
        (era) => `<li${era.isCurrent ? ' class="now"' : ''}>
      <div class="when">${era.date ? esc(era.date) : '日期未收录'}${era.isCurrent ? ' · 当前页面' : ''}${
        era.models.length > 1 ? ` · ${era.models.length} 个型号` : ''
      }</div>
      <div class="what">
        ${
          era.models.length === 1
            ? era.isCurrent
              ? esc(era.models[0].name)
              : `<a href="${modelHref(era.models[0], root)}">${esc(era.models[0].name)}</a>`
            : `<span style="display:flex;flex-wrap:wrap;gap:6px">${era.models
                .map((x) =>
                  x.key === m.key
                    ? `<span class="tag brand" style="font-weight:700">${esc(x.name)}</span>`
                    : `<a class="tag" href="${modelHref(x, root)}">${esc(x.name)}</a>`,
                )
                .join('')}</span>`
        }
        ${
          era.models.length > 1
            ? ''
            : ` <span class="mut" style="font-weight:400;font-size:12.5px">${
                era.models[0].epoch?.eci != null ? `ECI ${era.models[0].epoch.eci.toFixed(1)}` : '无第三方评分'
              }</span>`
        }
      </div>
      ${
        era.gained == null
          ? `<div class="none">${esc(era.incomparable ?? '无法与前一代比较。')}</div>`
          : era.gained.length === 0
            ? `<div class="none">与上一代相比，上游可见的字段没有变化。</div>`
            : `<div class="gain">${era.gained.map((g) => `<span>${esc(g)}</span>`).join('')}</div>`
      }
    </li>`,
      )
      .join('')}
  </ol>`
  }
  ${
    siblings.length
      ? `<h3 style="margin:18px 0 9px">同一家的其它产品线</h3>
  <div class="grid g-3">
    ${siblings
      .map(
        (s) => `<div class="panel pad" style="display:flex;flex-direction:column;gap:6px">
      <div style="font-weight:700;font-size:14px">${esc(s.line)}</div>
      <div style="font-size:12.5px;color:var(--ink-3)">${s.models.length} 个型号</div>
      <div class="pill-row">
        ${s.models
          .slice(0, 6)
          .map((x) => `<a class="tag" href="${modelHref(x, root)}">${esc(x.name)}</a>`)
          .join('')}
      </div>
    </div>`,
      )
      .join('')}
  </div>`
      : ''
  }
</section>

<section class="sec">
  ${sectionHead('关键性文章', `这一代模型的能力不是凭空来的。下面这些论文与技术报告解释了「为什么会有这些能力」，每一条都标出了「这款模型因此新增了什么」。全部是原文出处，不是二手转述。`)}
  <div class="panel pad papers">
    ${ranked
      .map(
        (pp) => `<article class="paper">
      <div class="unlock">${esc(pp.unlocks)}</div>
      <div class="src">
        <a href="${esc(pp.url)}" target="_blank" rel="noopener">${esc(pp.title)}</a>
        <span>· ${esc(pp.org)} · ${pp.year}</span>
        <span class="tag ${pp.kind === 'release' ? 'brand' : pp.kind === 'report' ? 'good' : 'dim'}">${
          pp.kind === 'release' ? '发布公告' : pp.kind === 'report' ? '技术报告' : '论文'
        }</span>
        ${pp.appliesTo.includes(m.vendorId) ? '<span class="tag gold">本家工作</span>' : '<span class="tag dim">通用基础</span>'}
      </div>
    </article>`,
      )
      .join('')}
  </div>
  <p class="src-note">共 ${PAPERS.length} 篇收录在库；这里按与「${esc(p.nameZh)}」及本条产品线的相关度挑出 ${ranked.length} 篇。</p>
</section>

<section class="sec">
  ${sectionHead('官方费用与第三方渠道', '同一个模型在不同渠道的价差经常到两三倍。带「官方」标记的是原厂自家平台，其余是第三方聚合站或云平台转售，右侧直接给购买入口。')}
  ${channelTable(m)}
</section>

<section class="sec">
  ${sectionHead('规格参数')}
  <div class="grid g-2">
    <div class="panel pad">${kvList(specs)}</div>
    <div class="panel pad">
      ${
        benchRows.length
          ? `<h3 style="margin-bottom:10px">Epoch 逐榜成绩</h3>
        <div style="display:flex;flex-direction:column;gap:5px;max-height:420px;overflow:auto">
        ${benchRows
          .map(
            (x) => `<div class="bar"><span class="lab" style="flex:0 0 150px;overflow:hidden;text-overflow:ellipsis">${esc(
              x.b.label,
            )}</span><span class="track"></span><span class="val" style="flex:0 0 110px">${(x.v as number).toFixed(
              1,
            )} <span class="mut" style="font-size:11px">/ ${x.b.models} 模型</span></span></div>`,
          )
          .join('')}
        </div>
        <p class="src-note">每个榜单只有在该榜有成绩时才列。「/ N 模型」表示这个榜一共有多少款模型参评——分数只在这个榜内部可比。</p>`
          : '<p class="mut" style="margin:0">Epoch AI 的榜单里暂时没有这款模型的成绩。</p>'
      }
    </div>
  </div>
</section>

<section class="sec">
  <div class="panel pad">
    <h3 style="margin-bottom:8px">这份页面是怎么来的</h3>
    <p style="margin:0 0 6px;font-size:13.5px;color:var(--ink-2)">
      本页所有字段来自 ${m.provenance.map((x) => esc(x)).join(' · ')}，
      快照生成于 ${esc(snapshot.generatedAt.replace('T', ' ').slice(0, 19))} UTC，由 GitHub Actions 每天自动同步一次。
      Q 版形象由厂商母题确定性合成，不涉及任何第三方美术素材。
      页面文案全部由结构化字段套模板生成，<b>不调用任何大模型</b>。
    </p>
    <p style="margin:0;font-size:13px;color:var(--ink-3)">模型标识：<code style="font-family:var(--mono)">${esc(m.key)}</code></p>
  </div>
</section>`;

  return layout({
    title: `${m.name} · 评分、价格与路线图 · 大模型对比台`,
    description: `${m.name}（${p.nameZh}）的第三方评分、官方与第三方渠道价格、发展路线图与关键论文。数据来自 Epoch AI、models.dev、LiveBench。`,
    root,
    active: '',
    snapshot,
    body,
    head: `<meta property="og:title" content="${esc(m.name)} · 大模型对比台">`,
  });
}

// ────────────────────────────────────────────────────────────
// 排行榜
// ────────────────────────────────────────────────────────────

function board(
  c: Ctx,
  root: string,
  title: string,
  lede: string,
  rows: { m: ModelRecord; v: number; note?: string }[],
  opts: { unit?: string; good?: boolean; source: string },
): string {
  if (rows.length === 0) {
    return `<section class="sec">${sectionHead(title, lede)}<div class="panel empty">这个榜单当前没有可用数据。</div></section>`;
  }
  return `<section class="sec">
  ${sectionHead(title, lede)}
  <div class="tbl-scroll"><table>
    <thead><tr><th class="num" style="width:56px">名次</th><th>模型</th><th>厂商</th><th class="num">${esc(
      opts.unit ?? '分数',
    )}</th><th>说明</th></tr></thead>
    <tbody>
      ${rows
        .map(
          (r, i) => `<tr>
        <td class="num">${rankBadge(i + 1)}</td>
        <td><a href="${modelHref(r.m, root)}"><b>${esc(r.m.name)}</b></a>${r.m.openWeights === true ? ' <span class="tag good">开源</span>' : ''}</td>
        <td class="mut">${esc(vendorName(r.m))}</td>
        <td class="num">${
          opts.good ? `<span style="color:var(--good)">$${fmtPrice(r.v)}</span>` : r.v.toFixed(1)
        }</td>
        <td class="mut" style="white-space:normal;font-size:12.5px">${esc(r.note ?? '')}</td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table></div>
  <p class="src-note">数据来源：${esc(opts.source)} · 共 ${rows.length} 款模型上榜</p>
</section>`;
}

export function leaderboardPage(c: Ctx, root: string): string {
  const { snapshot, scale } = c;
  const eciRows = snapshot.models
    .filter((m) => m.epoch?.eci != null)
    .sort((a, b) => (b.epoch!.eci ?? 0) - (a.epoch!.eci ?? 0))
    .map((m) => ({
      m,
      v: m.epoch!.eci as number,
      note:
        m.epoch?.eciLow != null && m.epoch?.eciHigh != null
          ? `95% 置信区间 ${m.epoch.eciLow.toFixed(1)}–${m.epoch.eciHigh.toFixed(1)}`
          : '',
    }));

  const cats = [...scale.livebench.keys()];
  const catBoards = cats.map((cat) => ({
    cat,
    rows: snapshot.models
      .filter((m) => m.livebench?.categories[cat] != null)
      .sort((a, b) => (b.livebench!.categories[cat] ?? 0) - (a.livebench!.categories[cat] ?? 0))
      .map((m) => {
        const p = scale.livebench.get(cat)?.get(m.key);
        return { m, v: m.livebench!.categories[cat] as number, note: `${p?.total ?? 0} 款参评` };
      }),
  }));

  const priceRows = snapshot.models
    .filter((m) => m.epoch?.eci != null && m.pricing.input != null && m.pricing.input > 0)
    .sort((a, b) => (a.pricing.input ?? 0) - (b.pricing.input ?? 0))
    .slice(0, 40)
    .map((m) => ({
      m,
      v: m.pricing.input as number,
      note: `输出 ${priceText(m.pricing.output)}/M · ECI ${m.epoch?.eci?.toFixed(1)}（全站第 ${
        c.rank.get(m.key) ?? '—'
      }）· ${m.channelCount} 个渠道`,
    }));

  const valueRows = snapshot.models
    .filter((m) => m.epoch?.eci != null && m.pricing.input != null && m.pricing.input > 0)
    .map((m) => {
      const band = Math.floor((m.epoch!.eci as number) / 5) * 5;
      const med = scale.priceByEciBand.get(band) ?? m.pricing.input!;
      return { m, v: med / (m.pricing.input as number), note: `ECI ${m.epoch!.eci!.toFixed(1)} · 输入 $${fmtPrice(m.pricing.input)}/M` };
    })
    .sort((a, b) => b.v - a.v)
    .slice(0, 30);

  const ctxRows = snapshot.models
    .filter((m) => m.contextWindow != null)
    .sort((a, b) => (b.contextWindow ?? 0) - (a.contextWindow ?? 0))
    .slice(0, 30)
    .map((m) => ({ m, v: m.contextWindow as number, note: m.epoch?.eci != null ? `ECI ${m.epoch.eci.toFixed(1)}` : '无第三方评分' }));

  const body = `
<div class="panel pad" style="margin-bottom:24px">
  <h1>排行榜</h1>
  <p class="lede" style="margin:9px 0 0;max-width:82ch">
    <b>跨赛制的分数永远不会被混算成一个数。</b>同一个模型换一套评测脚手架就能差二三十分，
    所以这里每一榜都独立开，并且标注参赛模型数与数据来源——你能看到的每个数字，都能回到它的原始出处。
  </p>
  <div class="stat-row">
    <div class="stat"><b>${eciRows.length}</b><span>款有综合智力分</span></div>
    <div class="stat"><b>${cats.length}</b><span>个 LiveBench 能力维度</span></div>
    <div class="stat"><b>${snapshot.benchmarks.length}</b><span>个 Epoch 细分榜单</span></div>
  </div>
</div>

${board(c, root, '综合智力（Epoch Capabilities Index）', 'Epoch AI 用统一脚手架复跑，跨模型可比，也是首页「最聪明」的唯一依据。', eciRows, {
  unit: 'ECI 指数',
  source: 'Epoch AI · CC-BY 4.0',
})}

<section class="sec">
  ${sectionHead('分维度能力（LiveBench）', `LiveBench release ${esc(String(snapshot.livebenchRelease))}：${cats.length} 个能力大类，${snapshot.stats.livebenchEntries} 款模型参评。它的价值在于逐任务原始得分公开，所以「写作强不强」这种问题有据可依。`)}
  <div class="grid g-2">
    ${catBoards
      .map(
        (b) => `<div class="tbl-scroll"><table>
      <thead><tr><th colspan="3" style="background:var(--brand-soft);color:var(--brand)">${esc(
        CATEGORY_ZH[b.cat] ?? b.cat,
      )} · ${b.rows.length} 款有分</th></tr>
      <tr><th class="num" style="width:48px">#</th><th>模型</th><th class="num">得分</th></tr></thead>
      <tbody>
        ${b.rows
          .slice(0, 10)
          .map(
            (r, i) => `<tr><td class="num">${rankBadge(i + 1)}</td><td><a href="${modelHref(r.m, root)}">${esc(
              r.m.name,
            )}</a> <span class="mut" style="font-size:12px">${esc(vendorName(r.m))}</span></td><td class="num">${r.v.toFixed(
              1,
            )}</td></tr>`,
          )
          .join('')}
      </tbody>
    </table></div>`,
      )
      .join('')}
  </div>
  <p class="src-note">数据来源：LiveBench · Apache-2.0（DATASHEET 明文放弃数据版权）</p>
</section>

${board(c, root, '性价比', '与同智力档位（5 分一档）的中位数相比便宜多少倍。比「分数除以价格」稳健——后者会被几毛钱的模型带跑。', valueRows, {
  unit: '相对倍数',
  source: 'models.dev 官方挂牌价 × Epoch AI 智力分',
})}

${board(c, root, '最便宜的 40 款（有第三方评分的）', '只在拿到 Epoch 综合智力分的模型里排序——没有评分的模型再便宜，也无法判断它到底能不能用。', priceRows, {
  unit: '输入 $/M',
  good: true,
  source: 'models.dev',
})}

${board(c, root, '上下文最长的 30 款', '上下文窗口决定一次能塞进多少材料，是长文档与代码库场景的硬门槛。', ctxRows, {
  unit: 'tokens',
  source: 'models.dev',
})}`;

  return layout({
    title: '排行榜 · 综合智力、分维度能力、性价比、上下文 · 大模型对比台',
    description: '大模型排行榜：Epoch AI 综合智力指数、LiveBench 七个能力维度、性价比与上下文长度，每一榜标注参赛模型数与数据来源。',
    root,
    active: 'leaderboard',
    snapshot,
    body,
  });
}

// ────────────────────────────────────────────────────────────
// 价格与购买
// ────────────────────────────────────────────────────────────

export function pricingPage(c: Ctx, root: string): string {
  const { snapshot } = c;
  const priced = snapshot.models.filter((m) => m.offers.length > 0);
  // 只有「都能算出正数单价」的模型才进价差比较。套餐价（0）必须排除：
  // 拿它当分母会算出「省 100%」，拿它当分子会算出 Infinity/NaN。
  const withThird = priced.filter((m) => m.offers.some((o) => o.kind !== 'official' && o.input != null && o.input > 0));
  const planOnly = priced.filter((m) => m.offers.every((o) => o.input == null || o.input === 0));

  const cheapestOf = (m: ModelRecord) =>
    m.offers
      .filter((o) => o.kind !== 'official' && o.input != null && o.input > 0)
      .sort((a, b) => (a.input ?? 0) - (b.input ?? 0))[0];

  let biggestGap: { m: ModelRecord; official: number; cheap: number; provider: string; drop: number } | null = null;
  let suspiciousModels = 0;
  for (const m of withThird) {
    const official = m.offers.find((o) => o.kind === 'official' && o.input != null && o.input > 0)?.input ?? m.pricing.input;
    const cheapestOffer = cheapestOf(m);
    if (!(official != null && official > 0) || !(cheapestOffer?.input != null && cheapestOffer.input > 0)) continue;
    // 「低到不像真的」的报价单独计数，不参与「最大价差」的头条。
    // 否则整个页面会被 UnoRouter 那种 4% 官方价的记录占满，读者会以为这就是市场行情。
    if (isSuspiciousDeal(cheapestOffer.input, official)) {
      suspiciousModels++;
      continue;
    }
    const drop = 1 - cheapestOffer.input / official;
    if (!biggestGap || drop > biggestGap.drop) {
      biggestGap = { m, official, cheap: cheapestOffer.input, provider: cheapestOffer.providerName, drop };
    }
  }

  // 排序：最新的模型排在最前面。
  //
  // 这里刻意**不按厂商分段**。按厂商分段时，26 家厂商的头部模型各自堆在段落开头，
  // 页面的阅读顺序就变成了「先看哪家厂商」，而不是「先看最新的模型」。
  // 厂商身份改成每一行上的标签（可点进厂商主页），浏览能力没有损失。
  //
  // 发布日是 YYYY-MM-DD，字符串倒序就是时间倒序，不需要转成 Date 再比。
  const dated = priced.filter((m) => m.releaseDate);
  const undated = priced.filter((m) => !m.releaseDate);
  dated.sort((a, b) => (b.releaseDate ?? '').localeCompare(a.releaseDate ?? ''));

  const eras: { label: string; note?: string; models: ModelRecord[] }[] = [];
  for (const m of dated) {
    const label = `${(m.releaseDate ?? '').slice(0, 4)} 年`;
    const cur = eras[eras.length - 1];
    if (cur && cur.label === label) cur.models.push(m);
    else eras.push({ label, models: [m] });
  }
  if (undated.length) {
    // 没日期的不许瞎排：把它塞进任何一年都是在编造时间顺序。
    // 单列一组放在最后，组内按智力分排（没有智力分的按名字排）。
    undated.sort((a, b) => (b.epoch?.eci ?? -1) - (a.epoch?.eci ?? -1) || a.name.localeCompare(b.name));
    eras.push({
      label: '发布日期未收录',
      note: '上游没有给出这些模型的发布日期，无法判断它们相对其它模型的先后，因此不并入任何一年，单独列在最后。',
      models: undated,
    });
  }

  // 一行的渲染。抽出来是因为下面要按年份重复用，而套餐价、存疑标记这两处
  // 语义很容易在复制粘贴里走样。
  const priceRow = (m: ModelRecord): string => {
    const cheapest = cheapestOf(m);
    const official = m.pricing.input != null && m.pricing.input > 0 ? m.pricing.input : null;
    let deal = '';
    if (cheapest?.input != null && cheapest.input > 0 && official != null) {
      const drop = Math.round((1 - cheapest.input / official) * 100);
      if (drop > 0) {
        // 低于官方价四分之一的报价不写成「省 N%」——那是在替一个无法验证的
        // 数字背书。改成中性表述 + 存疑标记，把判断权交回读者。
        deal = isSuspiciousDeal(cheapest.input, official)
          ? `<span class="tag warn" title="该渠道报价不足官方价的 25%，很可能不是同一计价口径">第三方低至 $${fmtPrice(cheapest.input)}（存疑）</span>`
          : `<span class="tag good">最低 $${fmtPrice(cheapest.input)}（省 ${drop}%）</span>`;
      }
    }
    return `<details class="ch">
      <summary>
        <span style="font-family:var(--mono);min-width:150px">${esc(m.name)}</span>
        <a class="tag dim" href="${root}vendor/${esc(m.vendorId)}/" onclick="event.stopPropagation()">${esc(vendorName(m))}</a>
        ${m.releaseDate ? `<span class="tag">${esc(m.releaseDate)} 发布</span>` : ''}
        <span class="tag brand">官方 ${priceText(m.pricing.input)} / ${priceText(m.pricing.output)}</span>
        ${deal}
        <span class="mut" style="font-size:12.5px;margin-left:auto">${m.offers.length} 个渠道</span>
        <a class="btn ghost" href="${modelHref(m, root)}" onclick="event.stopPropagation()">模型详情</a>
      </summary>
      <div class="inner">${channelTable(m)}</div>
    </details>`;
  };

  const body = `
<div class="panel pad" style="margin-bottom:24px">
  <h1>价格与购买</h1>
  <p class="lede" style="margin:9px 0 0;max-width:82ch">
    同一款模型，官方直营和第三方渠道的报价经常差两三倍。这一页把「每个模型的每一条渠道」都摊开，
    标出官方与第三方的身份，并直接给出下单入口。价格单位统一换算成美元 / 百万 token。
  </p>
  <p class="lede" style="margin:8px 0 0;max-width:82ch">
    列表<b>按发布时间倒序，最新的模型排在最前面</b>；上游没有给出发布日期的模型不猜顺序，单独列在最后。
    展开任意一行即可看到这款模型的所有渠道报价。
  </p>
  <div class="stat-row">
    <div class="stat"><b>${priced.length}</b><span>款有公开报价</span></div>
    <div class="stat"><b>${snapshot.stats.channels}</b><span>个渠道</span></div>
    <div class="stat"><b>${snapshot.stats.offers}</b><span>条报价记录</span></div>
    <div class="stat"><b>${withThird.length}</b><span>款能在第三方买到</span></div>
    ${
      planOnly.length
        ? `<div class="stat"><b>${planOnly.length}</b><span>款只有套餐价（无单价可比）</span></div>`
        : ''
    }
  </div>
  ${
    biggestGap
      ? `<p style="margin:14px 0 0;font-size:13.5px">当前价差最大的一款：<b>${esc(biggestGap.m.name)}</b>——官方 $${fmtPrice(
          biggestGap.official,
        )}/M，${esc(biggestGap.provider)} $${fmtPrice(biggestGap.cheap)}/M，差 ${Math.round(biggestGap.drop * 100)}%。</p>`
      : ''
  }
  ${
    suspiciousModels
      ? `<p style="margin:8px 0 0;font-size:13px" class="mut">另有 ${suspiciousModels} 款存在「低于官方价四分之一」的渠道报价（集中在少数聚合站）。
         这类比例往往来自计价口径差异（共享号池、按字符计费、套餐折算），而不是真实折扣，因此<b>不计入上方的价差统计</b>，
         渠道表里会单独标注。</p>`
      : ''
  }
</div>

<div class="callout" style="margin-bottom:24px">
  价格是<b>上游平台自己提交</b>的挂牌价，不含任何优惠、批量和合约折扣，也不代表实际账单。
  部分渠道存在按量阶梯、缓存折扣或限时活动，真实价格请以购买页面为准。
  本站只做归集与换算，<b>不参与任何交易、不收取佣金</b>。
</div>
${
  planOnly.length
    ? `<div class="callout" style="margin-bottom:24px">
  有 <b>${planOnly.length}</b> 款模型在上游只登记了套餐/免费额度，没有可比的单 token 价格。
  它们照样列在下面，但价格一栏标为「${PLAN_PRICE_LABEL}」而不是 <code>$0</code>——
  一个包月不限量的套餐把它写成「<code>$0</code>/百万 token」，在任何排序里都会得出荒谬的结论。
</div>`
    : ''
}

${eras
  .map(
    (era) => `<section class="sec">
  ${sectionHead(`${era.label}　·　${era.models.length} 款在售`, era.note)}
  <div style="display:flex;flex-direction:column;gap:9px">
    ${era.models.map(priceRow).join('')}
  </div>
</section>`,
  )
    .join('')}`;

  return layout({
    title: '各家大模型的官方费用与第三方渠道费用 · 大模型对比台',
    description: '汇总各家大模型的官方 API 定价与第三方渠道报价，标出官方与第三方身份、价差比例，并提供直达购买入口。',
    root,
    active: 'pricing',
    snapshot,
    body,
  });
}

// ────────────────────────────────────────────────────────────
// 厂商
// ────────────────────────────────────────────────────────────

export function vendorsPage(c: Ctx, root: string): string {
  const { snapshot } = c;
  const flagshipOf = new Map<string, ModelRecord>();
  for (const m of snapshot.models) {
    if (m.epoch?.eci == null) continue;
    const cur = flagshipOf.get(m.vendorId);
    if (!cur || (m.epoch.eci ?? 0) > (cur.epoch?.eci ?? 0)) flagshipOf.set(m.vendorId, m);
  }
  const sections = (['cn', 'overseas'] as const).map((region) => ({
    region,
    vendors: snapshot.vendors
      .filter((v) => v.region === region)
      .sort((a, b) => (flagshipOf.get(b.id)?.epoch?.eci ?? -1) - (flagshipOf.get(a.id)?.epoch?.eci ?? -1)),
  }));

  const body = `
<div class="panel pad" style="margin-bottom:24px">
  <h1>厂商</h1>
  <p class="lede" style="margin:9px 0 0;max-width:82ch">
    按总部所在地分国内与国外两区。每家的形象母题（DeepSeek 的鲸、月之暗面的月牙、智谱的灯笼）
    是一张人工维护的查表——机器读得出定价，读不出品牌意象。表里没有的厂商会自动落到「神秘旅人」兜底形象，
    不会失败，也不会白屏。
  </p>
</div>
${sections
  .map(
    (s) => `<section class="sec">
  ${sectionHead(`${REGION_LABEL[s.region]}　·　${s.vendors.length} 家`)}
  <div class="grid g-3">
    ${s.vendors
      .map((v) => {
        const f = flagshipOf.get(v.id);
        const p = vendorProfile(v.id, v.name);
        return `<a class="card" href="${root}vendor/${esc(v.id)}/" style="gap:9px">
      <div class="hd">
        <span class="av" style="width:50px;height:58px;flex:0 0 50px;border-radius:10px;background:${v.accent}0d;border-color:${v.accent}33">${
          f ? avatarImg(f, root) : ''
        }</span>
        <span style="min-width:0">
          <span class="nm" style="display:block">${esc(v.nameZh ?? v.name)}</span>
          <span class="vd" style="display:block">${esc(v.name)}${v.country ? ' · ' + esc(v.country) : ''}</span>
        </span>
      </div>
      <p style="margin:0;font-size:12.5px;color:var(--ink-2);line-height:1.55">${esc(p.blurb)}</p>
      <div class="pill-row" style="margin-top:auto">
        <span class="tag dim">${v.modelCount} 款模型</span>
        ${
          f && f.epoch?.eci != null
            ? `<span class="tag gold">最高 ECI ${f.epoch.eci.toFixed(1)}</span>`
            : '<span class="tag dim">暂无评分</span>'
        }
      </div>
    </a>`;
      })
      .join('')}
  </div>
</section>`,
  )
    .join('')}`;

  return layout({
    title: '厂商 · 国内与国外大模型厂商一览 · 大模型对比台',
    description: '按国内/国外分区浏览各家大模型厂商，含厂商形象母题、模型数量与当前最强型号。',
    root,
    active: 'vendors',
    snapshot,
    body,
  });
}

export function vendorPage(c: Ctx, vendorId: string, root: string): string {
  const { snapshot, scale } = c;
  const p = vendorProfile(vendorId);
  const models = snapshot.models
    .filter((m) => m.vendorId === vendorId)
    .sort((a, b) => (b.epoch?.eci ?? -1) - (a.epoch?.eci ?? -1));
  const flagship = models.find((m) => m.epoch?.eci != null) ?? models[0];
  const papers = papersFor(vendorId);

  // 该厂商所有产品线的世代，合并成一张时间线
  const lines = new Map<string, ModelRecord[]>();
  for (const m of models) {
    const k = lineKeyOf(m);
    const list = lines.get(k) ?? [];
    list.push(m);
    lines.set(k, list);
  }
  const ordered = [...lines.entries()].sort(
    (a, b) => (b[1][0].epoch?.eci ?? -1) - (a[1][0].epoch?.eci ?? -1),
  );

  const body = `
<div class="crumb"><a href="${root}">首页</a> / <a href="${root}vendors/">厂商</a> / <span>${esc(p.nameZh)}</span></div>
<div class="panel pad">
  <div class="hero">
    ${
      flagship
        ? `<div class="big-av" style="background:${p.accent}0d">${avatarImg(flagship, root, 'big')}</div>`
        : ''
    }
    <div class="info">
      <h1>${esc(p.nameZh)}</h1>
      <p class="lede" style="margin:8px 0 0">${esc(p.blurb)}</p>
      <div class="pill-row" style="margin-top:10px">
        <span class="tag dim">${esc(p.nameEn)}</span>
        ${p.country !== 'XX' ? `<span class="tag dim">总部 ${esc(p.country)}</span>` : ''}
        <span class="tag dim">${REGION_LABEL[p.region]}</span>
        <span class="tag brand">${models.length} 款模型在库</span>
        <span class="tag dim">形象母题 · ${esc(p.motif)}</span>
      </div>
      <div class="pill-row" style="margin-top:10px">
        ${p.homepage ? `<a class="btn ghost" href="${esc(p.homepage)}" target="_blank" rel="noopener">官网 ↗</a>` : ''}
        ${p.pricingUrl ? `<a class="btn ghost" href="${esc(p.pricingUrl)}" target="_blank" rel="noopener">官方定价页 ↗</a>` : ''}
      </div>
    </div>
  </div>
</div>

${
  ordered.length
    ? `<section class="sec" style="margin-top:22px">
  ${sectionHead('产品线演进', '按产品线分组。同一代一起发布的多个尺寸算一代，代与代之间列的是确实发生变化的地方——由两代的规格和成绩直接比对得出，没有人工润色。')}
  <div style="display:flex;flex-direction:column;gap:18px">
    ${ordered
      .map(
        ([line, list]) => `<div class="panel pad">
      <h3 style="margin-bottom:12px">${esc(line)} <span class="mut" style="font-weight:400;font-size:13px">· ${list.length} 款 / ${erasOf(snapshot, vendorId, line).length} 代</span></h3>
      <ol class="tl">
        ${erasOf(snapshot, vendorId, line)
          .map(
            (era) => `<li>
          <div class="when">${era.date ? esc(era.date) : '日期未收录'}${era.models.length > 1 ? ` · ${era.models.length} 个型号` : ''}</div>
          <div class="what">
            ${
              era.models.length === 1
                ? `<a href="${modelHref(era.models[0], root)}">${esc(era.models[0].name)}</a>
            <span class="mut" style="font-weight:400;font-size:12.5px">${
              era.models[0].epoch?.eci != null ? `ECI ${era.models[0].epoch.eci.toFixed(1)}` : '无第三方评分'
            }${era.models[0].pricing.input != null ? ` · 输入 ${priceText(era.models[0].pricing.input)}/M` : ''}</span>`
                : `<span style="display:flex;flex-wrap:wrap;gap:6px">${era.models
                    .map((x) => `<a class="tag" href="${modelHref(x, root)}">${esc(x.name)}</a>`)
                    .join('')}</span>`
            }
          </div>
          ${
            era.gained == null
              ? `<div class="none">${esc(era.incomparable ?? '无法与前一代比较。')}</div>`
              : era.gained.length === 0
                ? '<div class="none">与上一代相比，上游可见的字段没有变化。</div>'
                : `<div class="gain">${era.gained.map((g) => `<span>${esc(g)}</span>`).join('')}</div>`
          }
        </li>`,
          )
          .join('')}
      </ol>
    </div>`,
      )
      .join('')}
  </div>
</section>`
    : ''
}

<section class="sec">
  ${sectionHead(`全部 ${models.length} 款模型`, '按 Epoch 综合智力指数降序。没有第三方评分的排在最后，不做猜测性排序。')}
  <div class="grid g-3">
    ${models
      .slice(0, 18)
      .map((m) => modelCard(m, scale, root, { rank: rankOf(c, m), advantages: advantagesOf(m, scale, (k) => c.rank.get(k) ?? null) }))
      .join('')}
  </div>
  ${
    models.length > 18
      ? `<div class="panel pad" style="margin-top:14px">
    <h3 style="margin-bottom:9px">其余 ${models.length - 18} 款</h3>
    <div class="pill-row">${models
      .slice(18)
      .map((m) => `<a class="tag" href="${modelHref(m, root)}">${esc(m.name)}</a>`)
      .join('')}</div>
  </div>`
      : ''
  }
</section>

<section class="sec">
  ${sectionHead('与这家相关的关键性文章', `共 ${papers.length} 篇，包含通用基础工作与这家的原创贡献。每条都写明「带来了什么能力」。`)}
  <div class="panel pad papers">
    ${papers
      .slice(0, 12)
      .map(
        (pp) => `<article class="paper">
      <div class="unlock">${esc(pp.unlocks)}</div>
      <div class="src"><a href="${esc(pp.url)}" target="_blank" rel="noopener">${esc(pp.title)}</a><span>· ${esc(pp.org)} · ${pp.year}</span>
      ${pp.appliesTo.includes(vendorId) ? '<span class="tag gold">本家工作</span>' : '<span class="tag dim">通用基础</span>'}</div>
    </article>`,
      )
      .join('')}
  </div>
</section>`;

  return layout({
    title: `${p.nameZh} 旗下大模型一览 · 评分、价格与演进 · 大模型对比台`,
    description: `${p.nameZh}（${p.nameEn}）旗下 ${models.length} 款大模型的第三方评分、价格、产品线演进与关键论文。`,
    root,
    active: 'vendors',
    snapshot,
    body,
  });
}

export { NAV };
