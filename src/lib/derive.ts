import type { Snapshot, ModelRecord } from './types.ts';

/**
 * 标尺层：**数据 → 标尺 → 视图** 中间的那一层。
 *
 * 全站所有档位都是「在当前全体模型里的分位」，不是绝对阈值。
 * 理由很实在：绝对阈值会被时间腐蚀——两年前「上下文 128K」值得写进标题，
 * 今天它是入门配置。写死的数字意味着每隔几个月就要有人回来改一遍，
 * 那「上线后不用人管」就不成立了。
 *
 * 分位需要一个能看到整个人群的标尺，所以 `buildScale` 必须喂**全体模型**，
 * 而不是当前页面要渲染的那几十个。搞混会得到很隐蔽的错误：
 * 只喂旗舰的话，「百万上下文」会因为旗舰普遍百万而全部顶格，指标就白算了。
 */

export interface Percentile {
  /** 0–100，越大越靠前 */
  pct: number;
  rank: number;
  total: number;
}

export interface Scale {
  /** model.key → ECI 分位 */
  eci: Map<string, Percentile>;
  /** 输入价分位（越便宜 pct 越高） */
  inputPrice: Map<string, Percentile>;
  outputPrice: Map<string, Percentile>;
  /** 上下文长度分位 */
  context: Map<string, Percentile>;
  /** LiveBench 能力大类 → (model.key → 分位) */
  livebench: Map<string, Map<string, Percentile>>;
  /** 每个 ECI 档位带（5 分一档）里的输入价中位数，用于「同智力档里算不算便宜」 */
  priceByEciBand: Map<number, number>;
  /** 全体有价模型的输入价中位数 */
  medianInput: number;
  /** 最便宜的渠道价也能算出来：model.key → 最低输入价 */
  cheapestInput: Map<string, number>;
  totals: { models: number; priced: number; scored: number };
}

function percentileFrom(values: number[], ascending: boolean) {
  const sorted = [...values].sort((a, b) => a - b);
  return (v: number): Percentile => {
    // 二分找插入位置：rank 是「比它小的有多少个」
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < v) lo = mid + 1;
      else hi = mid;
    }
    const rankFromTop = ascending ? sorted.length - lo : lo + 1;
    return { pct: ((sorted.length - rankFromTop + 1) / sorted.length) * 100, rank: rankFromTop, total: sorted.length };
  };
}

export function buildScale(snapshot: Snapshot): Scale {
  const models = snapshot.models;

  const eciOf: number[] = [];
  const ctxOf: number[] = [];
  const inOf: number[] = [];
  const outOf: number[] = [];
  const lbByCat = new Map<string, number[]>();

  for (const m of models) {
    const e = m.epoch?.eci;
    if (e != null) eciOf.push(e);
    if (m.contextWindow != null) ctxOf.push(m.contextWindow);
    if (m.pricing.input != null && m.pricing.input > 0) inOf.push(m.pricing.input);
    if (m.pricing.output != null && m.pricing.output > 0) outOf.push(m.pricing.output);
    for (const [cat, v] of Object.entries(m.livebench?.categories ?? {})) {
      const list = lbByCat.get(cat) ?? [];
      list.push(v);
      lbByCat.set(cat, list);
    }
  }

  const eciFn = percentileFrom(eciOf, false);
  const ctxFn = percentileFrom(ctxOf, false);
  // 价格是「越小越好」，所以 pct 高的意思是便宜
  const inFn = percentileFrom(inOf, true);
  const outFn = percentileFrom(outOf, true);

  const eci = new Map<string, Percentile>();
  const context = new Map<string, Percentile>();
  const inputPrice = new Map<string, Percentile>();
  const outputPrice = new Map<string, Percentile>();
  const cheapestInput = new Map<string, number>();

  for (const m of models) {
    if (m.epoch?.eci != null) eci.set(m.key, eciFn(m.epoch.eci));
    if (m.contextWindow != null) context.set(m.key, ctxFn(m.contextWindow));
    if (m.pricing.input != null && m.pricing.input > 0) inputPrice.set(m.key, inFn(m.pricing.input));
    if (m.pricing.output != null && m.pricing.output > 0) outputPrice.set(m.key, outFn(m.pricing.output));
    // 只有**正数**价格能参与「最低价」的比较。
    // 这里曾经写成 `Math.min(m.pricing.input ?? Infinity, ...)`，于是当官方价是 0
    // （套餐制，见 isPlanPrice）时，一个「$20/月不限量」的套餐会被算成
    // 「最低渠道价 $0」，在一张写满真实单价的表里制造出不存在的地板价。
    //
    // 同时剔除「低到不像真的」的报价（见 isSuspiciousDeal）。这一步影响的是
    // 「性价比」榜——那个榜用最低渠道价除以智力分。若让一家报官方价 4% 的聚合站
    // 进来，GPT-5.5 会凭空变成全站性价比第一，而那个价格很可能根本不是同一口径。
    const officialPrice = m.pricing.input != null && m.pricing.input > 0 ? m.pricing.input : null;
    const channelPrices = m.offers
      .map((o) => o.input)
      .filter((v): v is number => v != null && v > 0 && !isSuspiciousDeal(v, officialPrice));
    const pool = officialPrice == null ? channelPrices : [...channelPrices, officialPrice];
    if (pool.length) cheapestInput.set(m.key, Math.min(...pool));
  }

  const livebench = new Map<string, Map<string, Percentile>>();
  for (const [cat, values] of lbByCat) {
    const fn = percentileFrom(values, false);
    const inner = new Map<string, Percentile>();
    for (const m of models) {
      const v = m.livebench?.categories[cat];
      if (v != null) inner.set(m.key, fn(v));
    }
    livebench.set(cat, inner);
  }

  // 5 分一档的 ECI 档位 → 该档内输入价中位数
  const bands = new Map<number, number[]>();
  for (const m of models) {
    const e = m.epoch?.eci;
    const p = m.pricing.input;
    if (e == null || p == null || p <= 0) continue;
    const band = Math.floor(e / 5) * 5;
    const list = bands.get(band) ?? [];
    list.push(p);
    bands.set(band, list);
  }
  const priceByEciBand = new Map<number, number>();
  for (const [band, list] of bands) {
    list.sort((a, b) => a - b);
    priceByEciBand.set(band, list[Math.floor(list.length / 2)]);
  }

  return {
    eci,
    context,
    inputPrice,
    outputPrice,
    livebench,
    priceByEciBand,
    medianInput: inOf.length ? [...inOf].sort((a, b) => a - b)[Math.floor(inOf.length / 2)] : 0,
    cheapestInput,
    totals: { models: models.length, priced: inOf.length, scored: eciOf.length },
  };
}

// ─────────────────────────── 优点 ───────────────────────────

export interface Advantage {
  /** 短标签，用于卡片上的小标题 */
  tag: string;
  /** 一句话，必须自带证据 */
  text: string;
  /** 强度 1–3，决定视觉权重 */
  weight: 1 | 2 | 3;
}

/**
 * 把一个模型的结构化字段翻译成人话「优点」。
 *
 * 全程不调用任何 LLM，也不展示上游返回的自由文本——
 * 所有句子都是「取数 → 排序 → 套模板」出来的。
 * 这带来两个后果，都是好的：模型信息永远不会被编造；
 * 中英切换没有翻译延迟，因为同一份数据渲染两次即可。
 */
export function advantagesOf(m: ModelRecord, scale: Scale, rankOfKey: (k: string) => number | null): Advantage[] {
  const out: Advantage[] = [];

  // 1. 综合智力：只在前四分之一里说，否则这句话对谁都能说，等于没说
  const eci = m.epoch?.eci;
  const eciPct = scale.eci.get(m.key);
  if (eci != null && eciPct) {
    const abs = rankOfKey(m.key);
    if (abs != null && abs <= 8) {
      out.push({
        tag: '综合智力',
        text: `Epoch 综合智力指数 ${eci.toFixed(1)}，全站第 ${abs} 名（共 ${scale.totals.scored} 款有分模型）。`,
        weight: 3,
      });
    } else if (eciPct.pct >= 75) {
      out.push({
        tag: '综合智力',
        text: `Epoch 综合智力指数 ${eci.toFixed(1)}，高于 ${Math.round(eciPct.pct)}% 的同侪。`,
        weight: 3,
      });
    }
  }

  // 2. 价格：跟「智力档位相同的那批」比，而不是跟全场比——
  //    跟全场比的话，便宜只是因为模型小，那是一句废话。
  const band = eci != null ? Math.floor(eci / 5) * 5 : null;
  const bandMedian = band != null ? scale.priceByEciBand.get(band) : undefined;
  if (m.pricing.input != null && m.pricing.input > 0 && bandMedian != null && m.pricing.input < bandMedian * 0.7) {
    const drop = Math.round((1 - m.pricing.input / bandMedian) * 100);
    out.push({
      tag: '同档最便宜',
      text: `输入 $${fmtPrice(m.pricing.input)}/百万 token，比同智力档（ECI ${band}–${(band ?? 0) + 5}）的中位数低 ${drop}%。`,
      weight: 3,
    });
  } else if (m.pricing.input != null && scale.inputPrice.get(m.key)?.pct != null && scale.inputPrice.get(m.key)!.pct >= 75) {
    out.push({
      tag: '价格便宜',
      text: `输入 $${fmtPrice(m.pricing.input)}/百万 token，比全站 ${Math.round(scale.inputPrice.get(m.key)!.pct)}% 的模型便宜。`,
      weight: 2,
    });
  }

  // 3. 渠道价差：这是站上最有行动价值的一条
  const cheapest = scale.cheapestInput.get(m.key);
  if (m.pricing.input != null && cheapest != null && cheapest < m.pricing.input * 0.9) {
    const offer = m.offers.find((o) => o.input === cheapest);
    const drop = Math.round((1 - cheapest / m.pricing.input) * 100);
    out.push({
      tag: '换渠道更省',
      text: `${offer?.providerName ?? '第三方渠道'} 报价 $${fmtPrice(cheapest)}，比官方低 ${drop}%；全站共 ${m.channelCount} 个渠道有售。`,
      weight: 3,
    });
  } else if (m.channelCount >= 8) {
    out.push({
      tag: '渠道覆盖广',
      text: `共 ${m.channelCount} 个渠道可购买，比价空间大、停售风险低。`,
      weight: 1,
    });
  }

  // 4. 上下文
  const ctx = scale.context.get(m.key);
  if (m.contextWindow != null && ctx && ctx.pct >= 80) {
    out.push({
      tag: '长上下文',
      text: `上下文窗口 ${fmtCount(m.contextWindow)} tokens，属于全站前 ${Math.max(1, Math.round(100 - ctx.pct))}%。`,
      weight: 2,
    });
  }

  // 5. 最强的那一项能力：只报它真正排得进前列的维度
  const lbRanked = [...(scale.livebench.entries() ?? [])]
    .map(([cat, inner]) => ({ cat, p: inner.get(m.key) }))
    .filter((x): x is { cat: string; p: Percentile } => x.p != null)
    .sort((a, b) => b.p.pct - a.p.pct);
  const best = lbRanked.find((x) => x.p.rank <= 5);
  if (best) {
    const v = m.livebench?.categories[best.cat];
    out.push({
      tag: `最强项 · ${CATEGORY_ZH[best.cat] ?? best.cat}`,
      text: `LiveBench ${CATEGORY_ZH[best.cat] ?? best.cat} ${v?.toFixed(1)}，在 ${best.p.total} 款参评模型里排第 ${best.p.rank}。`,
      weight: 3,
    });
  }

  // 6. 开源权重
  if (m.openWeights === true) {
    out.push({
      tag: '开放权重',
      text: m.license ? `权重开放（${m.license}），可以下载自部署，不必依赖任何一家的 API。` : '权重开放，可以下载自部署，不必依赖任何一家的 API。',
      weight: 3,
    });
  }

  // 7. 多模态
  const extraModalities = m.modalities.input.filter((x) => x !== 'text');
  if (extraModalities.length >= 2) {
    out.push({
      tag: '原生多模态',
      text: `直接接受 ${extraModalities.map((x) => MODALITY_ZH[x] ?? x).join(' / ')} 输入，不需要先转成文本。`,
      weight: 2,
    });
  }

  // 8. 可托付的工程能力（工具调用 + 结构化输出）
  if (m.capabilities.toolCall === true && m.capabilities.structuredOutput === true) {
    out.push({
      tag: '可工程化',
      text: '同时支持工具调用与结构化输出，可以直接接进自动化流程而不必写解析兜底。',
      weight: 1,
    });
  }

  return out.sort((a, b) => b.weight - a.weight).slice(0, 6);
}

export const CATEGORY_ZH: Record<string, string> = {
  Reasoning: '推理',
  Coding: '编程',
  'Agentic Coding': '代理式编程',
  Mathematics: '数学',
  'Data Analysis': '数据分析',
  Language: '语言',
  IF: '指令遵循',
};

export const MODALITY_ZH: Record<string, string> = {
  text: '文本',
  image: '图像',
  audio: '语音',
  video: '视频',
  pdf: 'PDF',
};

export function fmtPrice(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v === 0) return '0';
  if (v < 0.01) return v.toFixed(4);
  if (v < 1) return v.toFixed(2);
  if (v < 100) return String(Math.round(v * 100) / 100);
  return String(Math.round(v));
}

/**
 * 「零价」不等于免费——这是全站最容易出错的一个语义。
 *
 * models.dev 里有一批渠道把 cost 填成 0，但它们**不是不花钱**，而是**不按 token 计价**：
 *   - 包月订阅：阿里云百炼 token 套餐、腾讯 / 智谱 / MiniMax 的 coding plan
 *   - 免费额度：NVIDIA NIM、HuggingFace、ModelScope 的试用配额
 * 当前快照里 3866 条报价中有 240 余条属于这种，牵涉 60 多款模型。
 *
 * 影响有两层，都必须处理：
 *   1. **排序**：任何「谁更便宜」的榜单都要把 0 排除。否则一个「$20/月不限量」的套餐
 *      会以「$0 / 百万 token」的身份排在所有真实按量价格前面，得出一个看起来
 *      极其确定、实际上毫无意义的结论。
 *   2. **呈现**：直接写「$0」会让读者以为模型免费。要显式说明它是套餐/额度制。
 *
 * 之所以不干脆丢掉这些记录：它们是真实存在的购买途径，用户就是想知道
 * 「有没有包月的路子」。正确做法是**保留但降级呈现**，而不是删掉或谎报。
 */
export function isPlanPrice(v: number | null | undefined): boolean {
  return v === 0;
}

/** 套餐/免费额度在界面上统一的说法。 */
export const PLAN_PRICE_LABEL = '套餐/免费';

/**
 * 「低到不像真的」的第三方报价。
 *
 * 快照里约 2900 条第三方按量报价，绝大多数**高于**官方价（云平台转售要加价），
 * 这是合理的。但有 15 条只有官方价的 4%~19%，且高度集中在两家渠道
 * （QiHang 报 14%、UnoRouter 报 4%~12%），跨十几个不同模型都是同一个比例。
 * 这种一致性说明它大概不是折扣，而是**计价口径不同**——共享号池、
 * 按字符而非 token 计费、或是某个套餐被折算成了单价。
 *
 * 站点没法验证第三方账单，所以不删、也不当作优惠宣传，只如实标出存疑。
 * 阈值取 25%：低于官方的四分之一就值得读者自己点进去确认。
 */
export const SUSPICIOUS_DEAL_RATIO = 0.25;

export function isSuspiciousDeal(thirdPartyInput: number | null | undefined, officialInput: number | null | undefined): boolean {
  if (thirdPartyInput == null || officialInput == null) return false;
  if (thirdPartyInput <= 0 || officialInput <= 0) return false;
  return thirdPartyInput / officialInput < SUSPICIOUS_DEAL_RATIO;
}


export function fmtCount(v: number | null | undefined): string {
  if (v == null) return '—';
  if (v >= 1_000_000) return `${Math.round((v / 1_000_000) * 10) / 10}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}K`;
  return String(v);
}

// ─────────────────────────── 路线图 ───────────────────────────

export interface RoadmapEra {
  /** 这一代的发布日期。null = 上游没给日期 */
  date: string | null;
  /** 同一代一起发布的型号（不同尺寸/档位），按综合智力降序 */
  models: ModelRecord[];
  /** 相对上一代**确实发生**的变化。null 表示无从比较，原因见 incomparable */
  gained: string[] | null;
  /** 无法比较的原因（会渲染成页面文案）；能比较时为 null */
  incomparable: string | null;
  /** 当前页面所属的型号是否落在这一代 */
  isCurrent: boolean;
}

/**
 * 产品线键：去掉所有版本号 token 之后剩下的部分。
 *
 * 规则是「丢掉任何含数字的 token」：
 *   claude-opus-4.6 / claude-opus-5      → claude-opus
 *   gpt-5.2 / gpt-6-astra                → gpt / gpt-astra
 *   gpt-5.2-codex                        → gpt-codex
 *   gemini-3.7-flash / gemini-3.8-flash  → gemini-flash
 *   kimi-k2.6 / kimi-k3                  → kimi
 *   llama-3.1-405b / llama-3.3-70b       → llama
 *
 * 「丢数字」这一步很关键：保留数字会把一条产品线切得七零八落
 * （kimi-k2.6 和 kimi-k3 会变成两条不相干的线）；
 * 而丢掉变体词（pro / flash / opus / max）又不行——那是不同定位的型号，
 * 混成一条线会得出错误的世代关系。
 *
 * 判断用「含数字」而不是「以数字开头」：后者漏掉了 kimi-k3、o3 这类
 * 数字在中间或带字母前缀的写法。
 */
export function lineKeyOf(m: ModelRecord): string {
  const ck = m.key.slice(m.key.indexOf('|') + 1);
  return (
    ck
      .split('-')
      .filter((tok) => !/\d/.test(tok))
      .join('-')
      .replace(/^-|-$/g, '') || 'default'
  );
}

/**
 * 把一条产品线上的型号按发布日聚成「代」。
 *
 * 这是修掉一个真实错误的地方：一个世代常常同时发布多个尺寸
 * （Llama 3.1 的 405b / 70b / 8b 是同一天的三款）。
 * 早先的实现把它们当成三代相邻排列，于是页面会写出
 * 「Llama 33b → Llama 65b 综合智力 +17.4」——那不是世代进步，是尺寸差异，
 * 结论完全站不住。同一天发的型号必须归为同一代，代与代之间才谈得上「新增了什么」。
 *
 * 没有发布日期的型号单独聚成最后一组：不知道先后，就不该混进时间顺序里。
 */
function groupByGeneration(models: ModelRecord[]): ModelRecord[][] {
  const eci = (m: ModelRecord) => m.epoch?.eci ?? -1;
  const byDate = new Map<string, ModelRecord[]>();
  const undated: ModelRecord[] = [];
  for (const m of models) {
    if (!m.releaseDate) {
      undated.push(m);
      continue;
    }
    const list = byDate.get(m.releaseDate) ?? [];
    list.push(m);
    byDate.set(m.releaseDate, list);
  }
  const gens = [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, list]) => [...list].sort((a, b) => eci(b) - eci(a)));
  if (undated.length) gens.push([...undated].sort((a, b) => eci(b) - eci(a)));
  return gens;
}

/** 一代的整体画像。比较的是「这一代最好的那款」，而不是随便挑一款。 */
interface EraSummary {
  eci: number | null;
  contextWindow: number | null;
  livebench: number | null;
  modalities: Set<string>;
  flags: { reasoning: boolean; toolCall: boolean; structuredOutput: boolean };
  openWeights: boolean;
}

function summarizeEra(models: ModelRecord[]): EraSummary {
  const max = (vs: (number | null | undefined)[]) => {
    const ok = vs.filter((v): v is number => v != null);
    return ok.length ? Math.max(...ok) : null;
  };
  return {
    eci: max(models.map((m) => m.epoch?.eci)),
    contextWindow: max(models.map((m) => m.contextWindow)),
    livebench: max(models.map((m) => m.livebench?.overall)),
    modalities: new Set(models.flatMap((m) => m.modalities.input)),
    flags: {
      reasoning: models.some((m) => m.capabilities.reasoning === true),
      toolCall: models.some((m) => m.capabilities.toolCall === true),
      structuredOutput: models.some((m) => m.capabilities.structuredOutput === true),
    },
    openWeights: models.some((m) => m.openWeights === true),
  };
}

/**
 * 相邻两代之间确实发生的变化。算不出来的就不写，绝不猜。
 *
 * 刻意**不比价格**：同一代里不同尺寸的单价差好几倍，
 * 跨代比价很容易得出「这一代降价 80%」这种其实是换了个小模型的结论。
 * 价格有自己的页面，那里是同尺寸之间比，结论才成立。
 */
function eraDelta(prev: EraSummary, next: EraSummary): string[] {
  const out: string[] = [];

  // 涨要报，**跌也要报**。
  // 只写「变好的地方」会让一次真实的退步渲染成「与上一代相比没有变化」——
  // 那是一句假话，而且是最容易被信任的那种假话：页面看起来很平静。
  // 实测中 Llama 3.2 那一代的最强款就低于 3.1 的 405b，必须如实写出来。
  if (prev.eci != null && next.eci != null) {
    const d = next.eci - prev.eci;
    if (d >= 1) out.push(`综合智力（本代最强）${prev.eci.toFixed(1)} → ${next.eci.toFixed(1)}（+${d.toFixed(1)}）`);
    else if (d <= -1) out.push(`综合智力（本代最强）${prev.eci.toFixed(1)} → ${next.eci.toFixed(1)}（${d.toFixed(1)}，低于上一代）`);
  }
  if (prev.contextWindow != null && next.contextWindow != null) {
    if (next.contextWindow > prev.contextWindow) out.push(`上下文上限 ${fmtCount(prev.contextWindow)} → ${fmtCount(next.contextWindow)} tokens`);
    else if (next.contextWindow < prev.contextWindow) out.push(`上下文上限 ${fmtCount(prev.contextWindow)} → ${fmtCount(next.contextWindow)} tokens（缩水）`);
  }
  if (prev.livebench != null && next.livebench != null) {
    const d = next.livebench - prev.livebench;
    if (Math.abs(d) >= 1) out.push(`LiveBench 综合 ${prev.livebench.toFixed(1)} → ${next.livebench.toFixed(1)}`);
  }

  const addedMods = [...next.modalities].filter((x) => !prev.modalities.has(x) && x !== 'text');
  if (addedMods.length) out.push(`新增 ${addedMods.map((x) => MODALITY_ZH[x] ?? x).join(' / ')} 输入`);
  const droppedMods = [...prev.modalities].filter((x) => !next.modalities.has(x) && x !== 'text');
  if (droppedMods.length) out.push(`不再支持 ${droppedMods.map((x) => MODALITY_ZH[x] ?? x).join(' / ')} 输入`);

  const flagLabels: [keyof EraSummary['flags'], string][] = [
    ['reasoning', '推理模式'],
    ['toolCall', '工具调用'],
    ['structuredOutput', '结构化输出'],
  ];
  const newFlags = flagLabels.filter(([k]) => !prev.flags[k] && next.flags[k]).map(([, label]) => label);
  if (newFlags.length) out.push(`新增 ${newFlags.join(' / ')}`);
  const lostFlags = flagLabels.filter(([k]) => prev.flags[k] && !next.flags[k]).map(([, label]) => label);
  if (lostFlags.length) out.push(`取消 ${lostFlags.join(' / ')}`);

  if (!prev.openWeights && next.openWeights) out.push('权重转为开放');
  if (prev.openWeights && !next.openWeights) out.push('权重转为闭源');

  return out;
}

/** 某厂商某条产品线的全部世代。 */
export function erasOf(snapshot: Snapshot, vendorId: string, line: string): RoadmapEra[] {
  const models = snapshot.models.filter((m) => m.vendorId === vendorId && lineKeyOf(m) === line);
  if (!models.length) return [];
  const gens = groupByGeneration(models);
  const summaries = gens.map(summarizeEra);
  return gens.map((list, i): RoadmapEra => {
    const isUndated = !list[0].releaseDate;
    return {
      date: list[0].releaseDate ?? null,
      models: list,
      gained: i === 0 || isUndated ? null : eraDelta(summaries[i - 1], summaries[i]),
      incomparable:
        i === 0
          ? '这条产品线里最早被收录的一代，没有更早的一代可比。'
          : isUndated
            ? '上游没有给出这一代的发布日期，无法确定它相对其它世代的位置。'
            : null,
      isCurrent: false,
    };
  });
}

/** 当前页面模型所在产品线的历代，并标出它自己属于哪一代。 */
export function lineageOf(snapshot: Snapshot, model: ModelRecord): RoadmapEra[] {
  const eras = erasOf(snapshot, model.vendorId, lineKeyOf(model));
  for (const e of eras) e.isCurrent = e.models.some((m) => m.key === model.key);
  if (!eras.some((e) => e.isCurrent)) {
    // 产品线里找不到它自己（极少数情况），补一条独立节点，不硬塞进任何一代
    eras.push({
      date: model.releaseDate,
      models: [model],
      gained: null,
      incomparable: '上游没有给出足够的同线型号，无法构成世代序列。',
      isCurrent: true,
    });
  }
  return eras;
}

/** 同厂商的**其它**产品线，作为「同时期的邻居」。 */
export function siblingLines(snapshot: Snapshot, model: ModelRecord, limit = 6): { line: string; models: ModelRecord[] }[] {
  const mine = lineKeyOf(model);
  const groups = new Map<string, ModelRecord[]>();
  for (const m of snapshot.models) {
    if (m.vendorId !== model.vendorId) continue;
    const k = lineKeyOf(m);
    if (k === mine) continue;
    const list = groups.get(k) ?? [];
    list.push(m);
    groups.set(k, list);
  }
  return [...groups.entries()]
    .map(([line, models]) => ({
      line,
      models: models.sort((a, b) => (b.epoch?.eci ?? -1) - (a.epoch?.eci ?? -1)),
    }))
    .sort((a, b) => (b.models[0].epoch?.eci ?? -1) - (a.models[0].epoch?.eci ?? -1))
    .slice(0, limit);
}
