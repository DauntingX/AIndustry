/**
 * 标识归一化：把三个上游源里同一款模型的不同写法收敛到同一个键。
 *
 * 三家的命名风格完全不同：
 *   models.dev   openai/gpt-5.2         ·  张量化的 id，自带厂商前缀
 *   Epoch AI     GPT-5.2 / OpenAI       ·  人类可读的 display name + 独立的 Organization 列
 *   LiveBench    gpt-5-2-xhigh-effort   ·  评测配置直接拼进名字里
 *
 * 合并的连接键是 `vendorId|canonicalKey`，而不是字符串本身。
 * 原因是「同名不同家」在这行很常见（Mistral 和 Cohere 都出过 small）。
 */

/** 厂商名（Epoch 的 Organization 列 / 各种文本写法）→ 我们内部的厂商 id。 */
export const VENDOR_ALIASES: Record<string, string> = {
  // 北美
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  'google deepmind': 'google',
  'google research': 'google',
  deepmind: 'google',
  xai: 'xai',
  'x.ai': 'xai',
  meta: 'meta',
  'meta ai': 'meta',
  facebook: 'meta',
  'meta platforms': 'meta',
  mistral: 'mistral',
  'mistral ai': 'mistral',
  cohere: 'cohere',
  'cohere labs': 'cohere',
  'ai21': 'ai21',
  'ai21 labs': 'ai21',
  amazon: 'amazon',
  aws: 'amazon',
  'amazon web services': 'amazon',
  microsoft: 'microsoft',
  'microsoft research': 'microsoft',
  nvidia: 'nvidia',
  ibm: 'ibm',
  'ibm research': 'ibm',
  'allen institute for ai': 'allenai',
  allenai: 'allenai',
  ai2: 'allenai',
  'liquid ai': 'liquid',
  liquid: 'liquid',
  reka: 'reka',
  'reka ai': 'reka',
  perplexity: 'perplexity',
  'perplexity ai': 'perplexity',
  'thinking machines': 'thinkingmachines',
  poolside: 'poolside',
  // 中国
  deepseek: 'deepseek',
  'deepseek ai': 'deepseek',
  alibaba: 'alibaba',
  qwen: 'alibaba',
  'qwen team': 'alibaba',
  alibabacloud: 'alibaba',
  'z.ai (zhipu ai)': 'zhipuai',
  'zhipu ai': 'zhipuai',
  zhipu: 'zhipuai',
  'z.ai': 'zhipuai',
  glm: 'zhipuai',
  moonshot: 'moonshotai',
  'moonshot ai': 'moonshotai',
  kimi: 'moonshotai',
  minimax: 'minimax',
  bytedance: 'bytedance',
  'bytedance seed': 'bytedance',
  seed: 'bytedance',
  doubao: 'bytedance',
  volcengine: 'bytedance',
  tencent: 'tencent',
  hunyuan: 'tencent',
  baidu: 'baidu',
  ernie: 'baidu',
  stepfun: 'stepfun',
  'stepfun ai': 'stepfun',
  xfyun: 'xfyun',
  iflytek: 'xfyun',
  '01.ai': '01-ai',
  '01-ai': '01-ai',
  yi: '01-ai',
  xiaomi: 'xiaomi',
  'xiaomi mimo': 'xiaomi',
  'ant group': 'bailing',
  ant: 'bailing',
  bailing: 'bailing',
  meituan: 'longcat',
  longcat: 'longcat',
  sensenova: 'sensenova',
  upstage: 'upstage',
  sarvam: 'sarvam',
  'sarvam ai': 'sarvam',
  inception: 'inception',
  sakana: 'sakana',
  'sakana ai': 'sakana',
  // 其他
  nvidia_nim: 'nvidia',
};

/** models.dev 里属于「模型原厂自家平台」的 provider id，其余一律按第三方渠道处理。 */
export const FIRST_PARTY_PROVIDERS: Record<string, string> = {
  openai: 'openai',
  anthropic: 'anthropic',
  google: 'google',
  'google-vertex': 'google',
  xai: 'xai',
  meta: 'meta',
  llama: 'meta',
  mistral: 'mistral',
  cohere: 'cohere',
  ai21: 'ai21',
  'amazon-bedrock': 'amazon',
  azure: 'microsoft',
  'azure-cognitive-services': 'microsoft',
  nvidia: 'nvidia',
  watsonx: 'ibm',
  deepseek: 'deepseek',
  alibaba: 'alibaba',
  'alibaba-cn': 'alibaba',
  'alibaba-coding-plan': 'alibaba',
  'alibaba-coding-plan-cn': 'alibaba',
  'alibaba-token-plan': 'alibaba',
  'alibaba-token-plan-cn': 'alibaba',
  zhipuai: 'zhipuai',
  zai: 'zhipuai',
  'zhipuai-coding-plan': 'zhipuai',
  'zai-coding-plan': 'zhipuai',
  moonshotai: 'moonshotai',
  'moonshotai-cn': 'moonshotai',
  'kimi-for-coding': 'moonshotai',
  minimax: 'minimax',
  'minimax-cn': 'minimax',
  'minimax-coding-plan': 'minimax',
  'minimax-cn-coding-plan': 'minimax',
  volcengine: 'bytedance',
  'volcengine-coding-plan': 'bytedance',
  'tencent-tokenhub': 'tencent',
  'tencent-coding-plan': 'tencent',
  'tencent-token-plan': 'tencent',
  stepfun: 'stepfun',
  'stepfun-ai': 'stepfun',
  'stepfun-step-plan': 'stepfun',
  'stepfun-ai-step-plan': 'stepfun',
  xiaomi: 'xiaomi',
  'xiaomi-token-plan-cn': 'xiaomi',
  'xiaomi-token-plan-ams': 'xiaomi',
  'xiaomi-token-plan-sgp': 'xiaomi',
  longcat: 'longcat',
  sensenova: 'sensenova',
  bailing: 'bailing',
  upstage: 'upstage',
  sarvam: 'sarvam',
  inception: 'inception',
  sakana: 'sakana',
  perplexity: 'perplexity',
  poolside: 'poolside',
  thinkingmachines: 'thinkingmachines',
  'allenai': 'allenai',
  reka: 'reka',
  liquid: 'liquid',
  modelscope: 'alibaba',
};

/**
 * 拼进模型名里的评测/部署配置后缀。这些噪声会把同一款模型拆成十几个键，
 * 合并前必须先剥掉——但**必须连同变体一起剥**，否则会把
 * gpt-5-nano 这类真正的产品线当成噪声误伤。
 */
const NOISE_TOKENS = new Set([
  'thinking', 'nothinking', 'nonthinking', 'reasoning', 'reasoner', 'nonreasoning',
  'high', 'low', 'medium', 'minimal', 'xhigh', 'xhigh2', 'extrahigh', 'auto',
  'effort', 'higheffort', 'maxeffort', 'adaptive', 'default',
  'preview', 'latest', 'experimental', 'exp', 'beta', 'alpha', 'rc', 'snapshot',
  'instruct', 'chat', 'it', 'base', 'pretrained', 'online', 'free', 'thinking64k',
]);

/** 绝不能当噪声剥掉的产品线词。保留它是为了让 `-mini` 与基础款分得开。 */
const KEEP_TOKENS = new Set(['pro', 'flash', 'mini', 'nano', 'micro', 'small', 'medium', 'large', 'lite', 'turbo', 'plus', 'max', 'ultra', 'air', 'opus', 'sonnet', 'haiku', 'reasoning']);

/**
 * 把任意写法收敛成规范键。设计原则是「宁可少合，不可错合」：
 * 合错了会让两款模型的价格和分数串在一起，比多出一条重复记录严重得多。
 */
export function canonicalKey(raw: string): string {
  let s = String(raw ?? '').toLowerCase().trim();
  if (!s) return '';

  // 去掉厂商前缀（openai/gpt-5.2 → gpt-5.2；@cf/xxx 这类也一并处理）
  s = s.replace(/^[a-z0-9_.-]+\//, '');
  // 去掉括号注释
  s = s.replace(/\([^)]*\)/g, ' ');
  // 统一分隔符
  s = s.replace(/[\s_.]+/g, '-');
  // 版本号粘连：opus-4-5 → opus-4.5，gpt-5-2 → gpt-5.2
  //
  // 三个必须踩过的坑：
  //  1. 用捕获组把数字带回来。直接替换成 '.' 会把版本号本身吃掉，
  //     于是 `gpt-5.2` 变成 `gpt-.2`，全站的排名与价格都会按错误的键合并。
  //  2. 让正则**消费掉两侧的数字**（`(\d)-(\d)` 而不是 `(\d)-(?=\d)`）。
  //     用前瞻时匹配不消费后半段，扫描会在 `4-5-20251101` 上继续串烧成 `4.5.20251101`。
  //  3. **参数规模不是版本号。** 这个坑比前两个隐蔽得多：`llama-3-70b`
  //     同样满足「数字-数字」，于是被粘成 `llama-3.70b`，显示出来就是
  //     「Llama 3.70B」——把「第 3 代 70B 参数」读成了「3.70 这个版本」。
  //     同一批被毁掉的还有 Gemma 3 27B、Nemotron 4 15B、Qwen3 30B 等 16 款。
  //     判据：紧跟其后的字符是字母或数字时，说明这串数字是规格而非版本号。
  //     注意前瞻必须同时挡住**数字**：只写 `(?![a-z])` 会被正则回溯绕过——
  //     `70` 匹配失败后它会退而匹配 `7`，此时下一个字符是 `0`（不是字母），
  //     于是照样粘出 `llama-3.70b`。这是这个 bug 第一次没修掉的原因。
  s = s.replace(/(\d)-(\d+)(?![0-9a-z])/g, '$1.$2');
  // 去掉日期戳：紧凑 8 位（20251101）、yyyy.mm.dd、yyyy.mm、yyyymm
  s = s.replace(/-\d{8}(?=-|$)/g, '');
  s = s.replace(/-\d{4}\.\d{2}\.\d{2}(?=-|$)/g, '');
  s = s.replace(/-(19|20)\d{2}\.\d{2}(?=-|$)/g, '');
  s = s.replace(/(^|-)\d{6}(?=-|$)/g, '');
  s = s.replace(/-+/g, '-').replace(/^-|-$/g, '');

  // 从尾部逐段剥离噪声（thinking / high / 64k / 纯年份……）
  const parts = s.split('-');
  while (parts.length > 1) {
    const last = parts[parts.length - 1];
    const squeezed = last.replace(/\./g, '');
    if (NOISE_TOKENS.has(last) || NOISE_TOKENS.has(squeezed)) {
      parts.pop();
      continue;
    }
    // -64k / -128k / -1m 这类上下文标记
    if (/^\d+k$|^\d+m$/.test(last)) {
      parts.pop();
      continue;
    }
    // 裸年份
    if (/^20\d{2}$/.test(last)) {
      parts.pop();
      continue;
    }
    break;
  }
  s = parts.join('-');

  // MMDD 形式的日期戳（grok-4.20-0309、qwen3.8-max-0902）。
  // 只在键里已经出现过真正的十进制版本号时才剥，避免误伤把它当版本尾号的名字。
  if (/\d\.\d/.test(s)) s = s.replace(/[-.]\d{4}$/, '');

  return s.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Epoch 的 Organization 列 → 厂商 id；查不到就原样 slug 化，绝不抛错。 */
export function vendorFromOrg(org: string): string {
  const k = String(org ?? '').toLowerCase().trim();
  if (!k) return 'unknown';
  if (VENDOR_ALIASES[k]) return VENDOR_ALIASES[k];
  // 再去掉常见后缀再试一次（"Mistral AI Inc." → "mistral ai"）
  const stripped = k.replace(/[.,]|\b(inc|llc|ltd|co|corp|team|research|labs?)\b/g, ' ').replace(/\s+/g, ' ').trim();
  if (VENDOR_ALIASES[stripped]) return VENDOR_ALIASES[stripped];
  return stripped.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
}

export function modelKey(vendorId: string, raw: string): string {
  return `${vendorId}|${canonicalKey(raw)}`;
}

/** 这个 models.dev provider id 是不是模型原厂自家的平台。 */
export function isFirstParty(providerId: string): boolean {
  return FIRST_PARTY_PROVIDERS[providerId] != null;
}

/**
 * 厂商 → 自家产品线的名字前缀。
 *
 * 为什么必须有这张表：**云平台会托管别人家的模型**。
 * `amazon-bedrock` 上有 Claude 和 Llama，`azure` 上有 GPT，`volcengine` 上有 DeepSeek。
 * 如果不加区分地把这些平台上的模型收进名册，首页会变成
 * 「亚马逊发布了 166 款模型、其中一半是 Anthropic 的」——数字全对，结论全错。
 *
 * 规则很简单：平台上的模型只有落在自家前缀里才算「这家发布的」，
 * 其余的一律降级为「该渠道有售」，照样出现在价格对比里，只是不再冒充当家产品。
 */
export const VENDOR_FAMILIES: Record<string, string[]> = {
  openai: ['gpt', 'o1', 'o3', 'o4', 'chatgpt', 'codex', 'davinci', 'text-embedding', 'omni', 'sora', 'computer-use', 'deep-research'],
  anthropic: ['claude'],
  google: ['gemini', 'gemma', 'imagen', 'veo', 'lyria', 'chirp', 'medgemma', 'learnlm'],
  'google-vertex': ['gemini', 'gemma', 'imagen', 'veo'],
  xai: ['grok'],
  meta: ['llama', 'muse', 'meta'],
  llama: ['llama', 'muse'],
  mistral: ['mistral', 'mixtral', 'magistral', 'devstral', 'pixtral', 'codestral', 'voxtral', 'ministral', 'labs', 'open-mistral', 'open-mixtral', 'open-math'],
  cohere: ['command', 'c4ai', 'embed', 'rerank', 'aya'],
  ai21: ['jamba', 'jurassic', 'maestro'],
  'amazon-bedrock': ['nova', 'titan'],
  azure: ['phi'],
  'azure-cognitive-services': ['phi'],
  nvidia: ['nemotron', 'nv-'],
  watsonx: ['granite'],
  ibm: ['granite'],
  deepseek: ['deepseek'],
  alibaba: ['qwen', 'qwq', 'tongyi', 'wanx', 'fun', 'paraformer', 'cosyvoice', 'qwen3'],
  'alibaba-cn': ['qwen', 'qwq', 'tongyi', 'wanx', 'fun', 'paraformer', 'cosyvoice', 'qwen3'],
  'alibaba-coding-plan': ['qwen', 'qwq'],
  'alibaba-coding-plan-cn': ['qwen', 'qwq'],
  'alibaba-token-plan': ['qwen', 'qwq'],
  'alibaba-token-plan-cn': ['qwen', 'qwq'],
  zhipuai: ['glm', 'chatglm', 'cogview', 'cogvideo', 'autoglm'],
  zai: ['glm', 'chatglm', 'cogview', 'cogvideo', 'autoglm'],
  'zhipuai-coding-plan': ['glm'],
  'zai-coding-plan': ['glm'],
  moonshotai: ['kimi', 'moonshot'],
  'moonshotai-cn': ['kimi', 'moonshot'],
  'kimi-for-coding': ['kimi'],
  minimax: ['minimax', 'abab', 'hailuo'],
  'minimax-cn': ['minimax', 'abab', 'hailuo'],
  'minimax-coding-plan': ['minimax'],
  'minimax-cn-coding-plan': ['minimax'],
  volcengine: ['doubao', 'seed', 'skylark', 'wan'],
  'volcengine-coding-plan': ['doubao', 'seed'],
  'tencent-tokenhub': ['hunyuan'],
  'tencent-coding-plan': ['hunyuan'],
  'tencent-token-plan': ['hunyuan'],
  stepfun: ['step', 'stepaudio', 'steplm', 'steptalk'],
  'stepfun-ai': ['step', 'stepaudio', 'steplm', 'steptalk'],
  'stepfun-step-plan': ['step', 'stepaudio', 'steplm', 'steptalk'],
  'stepfun-ai-step-plan': ['step', 'stepaudio', 'steplm', 'steptalk'],
  xiaomi: ['mimo'],
  'xiaomi-token-plan-cn': ['mimo'],
  'xiaomi-token-plan-ams': ['mimo'],
  'xiaomi-token-plan-sgp': ['mimo'],
  longcat: ['longcat'],
  bailing: ['ling', 'ring', 'bailing'],
  sensenova: ['sensenova', 'sense', 'nova'],
  upstage: ['solar'],
  sarvam: ['sarvam'],
  inception: ['mercury'],
  sakana: ['sakana', 'namazu', 'abe', 'fugu'],
  perplexity: ['sonar'],
  poolside: ['poolside', 'malibu', 'laguna'],
  thinkingmachines: ['tml', 'inkling'],
  allenai: ['olmo', 'molmo', 'tulu', 'ari', 'luca'],
  reka: ['reka'],
  liquid: ['lfm'],
};

/**
 * 这个模型算不算这家厂商自家的产品。
 * 表里没有的厂商一律放行——漏收比错收严重：漏收只是少一条，
 * 错收会让整页的「谁最强」变成错的。
 */
export function belongsToVendor(providerId: string, ck: string): boolean {
  const families = VENDOR_FAMILIES[providerId];
  if (!families) return true;
  return families.some((f) => {
    if (ck === f) return true;
    if (!ck.startsWith(f)) return false;
    // 紧跟其后的必须是分隔符或版本号数字：
    //   `qwen3.8-max` 命中 family `qwen`，而 `museum-1` 不该命中 `muse`。
    const rest = ck.slice(f.length);
    return rest.startsWith('-') || rest.startsWith('.') || /^[0-9]/.test(rest);
  });
}
