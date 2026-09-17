import fs from 'node:fs';
import { SNAPSHOT_PATH } from './config.ts';
import { slugify } from './sources/modelsdev.ts';
import { epochMetaOf, type EpochResult } from './sources/epoch.ts';
import type { LiveBenchResult } from './sources/livebench.ts';
import type { ModelsDevResult } from './sources/modelsdev.ts';
import { vendorProfile } from '../../src/content/vendors.ts';
import { canonicalKey, VENDOR_ALIASES } from './lib/keys.ts';
import type { ModelRecord, Snapshot, VendorRecord, BenchmarkMeta } from '../../src/lib/types.ts';

export interface BuildResult {
  snapshot: Snapshot;
  report: {
    matched: { epoch: number; livebench: number };
    addedFromEpoch: string[];
    unmatchedEpoch: string[];
    duplicateSlugs: string[];
  };
}

const nowIso = () => new Date().toISOString();

export function readPrevious(): Snapshot | null {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
  } catch {
    return null;
  }
}

/**
 * 把三个源合并成一份快照。
 *
 * models.dev 提供**骨架**（有哪些模型、什么规格、什么价、哪些渠道）；
 * Epoch AI 挂上**综合智力与逐榜成绩**；LiveBench 挂上**分维度的能力画像**。
 *
 * 匹配一律走「厂商 + 规范名」这个复合键，且只在候选唯一（或同厂商同规范名）时才认。
 * 合错了会让两款模型的价格和分数串在一起——比多一条漏匹配严重得多，
 * 所以这里宁可漏，漏掉的部分会出现在同步报告的 unmatched 列表里，看得见。
 */
export function buildSnapshot(
  modelsDev: ModelsDevResult,
  epoch: EpochResult,
  livebench: LiveBenchResult,
  previous: Snapshot | null,
): BuildResult {
  const firstSeen = new Map((previous?.models ?? []).map((m) => [m.key, m.firstSeenAt]));
  const report: BuildResult['report'] = {
    matched: { epoch: 0, livebench: 0 },
    addedFromEpoch: [],
    unmatchedEpoch: [],
    duplicateSlugs: [],
  };

  const models: ModelRecord[] = [];
  const byCk = new Map<string, ModelRecord[]>();

  // ---- 1. models.dev 骨架 + Epoch 成绩 ----
  for (const model of modelsDev.models) {
    const ck = model.key.slice(model.key.indexOf('|') + 1);
    const e = resolveEpoch(epoch, model.vendorId, ck);
    if (e) {
      model.epoch = epochMetaOf(e);
      if (!model.provenance.includes('epoch.ai')) model.provenance.push('epoch.ai');
      report.matched.epoch += 1;
    }
    model.firstSeenAt = firstSeen.get(model.key) ?? model.firstSeenAt;
    models.push(model);
    push(byCk, ck, model);
  }

  // ---- 2. Epoch 有分但 models.dev 没收录的模型，补进名册 ----
  // （典型是只公布论文、没上架 API 的模型，以及 models.dev 尚未覆盖的厂商）
  const seenVendorCk = new Set(models.map((m) => m.key));
  for (const entry of epoch.entries) {
    if (entry.eci == null) continue;
    const ck = canonicalKey(entry.rawName);
    const key = `${entry.vendorId}|${ck}`;
    if (seenVendorCk.has(key)) continue;
    const profile = vendorProfile(entry.vendorId);
    // 兜底档案说明这是个我们还不认识的厂商：不进名册，免得首页被长尾淹没
    if (profile.motif === 'wanderer' && !VENDOR_ALIASES[entry.vendorId]) continue;

    const model: ModelRecord = {
      key,
      slug: slugify(key),
      name: prettifyName(entry.rawName),
      nameZh: null,
      vendorId: entry.vendorId,
      vendorName: profile.nameEn,
      vendorNameZh: profile.nameZh,
      organization: entry.organization || null,
      releaseDate: entry.date,
      knowledgeCutoff: null,
      contextWindow: null,
      maxOutput: null,
      pricing: { input: null, output: null, cacheRead: null },
      channelCount: 0,
      modalities: { input: [], output: [] },
      capabilities: { reasoning: null, toolCall: null, structuredOutput: null, attachment: null },
      openWeights: null,
      license: null,
      epoch: epochMetaOf(entry),
      livebench: null,
      offers: [],
      provenance: ['epoch.ai'],
      firstSeenAt: firstSeen.get(key) ?? nowIso(),
    };
    models.push(model);
    push(byCk, ck, model);
    seenVendorCk.add(key);
    report.addedFromEpoch.push(model.name);
  }

  // ---- 3. LiveBench 分维度画像 ----
  // LiveBench 表里没有厂商列，所以只在「规范名唯一对应一款模型」时才挂载。
  if (livebench.index) {
    for (const [ck, group] of byCk) {
      const hit = livebench.index.unique(ck);
      if (!hit) continue;
      // 同一批里有多款模型共享这个规范名 → 无法判断是谁的成绩，跳过
      const owners = group.filter((m) => !m.livebench);
      if (owners.length !== group.length) continue;
      for (const m of owners) {
        m.livebench = hit.scores;
        if (!m.provenance.includes('livebench')) m.provenance.push('livebench');
      }
      report.matched.livebench += 1;
    }
  }

  // ---- 4. 厂商表 ----
  const vendorModels = new Map<string, ModelRecord[]>();
  for (const m of models) push(vendorModels, m.vendorId, m);

  const vendors: VendorRecord[] = [];
  for (const [vendorId, list] of vendorModels) {
    const profile = vendorProfile(vendorId, list[0].vendorName);
    const official = list[0].offers.find((o) => o.kind === 'official');
    vendors.push({
      id: vendorId,
      name: profile.nameEn,
      nameZh: profile.nameZh,
      country: profile.country === 'XX' ? null : profile.country,
      region: profile.region,
      motif: profile.motif,
      accent: profile.accent,
      homepage: profile.homepage || null,
      pricingUrl: profile.pricingUrl ?? official?.docUrl ?? null,
      modelCount: list.length,
    });
  }
  vendors.sort((a, b) => b.modelCount - a.modelCount || a.id.localeCompare(b.id));

  // ---- 5. slug 去重。slug 是 URL 的主键，重复会导致两个模型抢同一个页面 ----
  const slugSeen = new Map<string, number>();
  for (const m of models) {
    const n = slugSeen.get(m.slug) ?? 0;
    slugSeen.set(m.slug, n + 1);
    if (n > 0) report.duplicateSlugs.push(m.slug);
  }
  for (const [slug, n] of slugSeen) {
    if (n <= 1) continue;
    let i = 0;
    for (const m of models) {
      if (m.slug !== slug) continue;
      i += 1;
      if (i > 1) m.slug = `${slug}-${i}`;
    }
  }

  // ---- 6. 榜单覆盖数 + 排序 ----
  const benchmarks: BenchmarkMeta[] = epoch.benchmarks.filter((b) => b.models > 0);
  // LiveBench 的七个能力大类作为一个独立的「榜单集」呈现，不进 Epoch 的榜表
  models.sort((a, b) => (b.epoch?.eci ?? -1) - (a.epoch?.eci ?? -1) || a.name.localeCompare(b.name));

  const stats = {
    models: models.length,
    withEci: models.filter((m) => m.epoch?.eci != null).length,
    withLivebench: models.filter((m) => m.livebench != null).length,
    withPrice: models.filter((m) => m.pricing.input != null).length,
    offers: models.reduce((a, m) => a + m.offers.length, 0),
    channels: new Set(models.flatMap((m) => m.offers.map((o) => o.providerId))).size,
    // 覆盖率的分母是「LiveBench 本期榜上有多少款」，不是全站模型数——
    // 它每期只评几十款，用全站做分母会得到一个永远难看的数字，失去告警的意义。
    livebenchEntries: livebench.entryCount,
  };

  const snapshot: Snapshot = {
    generatedAt: nowIso(),
    sources: {
      'models.dev': sourceStatus(modelsDev.ok, modelsDev.notModified, modelsDev.error, `${modelsDev.models.length} 款模型`),
      'epoch.ai': sourceStatus(epoch.ok, epoch.notModified, epoch.error, epoch.note),
      livebench: sourceStatus(livebench.ok, livebench.notModified, livebench.error, livebench.note),
    },
    livebenchRelease: livebench.release,
    livebenchCategories: livebench.categories,
    benchmarks,
    vendors,
    models,
    stats,
  };

  return { snapshot, report };
}

function sourceStatus(ok: boolean, notModified: boolean, error?: string, note?: string) {
  return {
    ok,
    fetchedAt: ok ? nowIso() : null,
    notModified,
    note: ok ? note : (error ?? '抓取失败'),
  };
}

function resolveEpoch(epoch: EpochResult, vendorId: string, ck: string) {
  if (!epoch.index) return null;
  const hits = epoch.index.lookup(`${vendorId}|${ck}`);
  if (hits.length === 0) return null;
  if (hits.length === 1) return hits[0];
  // 放宽后命中多条 = 同一款模型的多个推理档位/日期版本，取 ECI 最高的那条
  return hits.reduce((best, cur) => ((cur.eci ?? -1) > (best.eci ?? -1) ? cur : best), hits[0]);
}

/** `qwen3.8-max-0902` → `Qwen3.8 Max`，让补录的模型名至少像个人话。 */
function prettifyName(raw: string): string {
  return raw
    .split('-')
    .map((p) => (/^[a-z]/.test(p) ? p.charAt(0).toUpperCase() + p.slice(1) : p))
    .join(' ')
    .replace(/\bGpt\b/g, 'GPT')
    .replace(/\bGlm\b/g, 'GLM')
    .replace(/\bEci\b/g, 'ECI')
    // 规模单位统一大写，含 MoE 写法：
    //   Llama 3 70b → Llama 3 70B      qwen3 30b a3b → Qwen3 30B A3B
    // 允许前导字母是为了让 `a3b` 这类 MoE 规格也一起被照亮。
    .replace(/\b([a-z]?)(\d+(?:\.\d+)?)([bmkt])\b/gi, (_, lead, n, u) => `${lead ? lead.toUpperCase() : ''}${n}${u.toUpperCase()}`)
    // MoE 的两段规格恢复连字符：30B A3B → 30B-A3B（这才是业界写法）
    .replace(/\b(\d+[BMKT])\s+(A\d+[BMKT])\b/g, '$1-$2');
}

function push<T>(map: Map<string, T[]>, key: string, value: T) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}
