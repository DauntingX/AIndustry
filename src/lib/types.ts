/**
 * 全站唯一的数据契约：`data/snapshot.json` 的结构。
 * 同步管线（scripts/sync）与前端（src）都以此为准。
 *
 * 三条硬约定：
 *  1. 价格一律是**美元每百万 token**。上游的 $/token、字符串科学计数法都在管线里归一化。
 *  2. 百分制成绩一律是 0–100。上游 0–1 的小数在管线里乘 100。
 *  3. 拿不到就写 null，**绝不填猜测值**。界面对 null 有专门的「暂无数据」呈现。
 */

/** 一处购买渠道。同一个模型在不同渠道的价差经常到两三倍，所以逐渠道存。 */
export interface Offer {
  providerId: string;
  providerName: string;
  /** official = 模型原厂自家平台；cloud = 云厂商托管；aggregator = 第三方聚合/转售 */
  kind: 'official' | 'cloud' | 'aggregator';
  input: number | null;
  output: number | null;
  cacheRead: number | null;
  contextWindow: number | null;
  buyUrl: string | null;
  docUrl: string | null;
}

/** 一个能力维度的成绩。用于详情页把成绩按来源分开摆，不做跨源求平均。 */
export interface ScoreRef {
  value: number;
  /** 量纲：pct=0–100 百分数，index=指数（ECI），elo=Elo 分 */
  unit: 'pct' | 'index' | 'elo';
  source: 'epoch.ai' | 'livebench' | 'models.dev' | 'derived';
}

export interface LiveBenchScores {
  release: string;
  /** 全部任务的平均分，0–100 */
  overall: number | null;
  /** 能力大类 → 该类任务的平均分，0–100 */
  categories: Record<string, number>;
  /** 逐任务得分，0–100 */
  tasks: Record<string, number>;
}

export interface EpochMeta {
  /** Epoch Capabilities Index，综合智力总榜，全站排名的唯一依据 */
  eci: number | null;
  eciLow: number | null;
  eciHigh: number | null;
  /** Open API / API access / Open weights */
  accessibility: string | null;
  /** 逐榜成绩，键为 benchmart id，值已归一到 0–100（Elo 类除外） */
  benchmarks: Record<string, number>;
}

export interface ModelRecord {
  /** 连接键：`vendorId|规范名` */
  key: string;
  /** URL 片段，由 key 转义而来 */
  slug: string;
  name: string;
  nameZh: string | null;
  vendorId: string;
  vendorName: string;
  vendorNameZh: string | null;
  organization: string | null;

  releaseDate: string | null;
  knowledgeCutoff: string | null;
  contextWindow: number | null;
  maxOutput: number | null;

  pricing: { input: number | null; output: number | null; cacheRead: number | null };
  /** 渠道数（含官方），用于列表页直接显示「可比价 N 家」 */
  channelCount: number;

  modalities: { input: string[]; output: string[] };
  capabilities: {
    reasoning: boolean | null;
    toolCall: boolean | null;
    structuredOutput: boolean | null;
    attachment: boolean | null;
  };
  openWeights: boolean | null;
  license: string | null;

  epoch: EpochMeta | null;
  livebench: LiveBenchScores | null;

  offers: Offer[];

  /** 这个模型的字段分别来自哪些上游，用于详情页署名 */
  provenance: string[];
  /** 首次出现在快照里的时间 */
  firstSeenAt: string;
}

export interface VendorRecord {
  id: string;
  name: string;
  nameZh: string | null;
  country: string | null;
  /** 总部所在区域，用于首页分区 */
  region: 'cn' | 'overseas';
  /** 形象母题：机器读得出定价，读不出 DeepSeek 应该是一头鲸 */
  motif: string;
  accent: string;
  homepage: string | null;
  pricingUrl: string | null;
  /** 该厂商在快照里的模型数 */
  modelCount: number;
}

export interface BenchmarkMeta {
  id: string;
  label: string;
  inEci: boolean;
  unit: 'pct' | 'index' | 'elo';
  ceiling: number | null;
  randomBaseline: number | null;
  releaseDate: string | null;
  supersededBy: string | null;
  /** 本快照里有多少模型在这个榜上有成绩 */
  models: number;
}

export interface SourceStatus {
  ok: boolean;
  fetchedAt: string | null;
  /** 本次是否命中条件请求缓存（304） */
  notModified?: boolean;
  note?: string;
}

export interface Snapshot {
  generatedAt: string;
  sources: Record<string, SourceStatus>;
  livebenchRelease: string | null;
  livebenchCategories: Record<string, string[]>;
  benchmarks: BenchmarkMeta[];
  vendors: VendorRecord[];
  models: ModelRecord[];
  stats: {
    models: number;
    withEci: number;
    withLivebench: number;
    withPrice: number;
    offers: number;
    channels: number;
    /** LiveBench 本期榜上一共有多少款模型——覆盖率要对着它算，而不是对着全站 */
    livebenchEntries: number;
  };
}
