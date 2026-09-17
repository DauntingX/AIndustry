import path from 'node:path';
import fs from 'node:fs';

function findRepoRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 8; i += 1) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

export const ROOT = findRepoRoot();
export const DATA_DIR = path.join(ROOT, 'data');
export const RAW_DIR = path.join(DATA_DIR, 'raw');
export const CACHE_DIR = path.join(DATA_DIR, '.cache');
export const SNAPSHOT_PATH = path.join(DATA_DIR, 'snapshot.json');
export const REPORT_PATH = path.join(DATA_DIR, 'sync-report.json');

/**
 * 三个上游源。全部是公开、可再生、可再分发的数据：
 *   - Epoch AI      CC-BY 4.0（署名即可再分发）
 *   - models.dev    MIT
 *   - LiveBench     Apache-2.0，且 DATASHEET 明文放弃数据版权
 * 刻意不接入 Artificial Analysis（条款禁止再分发）与 LMArena（条款禁止自动抓取）。
 */
export const ENDPOINTS = {
  /** 综合智力指数（ECI）与逐榜成绩都在这个 zip 里 */
  epochZip: 'https://epoch.ai/data/benchmark_data.zip',
  /** 模型规格、价格、上下文、模态 */
  modelsDev: 'https://models.dev/api.json',
  /** LiveBench 宽表：model × 逐任务得分 */
  liveBenchTable: (release: string) => `https://livebench.ai/table_${release}.csv`,
  /** LiveBench 分类定义：任务 → 能力大类 */
  liveBenchCategories: (release: string) => `https://livebench.ai/categories_${release}.json`,
  /** release 清单的权威出处（源仓库里解析 LIVE_BENCH_RELEASES 集合） */
  liveBenchReleases:
    'https://raw.githubusercontent.com/LiveBench/LiveBench/main/livebench/common.py',
} as const;

/** 网络层参数：整条管线跑在 GitHub Actions 上，容忍一次抖动但不无限重试。 */
export const HTTP = {
  timeoutMs: 90_000,
  retries: 3,
  retryDelayMs: 2_000,
  userAgent:
    'ai-model-compare-sync/1.0 (+https://github.com/; data: epoch.ai CC-BY-4.0, models.dev MIT, livebench.ai Apache-2.0)',
};

/**
 * LiveBench release 清单的兜底值。
 * 正常路径是从上游 common.py 解析 `LIVE_BENCH_RELEASES`，这里只在解析失败时顶上。
 * 写成兜底而不是主路径，是因为写死清单意味着新 release 永远不会被发现，
 * 那就和「上线后不依赖人工维护」直接冲突了。
 */
export const LIVEBENCH_FALLBACK_RELEASES = [
  '2024-06-24', '2024-07-26', '2024-08-31', '2024-11-25', '2025-04-02', '2025-04-25',
  '2025-05-30', '2025-11-25', '2025-12-23', '2026-01-08', '2026-06-25',
];

/** LiveBench 的 URL 用下划线，release 标签用连字符。 */
export const toLiveBenchFileKey = (release: string) => release.replace(/-/g, '_');

/**
 * 我们关心哪些厂商。不追求把 models.dev 上 220 家全搬进来——
 * 站点的用途是横向对比「各家的大模型」，长尾供应商的渠道报价会淹没主干信号。
 */
export const TRACKED_VENDORS = [
  'openai', 'anthropic', 'google', 'xai', 'meta', 'mistral', 'cohere', 'ai21',
  'amazon', 'microsoft', 'nvidia', 'deepseek', 'alibaba', 'zhipuai', 'moonshotai',
  'minimax', 'bytedance', 'tencent', 'baidu', 'stepfun', 'xfyun', '01-ai', 'upstage',
  'perplexity', 'inception', 'sarvam', 'ibm', 'liquid', 'theta', 'allenai', 'reka',
];

/** 合理性闸门：任一不通过就拒绝写入快照、保留上一版，并以非零码退出。 */
export const SANITY = {
  /** 模型总数相对上一版跌幅上限 */
  maxModelCountDropRatio: 0.25,
  /** 承重指标：ECI 覆盖率相对跌幅上限（它塌了首页的排名就全错了） */
  maxEciCoverageRelativeDrop: 0.5,
  /** 价格必须是正数；为零或负一律判为解析事故 */
  requirePositivePrice: false,
} as const;
