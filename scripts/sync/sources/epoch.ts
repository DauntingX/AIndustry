import { ENDPOINTS, HTTP } from '../config.ts';
import { fetchBinary } from '../lib/http.ts';
import { ZipArchive } from '../lib/zip.ts';
import { toTable, num } from '../lib/csv.ts';
import { canonicalKey, vendorFromOrg } from '../lib/keys.ts';
import { MatchIndex } from '../lib/match.ts';
import type { BenchmarkMeta, EpochMeta } from '../../../src/lib/types.ts';

/**
 * Epoch AI 的 `benchmark_data.zip`。
 *
 * 这个包的好处是它自带一张 `benchmark_metadata.csv`：榜单 id、分数列名、量纲、
 * 随机基线、满分、是否参与 ECI 合成，全部由上游声明。于是我们**不需要为每个榜单
 * 手写解析器**——Epoch 新增一个榜单，下一次同步它就自动出现在站上。
 * 这是「上线后不依赖人工维护」在榜单维度上的落地。
 */

export interface EpochEntry {
  vendorId: string;
  rawName: string;
  organization: string;
  keys: string[];
  eci: number | null;
  eciLow: number | null;
  eciHigh: number | null;
  date: string | null;
  accessibility: string | null;
  benchmarks: Record<string, number>;
}

export interface EpochResult {
  ok: boolean;
  entries: EpochEntry[];
  benchmarks: BenchmarkMeta[];
  benchmarkValues: Map<string, Map<string, number>>;
  index: MatchIndex<EpochEntry> | null;
  notModified: boolean;
  note?: string;
  error?: string;
}

/** 榜单 id → 中文标签。查不到就用上游 id 自动生成一个可读标签。 */
const BENCH_LABELS: Record<string, string> = {
  eci: '综合智力（ECI）',
  gpqa_diamond: 'GPQA Diamond',
  swe_bench_verified: 'SWE-bench Verified',
  otis_mock_aime_2024_2025: 'AIME 2024–2025',
  math_level_5: 'MATH Level 5',
  frontiermath_tier_4_v2: 'FrontierMath Tier 4',
  frontiermath_tiers_1_3_v2: 'FrontierMath Tiers 1–3',
  hle: 'Humanity’s Last Exam',
  arc_agi_2: 'ARC-AGI 2',
  arc_agi: 'ARC-AGI',
  mmlu: 'MMLU',
  gsm8k: 'GSM8K',
  bbh: 'BIG-Bench Hard',
  simpleqa_verified: 'SimpleQA Verified',
  simplebench: 'SimpleBench',
  terminalbench: 'Terminal-Bench',
  aider_polyglot: 'Aider Polyglot',
  webdev_arena: 'WebDev Arena',
  fictionlivebench: 'Fiction.liveBench（长文本）',
  metr_time_horizons: 'METR 任务时长',
  vending_bench_2: 'Vending-Bench 2',
  live_bench: 'LiveBench',
  video_mme: 'Video-MME',
  chess_puzzles: '国际象棋谜题',
  scicode: 'SciCode',
  critpt: 'CritPt',
  geobench: 'GeoBench',
  forecastbench: 'ForecastBench',
  deepresearchbench: 'DeepResearch Bench',
  os_world: 'OSWorld',
  osworld_2: 'OSWorld 2',
  posttrainbench: 'PostTrainBench',
  gdpval: 'GDPval',
  ale_bench: 'ALE-Bench',
  enigma_eval: 'EnigmaEval',
  exploitbench: 'ExploitBench',
  algotune: 'AlgoTune',
  cursorbench: 'CursorBench',
  frontiercode: 'FrontierCode',
  frontierswe: 'FrontierSWE',
  lech_mazur_writing: 'Lech Mazur 写作',
  dtbench: 'DTBench',
  lmca: 'LMCA（长上下文）',
  mindcube: 'MindCube（空间）',
  spatialviz_bench: 'SpatialViz-Bench',
  proofbench: 'ProofBench',
  btf3: 'BTF-3',
  rli: 'RLI',
  cl_bench: 'CL-Bench',
  cl_bench_life: 'CL-Bench Life',
  gbaeval: 'GBAEval',
  surface_evolver_bench: 'Surface Evolver Bench',
  deepswe: 'DeepSWE',
  blueprint_bench_2: 'Blueprint-Bench 2',
  apex_agents: 'APEX-Agents',
  the_agent_company: 'The Agent Company',
  cybench: 'Cybench',
  weirdml: 'WeirdML',
  vpct: 'VPCT',
};

function labelFor(id: string): string {
  if (BENCH_LABELS[id]) return BENCH_LABELS[id];
  return id
    .replace(/_external$/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** 榜单 id：文件名去掉 .csv 与 _external 后缀，与上游 benchmark_metadata 的写法对齐。 */
function benchIdFromFile(file: string): string {
  return file.replace(/\.csv$/, '').replace(/_external$/, '');
}

export async function fetchEpoch(): Promise<EpochResult> {
  const res = await fetchBinary(ENDPOINTS.epochZip);
  if (!res.ok || !res.body) {
    return {
      ok: false, entries: [], benchmarks: [], benchmarkValues: new Map(),
      index: null, notModified: false, error: res.error ?? `HTTP ${res.status}`,
    };
  }

  let zip: ZipArchive;
  try {
    zip = new ZipArchive(res.body);
  } catch (err) {
    return {
      ok: false, entries: [], benchmarks: [], benchmarkValues: new Map(),
      index: null, notModified: res.notModified, error: `zip 解析失败：${String(err)}`,
    };
  }

  // ---- 1. 榜单元信息表（上游自带，我们只透传）----
  const metaFile = zip.findBySuffix('benchmark_metadata.csv');
  const benchmarks: BenchmarkMeta[] = [];
  /** 榜单 id → { sourceFile, scoreColumn, scale, ceiling } */
  const benchSpec = new Map<string, { file: string; column: string; scale: number; ceiling: number | null }>();

  if (metaFile) {
    const { rows } = toTable(zip.readText(metaFile));
    for (const r of rows) {
      const file = (r.source_file ?? '').trim();
      if (!file) continue;
      const id = benchIdFromFile(file);
      const column = (r.score_column ?? '').trim();
      const scale = num(r.scale) ?? 1;
      const ceiling = num(r.score_ceiling);
      const supersededBy = (r.superseded_by ?? '').trim() || null;
      benchSpec.set(id, { file, column, scale, ceiling });
      benchmarks.push({
        id,
        label: labelFor(id),
        inEci: (r.in_eci ?? '').toLowerCase() === 'true',
        unit: scale !== 1 ? 'elo' : 'pct',
        ceiling: ceiling != null && ceiling > 1.5 ? ceiling : null,
        randomBaseline: num(r.random_baseline),
        releaseDate: (r.release_date ?? '').trim() || null,
        supersededBy,
        models: 0,
      });
    }
  }

  // ---- 2. 逐榜成绩 ----
  const benchmarkValues = new Map<string, Map<string, number>>();
  const seenModels = new Map<string, { vendorId: string; organization: string; keys: string[] }>();

  const record = (rawName: string, org: string, benchId: string, value: number, scale: number) => {
    const vendorId = vendorFromOrg(org);
    const ck = canonicalKey(rawName);
    if (!ck) return;
    const full = `${vendorId}|${ck}`;

    let entry = seenModels.get(full);
    if (!entry) {
      entry = { vendorId, organization: org, keys: [ck] };
      seenModels.set(full, entry);
    }
    let bucket = benchmarkValues.get(benchId);
    if (!bucket) {
      bucket = new Map();
      benchmarkValues.set(benchId, bucket);
    }
    // 0–1 的小数一律乘 100；Elo 等无上限量纲保持原值
    const normalized = scale === 1 && value <= 1.5 ? value * 100 : value;
    // 同一模型同一榜留最高分（上游表里可能有多条运行记录）
    const prev = bucket.get(full);
    if (prev == null || normalized > prev) bucket.set(full, normalized);
  };

  for (const spec of benchSpec.values()) {
    const name = zip.findBySuffix(spec.file);
    if (!name) continue;
    const { rows } = toTable(zip.readText(name));
    for (const r of rows) {
      const rawName = (r['Model version'] ?? r.Model ?? r.name ?? '').trim();
      const org = (r.Organization ?? r.organization ?? '').trim();
      if (!rawName || !org) continue;
      const raw = r[spec.column];
      if (raw == null) continue;
      const v = num(raw);
      if (v == null) continue;
      record(rawName, org, benchIdFromFile(spec.file), v, spec.scale);
      // 有 Name 列时它更接近产品名，一并作为候选键
      const display = (r.Name ?? '').trim();
      if (display && display !== rawName) {
        const ck = canonicalKey(display);
        const e = seenModels.get(`${vendorFromOrg(org)}|${canonicalKey(rawName)}`);
        if (e && ck && !e.keys.includes(ck)) e.keys.push(ck);
      }
    }
  }

  // ---- 3. ECI 总榜 ----
  const eciFile = zip.findBySuffix('epoch_capabilities_index/eci_scores.csv') ?? zip.findBySuffix('eci_scores.csv');
  const eciByFull = new Map<string, { eci: number; low: number | null; high: number | null; date: string | null; accessibility: string | null }>();
  if (eciFile) {
    const { rows } = toTable(zip.readText(eciFile));
    for (const r of rows) {
      const raw = (r.Model ?? r['Display name'] ?? '').trim();
      const org = (r.Organization ?? '').trim();
      const eci = num(r.eci);
      if (!raw || !org || eci == null) continue;
      const full = `${vendorFromOrg(org)}|${canonicalKey(raw)}`;
      // 同一模型可能有多个版本，保留 ECI 最高的那条
      const prev = eciByFull.get(full);
      if (!prev || eci > prev.eci) {
        eciByFull.set(full, {
          eci,
          low: num(r.eci_ci_low),
          high: num(r.eci_ci_high),
          date: (r.date ?? '').trim() || null,
          accessibility: (r['Model accessibility'] ?? '').trim() || null,
        });
      }
      const display = (r['Display name'] ?? '').trim();
      if (display && display !== raw) {
        const e = seenModels.get(full);
        const ck = canonicalKey(display);
        if (e && ck && !e.keys.includes(ck)) e.keys.push(ck);
      }
    }
  }

  // ---- 4. 组装 ----
  const entries: EpochEntry[] = [];
  const allFull = new Set<string>([...seenModels.keys(), ...eciByFull.keys()]);
  const index = new MatchIndex<EpochEntry>();

  for (const full of allFull) {
    const info = seenModels.get(full);
    const eciInfo = eciByFull.get(full);
    const ck = full.slice(full.indexOf('|') + 1);
    const entry: EpochEntry = {
      vendorId: full.slice(0, full.indexOf('|')),
      rawName: ck,
      organization: info?.organization ?? '',
      keys: info?.keys ?? [ck],
      eci: eciInfo?.eci ?? null,
      eciLow: eciInfo?.low ?? null,
      eciHigh: eciInfo?.high ?? null,
      date: eciInfo?.date ?? null,
      accessibility: eciInfo?.accessibility ?? null,
      benchmarks: {},
    };
    for (const [benchId, bucket] of benchmarkValues) {
      const v = bucket.get(full);
      if (v != null) entry.benchmarks[benchId] = v;
    }
    if (entry.eci != null) entry.benchmarks.eci = entry.eci;
    entries.push(entry);
    for (const k of entry.keys) index.add(`${entry.vendorId}|${k}`, entry);
  }

  // 榜单覆盖数
  for (const meta of benchmarks) {
    meta.models = benchmarkValues.get(meta.id)?.size ?? 0;
  }
  benchmarks.sort((a, b) => b.models - a.models);

  return {
    ok: true,
    entries,
    benchmarks,
    benchmarkValues,
    index,
    notModified: res.notModified,
    note: `${entries.length} 条记录 · ${benchmarks.length} 个榜单 · 缓存上限 ${Math.round(HTTP.timeoutMs / 1000)}s`,
  };
}

export function epochMetaOf(entry: EpochEntry): EpochMeta {
  return {
    eci: entry.eci,
    eciLow: entry.eciLow,
    eciHigh: entry.eciHigh,
    accessibility: entry.accessibility,
    benchmarks: entry.benchmarks,
  };
}
