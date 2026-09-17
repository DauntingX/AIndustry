import { ENDPOINTS, TRACKED_VENDORS } from '../config.ts';
import { fetchJson } from '../lib/http.ts';
import { belongsToVendor, canonicalKey, FIRST_PARTY_PROVIDERS, isFirstParty } from '../lib/keys.ts';
import { CHANNELS, providerDisplayName } from '../../../src/content/provider-links.ts';
import type { Offer, ModelRecord } from '../../../src/lib/types.ts';

/** models.dev 的原始结构（只声明我们真正读的字段）。 */
interface MdModel {
  id: string;
  name: string;
  description?: string;
  family?: string;
  attachment?: boolean;
  reasoning?: boolean;
  tool_call?: boolean;
  structured_output?: boolean;
  knowledge?: string;
  release_date?: string;
  last_updated?: string;
  modalities?: { input?: string[]; output?: string[] };
  open_weights?: boolean;
  limit?: { context?: number; input?: number; output?: number };
  cost?: { input?: number; output?: number; cache_read?: number; cache_write?: number; reasoning?: number };
}

interface MdProvider {
  id: string;
  name: string;
  doc?: string;
  models?: Record<string, MdModel>;
}

export interface ModelsDevResult {
  ok: boolean;
  models: ModelRecord[];
  /** 官方平台的 provider id → 展示信息，供厂商表使用 */
  officialProviders: Record<string, { id: string; name: string; doc: string | null }>;
  notModified: boolean;
  error?: string;
}

const numOrNull = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

const isoDate = (v: string | undefined | null): string | null => {
  if (!v) return null;
  const s = String(v).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

export function slugify(key: string): string {
  return key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function kindOf(providerId: string): Offer['kind'] {
  const ch = CHANNELS[providerId];
  if (ch) return ch.kind;
  return isFirstParty(providerId) ? 'official' : 'aggregator';
}

/**
 * 抓取 models.dev。
 *
 * 它同时提供两件事，这是选择它做骨架的原因：
 *   1. 模型规格与**官方定价**——cost 就是各平台自己填的价，单位美元/百万 token
 *   2. 同一款模型在**不同渠道**的报价——聚合站、云厂商、转售商各报各的
 * 于是「官方费用 vs 第三方费用」这件事不需要额外维护一张表，它是数据的副产品。
 *
 * 合并策略：只把**原厂自家平台**（FIRST_PARTY_PROVIDERS）的模型收进名册，
 * 第三方渠道的报价在确定规范名唯一对应一款模型之后挂回去。
 * 唯一的例外是 cloud 类（Bedrock / Azure / Vertex）——它们既是官方托管也是渠道，
 * 收进名册会让同一款模型出现两三个条目，所以只作为报价来源。
 */
export async function fetchModelsDev(): Promise<ModelsDevResult> {
  const res = await fetchJson<Record<string, MdProvider>>(ENDPOINTS.modelsDev);
  if (!res.ok || !res.data) {
    return { ok: false, models: [], officialProviders: {}, notModified: false, error: res.error };
  }
  const data = res.data;
  const tracked = new Set(TRACKED_VENDORS);

  /** 名册：vendorId|canonical → 记录 */
  const roster = new Map<string, ModelRecord>();
  /** 规范名 → 该规范名对应的原厂键集合。用来判断第三方报价能不能安全挂载。 */
  const ckToVendorKeys = new Map<string, Set<string>>();
  /** 渠道报价池：先按 `vendorId|canonical` 与裸 `canonical` 两个维度堆放 */
  const offersByVendorKey = new Map<string, Offer[]>();
  const offersByCk = new Map<string, Offer[]>();
  const officialProviders: Record<string, { id: string; name: string; doc: string | null }> = {};

  const now = new Date().toISOString();

  for (const [providerId, provider] of Object.entries(data)) {
    const firstPartyVendor = FIRST_PARTY_PROVIDERS[providerId];
    if (firstPartyVendor && tracked.has(firstPartyVendor)) {
      officialProviders[providerId] = { id: providerId, name: provider.name, doc: provider.doc ?? null };
    }

    for (const [modelId, m] of Object.entries(provider.models ?? {})) {
      const ck = canonicalKey(m.id || modelId);
      if (!ck) continue;

      const offer: Offer = {
        providerId,
        // 上游有几家的 name 是 "NaN"、空串这类机器词，直接落进快照就会一路渲染到页面上。
        // 在入口处就洗干净，比在每个渲染点各写一遍兜底可靠。
        providerName: providerDisplayName(providerId, provider.name),
        kind: kindOf(providerId),
        // 注意 0 是**保留**的：套餐制和免费额度在 models.dev 里就是 0，
        // 它是真实信息。要处理的是别拿它参与比价——那件事在 derive.ts 的
        // isPlanPrice / buildScale 里做，不在数据层把它抹成 null。
        input: numOrNull(m.cost?.input),
        output: numOrNull(m.cost?.output),
        cacheRead: numOrNull(m.cost?.cache_read),
        contextWindow: m.limit?.context ?? null,
        buyUrl: CHANNELS[providerId]?.buyUrl ?? provider.doc ?? null,
        docUrl: provider.doc ?? null,
      };

      // 非原厂平台（聚合站、转售商）只贡献报价
      if (!firstPartyVendor || !tracked.has(firstPartyVendor)) {
        push(offersByCk, ck, offer);
        continue;
      }

      // 云平台会托管别人家的模型：Bedrock 上有 Claude、Azure 上有 GPT、
      // 火山方舟上有 DeepSeek。只有落在自家产品线前缀里的才算「这家发布的」，
      // 其余降级为纯渠道——照样出现在价格对比里，只是不再冒充当家产品。
      if (!belongsToVendor(providerId, ck)) {
        push(offersByCk, ck, offer);
        continue;
      }

      const key = `${firstPartyVendor}|${ck}`;
      push(offersByVendorKey, key, offer);
      const set = ckToVendorKeys.get(ck) ?? new Set<string>();
      set.add(key);
      ckToVendorKeys.set(ck, set);

      const existing = roster.get(key);
      if (existing) {
        // 同一厂商的多个平台都有这款模型（alibaba 与 alibaba-cn）：
        // 保留先到的一条，用后到的补齐空字段，报价两边都收。
        existing.contextWindow ??= m.limit?.context ?? null;
        existing.maxOutput ??= m.limit?.output ?? null;
        existing.releaseDate ??= isoDate(m.release_date);
        existing.knowledgeCutoff ??= isoDate(m.knowledge);
        existing.pricing.input ??= numOrNull(m.cost?.input);
        existing.pricing.output ??= numOrNull(m.cost?.output);
        existing.pricing.cacheRead ??= numOrNull(m.cost?.cache_read);
        if (existing.modalities.input.length === 0) existing.modalities.input = m.modalities?.input ?? [];
        if (existing.modalities.output.length === 0) existing.modalities.output = m.modalities?.output ?? [];
        continue;
      }

      roster.set(key, {
        key,
        slug: slugify(key),
        name: m.name || m.id,
        nameZh: null,
        vendorId: firstPartyVendor,
        vendorName: provider.name,
        vendorNameZh: null,
        organization: provider.name,
        releaseDate: isoDate(m.release_date),
        knowledgeCutoff: isoDate(m.knowledge),
        contextWindow: m.limit?.context ?? null,
        maxOutput: m.limit?.output ?? null,
        pricing: {
          input: numOrNull(m.cost?.input),
          output: numOrNull(m.cost?.output),
          cacheRead: numOrNull(m.cost?.cache_read),
        },
        channelCount: 0,
        modalities: { input: m.modalities?.input ?? [], output: m.modalities?.output ?? [] },
        capabilities: {
          reasoning: m.reasoning ?? null,
          toolCall: m.tool_call ?? null,
          structuredOutput: m.structured_output ?? null,
          attachment: m.attachment ?? null,
        },
        openWeights: m.open_weights ?? null,
        license: null,
        epoch: null,
        livebench: null,
        offers: [],
        provenance: ['models.dev'],
        firstSeenAt: now,
      });
    }
  }

  // 回填报价：原厂平台的全部渠道 + 规范名唯一的第三方渠道
  for (const model of roster.values()) {
    const ck = model.key.slice(model.key.indexOf('|') + 1);
    const merged = [...(offersByVendorKey.get(model.key) ?? [])];
    const owners = ckToVendorKeys.get(ck);
    if (owners && owners.size === 1) {
      merged.push(...(offersByCk.get(ck) ?? []));
    }
    model.offers = dedupeOffers(merged);
    model.channelCount = model.offers.length;
    // 名册里的官方价以第一个 official 渠道为准，没有就走模型自身字段
    const official = model.offers.find((o) => o.kind === 'official' && o.input != null);
    if (official) {
      model.pricing.input ??= official.input;
      model.pricing.output ??= official.output;
      model.pricing.cacheRead ??= official.cacheRead;
    }
  }

  return { ok: true, models: [...roster.values()], officialProviders, notModified: res.notModified };
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function dedupeOffers(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  const out: Offer[] = [];
  for (const o of offers) {
    if (seen.has(o.providerId)) continue;
    seen.add(o.providerId);
    out.push(o);
  }
  const rank = (k: Offer['kind']) => (k === 'official' ? 0 : k === 'cloud' ? 1 : 2);
  out.sort((a, b) => {
    if (rank(a.kind) !== rank(b.kind)) return rank(a.kind) - rank(b.kind);
    return (a.input ?? Number.POSITIVE_INFINITY) - (b.input ?? Number.POSITIVE_INFINITY);
  });
  return out;
}
