import { ENDPOINTS, LIVEBENCH_FALLBACK_RELEASES, toLiveBenchFileKey } from '../config.ts';
import { fetchText, fetchJson } from '../lib/http.ts';
import { toTable, num } from '../lib/csv.ts';
import { canonicalKey } from '../lib/keys.ts';
import { MatchIndex } from '../lib/match.ts';
import type { LiveBenchScores } from '../../../src/lib/types.ts';

/**
 * LiveBench 官方榜单。
 *
 * 用它的理由：它是少数把**逐任务原始得分**公开成一张 CSV 的测评，
 * 于是「写作强不强」「数学强不强」这种分维度的判断有据可依，
 * 而不是只有一个综合分。许可 Apache-2.0，DATASHEET 明文放弃数据版权。
 *
 * 三个坑记在这里，免得下一个人重新踩：
 *  1. release 标签用连字符（`2026-06-25`），但**文件名用下划线**（`table_2026_06_25.csv`）。
 *  2. livebench.ai 挂在 GitHub Pages 上，老 release 的文件会被后续发布覆盖，
 *     所以「最新 release」要以**能否 200 取到表格**为准，而不是以清单里的最后一项为准。
 *  3. 宽表里同一款模型有多行（不同推理档位 / 不同思考预算），
 *     直接取第一行会让「Claude 的高配档」随机变成低配档，必须显式挑一条。
 */

export interface LiveBenchEntry {
  rawName: string;
  ck: string;
  scores: LiveBenchScores;
}

export interface LiveBenchResult {
  ok: boolean;
  release: string | null;
  categories: Record<string, string[]>;
  taskToCategory: Record<string, string>;
  index: MatchIndex<LiveBenchEntry> | null;
  entryCount: number;
  releasesSource: 'upstream' | 'fallback';
  notModified: boolean;
  /** 上游清单里存在、但表格取不到的 release，写进报告方便回溯 */
  skipped: string[];
  note?: string;
  error?: string;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

/** 从 LiveBench 源仓库解析 release 清单。解析不到就用内置兜底。 */
async function resolveReleases(): Promise<{ releases: string[]; source: 'upstream' | 'fallback' }> {
  const res = await fetchText(ENDPOINTS.liveBenchReleases);
  if (res.ok && res.text) {
    const m = res.text.match(/LIVE_BENCH_RELEASES\s*=\s*\{([^}]*)\}/);
    if (m) {
      const found = [...m[1].matchAll(/["'](\d{4}-\d{2}-\d{2})["']/g)].map((x) => x[1]);
      if (found.length > 0) return { releases: [...new Set(found)].sort(), source: 'upstream' };
    }
  }
  return { releases: [...LIVEBENCH_FALLBACK_RELEASES], source: 'fallback' };
}

export async function fetchLiveBench(): Promise<LiveBenchResult> {
  const base: LiveBenchResult = {
    ok: false, release: null, categories: {}, taskToCategory: {},
    index: null, entryCount: 0, releasesSource: 'fallback', notModified: false, skipped: [],
  };

  const { releases, source } = await resolveReleases();
  const skipped: string[] = [];

  for (let i = releases.length - 1; i >= 0; i -= 1) {
    const release = releases[i];
    const res = await fetchText(ENDPOINTS.liveBenchTable(toLiveBenchFileKey(release)));
    if (!res.ok || !res.text) {
      skipped.push(`${release}(HTTP ${res.error ?? '失败'})`);
      continue;
    }
    const { columns, rows } = toTable(res.text);
    if (rows.length === 0 || columns.length < 3) {
      skipped.push(`${release}(空表)`);
      continue;
    }

    // 分类定义与宽表来自两个 URL，分类拿不到时整条管线必须还能跑
    const catRes = await fetchJson<Record<string, string[]>>(ENDPOINTS.liveBenchCategories(toLiveBenchFileKey(release)));
    const categories = catRes.data ?? {};
    const taskToCategory: Record<string, string> = {};
    for (const [cat, list] of Object.entries(categories)) {
      for (const t of list) taskToCategory[t] = cat;
    }

    const tasks = columns.filter((c) => c !== 'model' && c !== 'Model' && c !== '');
    /** 规范名 → 该模型在本次 release 里的逐任务得分 */
    const byCk = new Map<string, Record<string, number>>();

    for (const r of rows) {
      const name = (r.model ?? r.Model ?? '').trim();
      if (!name) continue;
      const ck = canonicalKey(name);
      if (!ck) continue;
      const scores: Record<string, number> = {};
      for (const t of tasks) {
        const v = num(r[t]);
        if (v != null) scores[t] = v;
      }
      if (Object.keys(scores).length === 0) continue;
      const prev = byCk.get(ck);
      // 同一规范名多行 = 同一款模型的不同推理档位。
      // 覆盖任务数更多的那条更可能是完整运行，优先；并列时保留先到的。
      if (!prev || Object.keys(scores).length > Object.keys(prev).length) byCk.set(ck, scores);
    }

    const index = new MatchIndex<LiveBenchEntry>();
    for (const [ck, taskScores] of byCk) {
      const catScores: Record<string, number> = {};
      for (const [cat, list] of Object.entries(categories)) {
        const vals = list.map((t) => taskScores[t]).filter((v): v is number => typeof v === 'number');
        if (vals.length > 0) catScores[cat] = round1(vals.reduce((a, b) => a + b, 0) / vals.length);
      }
      const all = Object.values(taskScores);
      index.add(ck, {
        rawName: ck,
        ck,
        scores: {
          release,
          overall: all.length > 0 ? round1(all.reduce((a, b) => a + b, 0) / all.length) : null,
          categories: catScores,
          tasks: Object.fromEntries(Object.entries(taskScores).map(([k, v]) => [k, round1(v)])),
        },
      });
    }

    return {
      ok: true,
      release,
      categories,
      taskToCategory,
      index,
      entryCount: byCk.size,
      releasesSource: source,
      notModified: res.notModified,
      skipped,
      note: `${byCk.size} 款模型 · ${tasks.length} 项任务 · ${Object.keys(categories).length} 个能力大类${
        source === 'fallback' ? ' · release 清单走了内置兜底' : ''
      }${skipped.length ? ` · 跳过 ${skipped.length} 个 release` : ''}`,
    };
  }

  return { ...base, releasesSource: source, skipped, error: `清单里没有可取到的 release：${skipped.slice(-3).join(' ')}` };
}
