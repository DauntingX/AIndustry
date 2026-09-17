import type { ModelRecord, Offer } from '../lib/types.ts';
import {
  fmtCount,
  fmtPrice,
  isPlanPrice,
  isSuspiciousDeal,
  CATEGORY_ZH,
  PLAN_PRICE_LABEL,
  type Scale,
  type Advantage,
} from '../lib/derive.ts';
import { vendorProfile } from '../content/vendors.ts';

export const esc = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

/**
 * 价格单元格。三种情况必须长得不一样，否则读者会误判成本：
 *   null → 上游没收录     0 → 套餐/免费额度（不按 token 计价）    正数 → 真实挂牌价
 * 见 derive.ts 里 isPlanPrice 的说明。
 */
export function priceCell(v: number | null | undefined): string {
  if (v == null) return '<span class="mut">—</span>';
  if (isPlanPrice(v)) return `<span class="tag good">${PLAN_PRICE_LABEL}</span>`;
  return `$${fmtPrice(v)}`;
}

/** 价格纯文本版（不适合嵌标签的句子用），语义与 priceCell 一致。 */
export function priceText(v: number | null | undefined): string {
  if (v == null) return '—';
  if (isPlanPrice(v)) return PLAN_PRICE_LABEL;
  return `$${fmtPrice(v)}`;
}


/** 页面根路径前缀。用相对路径而不是绝对路径，静态产物既能挂在子目录，也能直接双击打开。 */
export type Root = string;

export const KIND_LABEL: Record<Offer['kind'], string> = {
  official: '官方',
  cloud: '云平台',
  aggregator: '第三方',
};

export function vendorName(m: ModelRecord): string {
  return vendorProfile(m.vendorId, m.vendorName).nameZh || m.vendorName || m.vendorId;
}

export function vendorBadge(m: ModelRecord): string {
  const p = vendorProfile(m.vendorId, m.vendorName);
  return `<span class="tag" style="border-color:${p.accent}33;color:${p.accent};background:${p.accent}0f">${esc(p.nameZh)}</span>`;
}

/** 模型形象。统一用 <img> 引外链 SVG：HTML 因此小得多，浏览器还能单独缓存。 */
export function avatarImg(m: ModelRecord, root: Root, size = 'card'): string {
  const w = size === 'card' ? 46 : size === 'row' ? 30 : 126;
  return `<img src="${root}avatars/${esc(m.slug)}.svg" width="${w}" height="${Math.round((w * 140) / 120)}" alt="${esc(
    m.name,
  )} 的 Q 版形象" loading="lazy" decoding="async">`;
}

export function modelHref(m: ModelRecord, root: Root): string {
  return `${root}model/${esc(m.slug)}/`;
}

/** 名次徽章。前三名给颜色，其余中性。 */
export function rankBadge(n: number | null): string {
  if (n == null) return '<span class="rank">—</span>';
  const cls = n === 1 ? 'r1' : n === 2 ? 'r2' : n === 3 ? 'r3' : '';
  return `<span class="rank ${cls}">${n}</span>`;
}

export function abilityBars(m: ModelRecord, scale: Scale, root: Root): string {
  const cats = Object.keys(scale.livebench.size ? Object.fromEntries(scale.livebench) : {});
  if (cats.length === 0) return '';
  const rows = cats
    .map((cat) => {
      const v = m.livebench?.categories[cat];
      const p = scale.livebench.get(cat)?.get(m.key);
      if (v == null) {
        return `<div class="bar"><span class="lab">${esc(CATEGORY_ZH[cat] ?? cat)}</span><span class="track"></span><span class="val mut">暂无</span></div>`;
      }
      return `<div class="bar" title="${esc(CATEGORY_ZH[cat] ?? cat)} ${v} 分 · 在 ${p?.total ?? 0} 款参评模型里排第 ${p?.rank ?? '—'}">
        <span class="lab">${esc(CATEGORY_ZH[cat] ?? cat)}</span>
        <span class="track"><span class="fill" style="width:${Math.max(2, Math.min(100, v))}%"></span></span>
        <span class="val">${v.toFixed(1)}</span>
      </div>`;
    })
    .join('');
  return `<div style="display:flex;flex-direction:column;gap:6px">${rows}</div>`;
}

function priceBlock(m: ModelRecord, scale: Scale): string {
  const cheapest = scale.cheapestInput.get(m.key);
  const cheaper = cheapest != null && m.pricing.input != null && m.pricing.input > 0 && cheapest < m.pricing.input * 0.98;
  const inputCls = scale.inputPrice.get(m.key)?.pct != null && scale.inputPrice.get(m.key)!.pct >= 70 ? 'v low' : 'v';
  return `<div class="price">
    <div><span class="k">输入 / 百万 token</span><span class="${inputCls}">${
      m.pricing.input != null ? priceCell(m.pricing.input) : '暂无'
    }</span></div>
    <div><span class="k">输出 / 百万 token</span><span class="v">${
      m.pricing.output != null ? priceCell(m.pricing.output) : '暂无'
    }</span></div>
    <div><span class="k">可购渠道</span><span class="v">${m.channelCount || '—'}</span></div>
    ${cheaper ? `<div><span class="k">最低渠道价</span><span class="v low">$${fmtPrice(cheapest)}</span></div>` : ''}
  </div>`;
}

/**
 * 模型卡片：首页与列表页的基本单元。
 * 四件事按用户的提问顺序排列——**它是谁 → 它多强 → 它凭什么强 → 它多少钱**。
 */
export function modelCard(
  m: ModelRecord,
  scale: Scale,
  root: Root,
  opts: { rank: number | null; advantages: Advantage[]; badge?: string } ,
): string {
  const eci = m.epoch?.eci;
  const lb = m.livebench?.overall;
  return `<a class="card" href="${modelHref(m, root)}">
    <div class="hd">
      <span class="av">${avatarImg(m, root)}</span>
      <span style="min-width:0">
        <span class="nm" style="display:block">${esc(m.name)}</span>
        <span class="vd" style="display:block">${esc(vendorName(m))}${m.releaseDate ? ` · ${esc(m.releaseDate)}` : ''}</span>
      </span>
      ${opts.badge ? `<span style="margin-left:auto">${opts.badge}</span>` : ''}
    </div>
    <div class="score">
      ${rankBadge(opts.rank)}
      ${eci != null ? `<b>${eci.toFixed(1)}</b><span>ECI 综合智力</span>` : `<b class="mut" style="font-size:16px">暂无综合评分</b>`}
      ${lb != null ? `<span style="margin-left:auto">LiveBench ${lb.toFixed(1)}</span>` : ''}
    </div>
    ${opts.advantages.length ? `<ul class="adv">${opts.advantages
      .slice(0, 3)
      .map((a) => `<li class="w${a.weight}"><span><b>${esc(a.tag)}</b> · ${esc(a.text)}</span></li>`)
      .join('')}</ul>` : ''}
    ${priceBlock(m, scale)}
  </a>`;
}

/** 一整张渠道表：官方价 + 各第三方渠道价，每行直接给购买入口。 */
export function channelTable(m: ModelRecord, opts: { compact?: boolean } = {}): string {
  if (m.offers.length === 0) {
    return `<div class="empty">上游尚未收录这款模型的公开报价。<a href="${esc(
      vendorProfile(m.vendorId, m.vendorName).pricingUrl ?? vendorProfile(m.vendorId, m.vendorName).homepage ?? '#',
    )}" target="_blank" rel="noopener">去${esc(vendorName(m))}官方定价页查看 →</a></div>`;
  }
  // 官方输入价作参照，用来给「低到不像真的」的第三方报价打标。
  const officialInput =
    m.offers.find((o) => o.kind === 'official' && o.input != null && o.input > 0)?.input ?? m.pricing.input ?? null;

  const rows = m.offers
    .map(
      (o) => {
        const suspect = o.kind !== 'official' && isSuspiciousDeal(o.input, officialInput);
        return `<tr class="${o.kind === 'official' ? 'official' : ''}">
      <td><span class="tag ${o.kind === 'official' ? 'brand' : o.kind === 'cloud' ? 'dim' : ''}">${KIND_LABEL[o.kind]}</span></td>
      <td><b>${esc(o.providerName)}</b>${
        suspect
          ? ` <span class="tag warn" title="该渠道报价不足官方价的 25%。这类比例通常来自计价口径差异（共享号池、按字符计费、套餐折算），不是真实折扣，下单前请自行核实。">存疑</span>`
          : ''
      }</td>
      <td class="num">${priceCell(o.input)}</td>
      <td class="num">${priceCell(o.output)}</td>
      ${
        opts.compact
          ? ''
          : `<td class="num">${priceCell(o.cacheRead)}</td>
             <td class="num">${o.contextWindow != null ? fmtCount(o.contextWindow) : '<span class="mut">—</span>'}</td>`
      }
      <td>${
        o.buyUrl
          ? `<a class="btn ghost" href="${esc(o.buyUrl)}" target="_blank" rel="noopener nofollow">去购买 ↗</a>`
          : '<span class="mut" style="font-size:12px">无公开入口</span>'
      }</td>
    </tr>`;
      },
    )
    .join('');
  const hasPlan = m.offers.some((o) => isPlanPrice(o.input) || isPlanPrice(o.output));
  const hasSuspect = m.offers.some((o) => o.kind !== 'official' && isSuspiciousDeal(o.input, officialInput));
  return `<div class="tbl-scroll"><table>
    <thead><tr>
      <th>类型</th><th>渠道</th><th class="num">输入 $/M</th><th class="num">输出 $/M</th>
      ${opts.compact ? '' : '<th class="num">缓存读 $/M</th><th class="num">上下文</th>'}
      <th>购买</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table></div>
  <p class="src-note">价格来自 <a href="https://models.dev" target="_blank" rel="noopener">models.dev</a>（各平台自行提交），单位是美元每百万 token。带「官方」标记的行是模型原厂自家平台，其余为第三方渠道或云平台转售。${
    hasPlan
      ? `标「${PLAN_PRICE_LABEL}」的渠道<b>不按 token 计价</b>——那是包月套餐或免费额度，所以它没有可比的单 token 价格，也不会进入任何「最便宜」排序。`
      : ''
  }${
    hasSuspect
      ? `标「存疑」的渠道报价不足官方价的四分之一。这种比例通常不是折扣，而是计价口径不同，本站<b>不把它算作优惠</b>。`
      : ''
  }</p>`;
}

export function freshnessBadge(ok: boolean, at: string | null): string {
  const when = at ? at.replace('T', ' ').slice(0, 16) + ' UTC' : '—';
  return `<span class="freshness"><i class="${ok ? '' : 'off'}"></i>${ok ? `最近同步 ${esc(when)}` : '该源本次抓取失败'}</span>`;
}

export function sectionHead(title: string, lede?: string, more?: { href: string; text: string }): string {
  return `<div class="sec-head"><h2>${esc(title)}</h2>${
    more ? `<a class="more" href="${esc(more.href)}">${esc(more.text)} →</a>` : ''
  }</div>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}`;
}

/** 把一个模型的 ECI 分位画成一条「全场位置」的尺子。 */
export function percentileRuler(label: string, pct: number, note: string): string {
  return `<div class="bar"><span class="lab">${esc(label)}</span>
    <span class="track"><span class="fill" style="width:${Math.max(2, Math.min(100, pct))}%"></span></span>
    <span class="val" title="${esc(note)}">前 ${Math.max(1, Math.round(100 - pct))}%</span></div>`;
}

export function kvList(pairs: [string, string][]): string {
  return `<dl class="kv">${pairs.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${v}</dd>`).join('')}</dl>`;
}
