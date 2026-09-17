/**
 * 渠道注册表：把 models.dev 的 provider id 映射成一个「人能点进去买东西」的入口。
 *
 * 这是全站唯一需要人类常识的地方——机器读得出某家对 GPT-5.2 报价多少，
 * 读不出「想买应该点哪个按钮」。做法和上游其它表一样：**查表，不是逻辑**。
 *
 * 表里查不到的渠道不会失败：回落到上游给的 docs 地址，或者只显示价格不给链接。
 * 仓库是公开的，任何人可以补一行。
 */

export type ChannelKind = 'official' | 'cloud' | 'aggregator';

export interface ChannelInfo {
  /** 渠道的中文名，缺失时用上游英文名 */
  nameZh?: string;
  kind: ChannelKind;
  /** 直接能下单/开通的地址 */
  buyUrl: string;
  /** 价格表地址，通常比首页更有用 */
  pricingUrl?: string;
}

/** 原厂自家平台：买到的是官方直供，也是官方定价的出处。 */
export const OFFICIAL_CHANNELS: Record<string, ChannelInfo> = {
  openai: { kind: 'official', nameZh: 'OpenAI 官方', buyUrl: 'https://platform.openai.com/api-keys', pricingUrl: 'https://platform.openai.com/docs/pricing' },
  anthropic: { kind: 'official', nameZh: 'Anthropic 官方', buyUrl: 'https://console.anthropic.com/settings/keys', pricingUrl: 'https://www.anthropic.com/pricing#api' },
  google: { kind: 'official', nameZh: 'Google AI Studio', buyUrl: 'https://aistudio.google.com/apikey', pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing' },
  'google-vertex': { kind: 'official', nameZh: 'Google Vertex AI', buyUrl: 'https://console.cloud.google.com/vertex-ai', pricingUrl: 'https://cloud.google.com/vertex-ai/generative-ai/pricing' },
  xai: { kind: 'official', nameZh: 'xAI 官方', buyUrl: 'https://console.x.ai/', pricingUrl: 'https://docs.x.ai/docs/models' },
  meta: { kind: 'official', nameZh: 'Meta Llama', buyUrl: 'https://llama.developer.meta.com/', pricingUrl: 'https://llama.developer.meta.com/docs/models' },
  llama: { kind: 'official', nameZh: 'Meta Llama', buyUrl: 'https://llama.developer.meta.com/', pricingUrl: 'https://llama.developer.meta.com/docs/models' },
  mistral: { kind: 'official', nameZh: 'Mistral 官方', buyUrl: 'https://console.mistral.ai/', pricingUrl: 'https://mistral.ai/pricing' },
  cohere: { kind: 'official', nameZh: 'Cohere 官方', buyUrl: 'https://dashboard.cohere.com/api-keys', pricingUrl: 'https://cohere.com/pricing' },
  ai21: { kind: 'official', nameZh: 'AI21 官方', buyUrl: 'https://studio.ai21.com/', pricingUrl: 'https://www.ai21.com/pricing' },
  'amazon-bedrock': { kind: 'cloud', nameZh: 'Amazon Bedrock', buyUrl: 'https://console.aws.amazon.com/bedrock/', pricingUrl: 'https://aws.amazon.com/bedrock/pricing/' },
  azure: { kind: 'cloud', nameZh: 'Azure AI Foundry', buyUrl: 'https://ai.azure.com/', pricingUrl: 'https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/' },
  'azure-cognitive-services': { kind: 'cloud', nameZh: 'Azure 认知服务', buyUrl: 'https://ai.azure.com/' },
  nvidia: { kind: 'cloud', nameZh: 'NVIDIA NIM', buyUrl: 'https://build.nvidia.com/', pricingUrl: 'https://www.nvidia.com/en-us/ai/' },
  watsonx: { kind: 'cloud', nameZh: 'IBM watsonx', buyUrl: 'https://www.ibm.com/products/watsonx-ai', pricingUrl: 'https://www.ibm.com/products/watsonx-ai/pricing' },
  deepseek: { kind: 'official', nameZh: 'DeepSeek 官方', buyUrl: 'https://platform.deepseek.com/api_keys', pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing' },
  alibaba: { kind: 'official', nameZh: '阿里云百炼（国际）', buyUrl: 'https://modelstudio.console.alibabacloud.com/', pricingUrl: 'https://www.alibabacloud.com/help/en/model-studio/model-pricing' },
  'alibaba-cn': { kind: 'official', nameZh: '阿里云百炼（中国）', buyUrl: 'https://bailian.console.aliyun.com/', pricingUrl: 'https://help.aliyun.com/zh/model-studio/models' },
  'alibaba-coding-plan': { kind: 'official', nameZh: '通义灵码编程套餐', buyUrl: 'https://www.alibabacloud.com/en/product/modelstudio' },
  'alibaba-coding-plan-cn': { kind: 'official', nameZh: '通义编程套餐（中国）', buyUrl: 'https://bailian.console.aliyun.com/' },
  'alibaba-token-plan': { kind: 'official', nameZh: '阿里云 Token 套餐', buyUrl: 'https://modelstudio.console.alibabacloud.com/' },
  'alibaba-token-plan-cn': { kind: 'official', nameZh: '阿里云 Token 套餐（中国）', buyUrl: 'https://bailian.console.aliyun.com/' },
  zhipuai: { kind: 'official', nameZh: '智谱开放平台', buyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', pricingUrl: 'https://open.bigmodel.cn/pricing' },
  zai: { kind: 'official', nameZh: 'Z.AI 官方', buyUrl: 'https://z.ai/manage-apikey/apikey-list', pricingUrl: 'https://docs.z.ai/guides/overview/pricing' },
  'zhipuai-coding-plan': { kind: 'official', nameZh: '智谱编码套餐', buyUrl: 'https://open.bigmodel.cn/' },
  'zai-coding-plan': { kind: 'official', nameZh: 'Z.AI 编码套餐', buyUrl: 'https://z.ai/' },
  moonshotai: { kind: 'official', nameZh: 'Moonshot 国际站', buyUrl: 'https://platform.moonshot.ai/console/api-keys', pricingUrl: 'https://platform.moonshot.ai/docs/pricing/chat' },
  'moonshotai-cn': { kind: 'official', nameZh: '月之暗面开放平台', buyUrl: 'https://platform.moonshot.cn/console/api-keys', pricingUrl: 'https://platform.moonshot.cn/docs/pricing/chat' },
  'kimi-for-coding': { kind: 'official', nameZh: 'Kimi 编程套餐', buyUrl: 'https://www.kimi.com/code' },
  minimax: { kind: 'official', nameZh: 'MiniMax 国际站', buyUrl: 'https://platform.minimax.io/user-center/basic-information/interface-key', pricingUrl: 'https://platform.minimax.io/docs/guides/pricing' },
  'minimax-cn': { kind: 'official', nameZh: 'MiniMax 开放平台', buyUrl: 'https://platform.minimaxi.com/user-center/basic-information/interface-key', pricingUrl: 'https://platform.minimaxi.com/document/price' },
  'minimax-coding-plan': { kind: 'official', nameZh: 'MiniMax 编程套餐', buyUrl: 'https://platform.minimax.io/' },
  'minimax-cn-coding-plan': { kind: 'official', nameZh: 'MiniMax 编程套餐（中国）', buyUrl: 'https://platform.minimaxi.com/' },
  volcengine: { kind: 'official', nameZh: '火山方舟（字节）', buyUrl: 'https://console.volcengine.com/ark', pricingUrl: 'https://www.volcengine.com/docs/82379/1099320' },
  'volcengine-coding-plan': { kind: 'official', nameZh: '火山方舟编码套餐', buyUrl: 'https://console.volcengine.com/ark' },
  'tencent-tokenhub': { kind: 'official', nameZh: '腾讯云 TokenHub', buyUrl: 'https://console.cloud.tencent.com/' },
  'tencent-coding-plan': { kind: 'official', nameZh: '腾讯云编码套餐', buyUrl: 'https://console.cloud.tencent.com/' },
  'tencent-token-plan': { kind: 'official', nameZh: '腾讯云 Token 套餐', buyUrl: 'https://console.cloud.tencent.com/' },
  stepfun: { kind: 'official', nameZh: '阶跃星辰（中国）', buyUrl: 'https://platform.stepfun.com/interface-key', pricingUrl: 'https://platform.stepfun.com/docs/pricing/details' },
  'stepfun-ai': { kind: 'official', nameZh: 'StepFun 国际站', buyUrl: 'https://platform.stepfun.ai/interface-key' },
  'stepfun-step-plan': { kind: 'official', nameZh: '阶跃星辰套餐', buyUrl: 'https://platform.stepfun.com/' },
  'stepfun-ai-step-plan': { kind: 'official', nameZh: 'StepFun 套餐', buyUrl: 'https://platform.stepfun.ai/' },
  xiaomi: { kind: 'official', nameZh: '小米 MiMo', buyUrl: 'https://platform.xiaomimimo.com/' },
  'xiaomi-token-plan-cn': { kind: 'official', nameZh: '小米 MiMo（中国）', buyUrl: 'https://platform.xiaomimimo.com/' },
  'xiaomi-token-plan-ams': { kind: 'official', nameZh: '小米 MiMo（欧洲）', buyUrl: 'https://platform.xiaomimimo.com/' },
  'xiaomi-token-plan-sgp': { kind: 'official', nameZh: '小米 MiMo（新加坡）', buyUrl: 'https://platform.xiaomimimo.com/' },
  longcat: { kind: 'official', nameZh: 'LongCat（美团）', buyUrl: 'https://longcat.chat/platform/', pricingUrl: 'https://longcat.chat/platform/docs/' },
  bailing: { kind: 'official', nameZh: '百灵（蚂蚁）', buyUrl: 'https://ling.tbox.cn/' },
  sensenova: { kind: 'official', nameZh: '商汤日日新', buyUrl: 'https://platform.sensenova.cn/' },
  upstage: { kind: 'official', nameZh: 'Upstage 官方', buyUrl: 'https://console.upstage.ai/' },
  sarvam: { kind: 'official', nameZh: 'Sarvam AI', buyUrl: 'https://dashboard.sarvam.ai/' },
  inception: { kind: 'official', nameZh: 'Inception Labs', buyUrl: 'https://platform.inceptionlabs.ai/' },
  sakana: { kind: 'official', nameZh: 'Sakana AI', buyUrl: 'https://console.sakana.ai/' },
  perplexity: { kind: 'official', nameZh: 'Perplexity 官方', buyUrl: 'https://www.perplexity.ai/settings/api', pricingUrl: 'https://docs.perplexity.ai/getting-started/pricing' },
  poolside: { kind: 'official', nameZh: 'Poolside', buyUrl: 'https://platform.poolside.ai/' },
  thinkingmachines: { kind: 'official', nameZh: 'Thinking Machines', buyUrl: 'https://tinker.thinkingmachines.dev/' },
  allenai: { kind: 'official', nameZh: 'Ai2', buyUrl: 'https://allenai.org/' },
  reka: { kind: 'official', nameZh: 'Reka AI', buyUrl: 'https://platform.reka.ai/' },
  liquid: { kind: 'official', nameZh: 'Liquid AI', buyUrl: 'https://playground.liquid.ai/' },
  modelscope: { kind: 'cloud', nameZh: '魔搭 ModelScope', buyUrl: 'https://modelscope.cn/models' },
};

/**
 * 第三方渠道：把同一款模型转售出来，或提供多模型聚合入口。
 * 这一栏是这个站最实用的部分——同一款模型在不同渠道的价差经常到两三倍。
 */
export const THIRD_PARTY_CHANNELS: Record<string, ChannelInfo> = {
  openrouter: { kind: 'aggregator', nameZh: 'OpenRouter', buyUrl: 'https://openrouter.ai/settings/keys', pricingUrl: 'https://openrouter.ai/models' },
  vercel: { kind: 'aggregator', nameZh: 'Vercel AI Gateway', buyUrl: 'https://vercel.com/dashboard/ai-gateway', pricingUrl: 'https://vercel.com/ai-gateway/models' },
  togetherai: { kind: 'aggregator', nameZh: 'Together AI', buyUrl: 'https://api.together.ai/settings/api-keys', pricingUrl: 'https://www.together.ai/pricing' },
  'fireworks-ai': { kind: 'aggregator', nameZh: 'Fireworks AI', buyUrl: 'https://fireworks.ai/api-keys', pricingUrl: 'https://fireworks.ai/pricing' },
  deepinfra: { kind: 'aggregator', nameZh: 'DeepInfra', buyUrl: 'https://deepinfra.com/dash/api_keys', pricingUrl: 'https://deepinfra.com/models' },
  groq: { kind: 'aggregator', nameZh: 'Groq', buyUrl: 'https://console.groq.com/keys', pricingUrl: 'https://groq.com/pricing/' },
  novita: { kind: 'aggregator', nameZh: 'NovitaAI', buyUrl: 'https://novita.ai/settings/key-management', pricingUrl: 'https://novita.ai/pricing' },
  'novita-ai': { kind: 'aggregator', nameZh: 'NovitaAI', buyUrl: 'https://novita.ai/settings/key-management', pricingUrl: 'https://novita.ai/pricing' },
  siliconflow: { kind: 'aggregator', nameZh: '硅基流动（国际）', buyUrl: 'https://cloud.siliconflow.com/account/ak', pricingUrl: 'https://cloud.siliconflow.com/models' },
  'siliconflow-cn': { kind: 'aggregator', nameZh: '硅基流动', buyUrl: 'https://cloud.siliconflow.cn/account/ak', pricingUrl: 'https://cloud.siliconflow.cn/models' },
  poe: { kind: 'aggregator', nameZh: 'Poe', buyUrl: 'https://poe.com/api_key' },
  'nano-gpt': { kind: 'aggregator', nameZh: 'NanoGPT', buyUrl: 'https://nano-gpt.com/subscription', pricingUrl: 'https://nano-gpt.com/pricing' },
  chutes: { kind: 'aggregator', nameZh: 'Chutes', buyUrl: 'https://chutes.ai/app/api', pricingUrl: 'https://chutes.ai/app' },
  cerebras: { kind: 'aggregator', nameZh: 'Cerebras', buyUrl: 'https://cloud.cerebras.ai/', pricingUrl: 'https://www.cerebras.ai/pricing' },
  nebius: { kind: 'aggregator', nameZh: 'Nebius', buyUrl: 'https://studio.nebius.com/', pricingUrl: 'https://nebius.com/prices' },
  hyperbolic: { kind: 'aggregator', nameZh: 'Hyperbolic', buyUrl: 'https://app.hyperbolic.xyz/settings', pricingUrl: 'https://hyperbolic.xyz/pricing' },
  'huggingface': { kind: 'aggregator', nameZh: 'Hugging Face Inference', buyUrl: 'https://huggingface.co/settings/tokens', pricingUrl: 'https://huggingface.co/pricing' },
  'github-copilot': { kind: 'aggregator', nameZh: 'GitHub Copilot', buyUrl: 'https://github.com/settings/copilot' },
  baseten: { kind: 'aggregator', nameZh: 'Baseten', buyUrl: 'https://app.baseten.co/settings/api_keys', pricingUrl: 'https://www.baseten.co/pricing/' },
  'cloudflare-workers-ai': { kind: 'aggregator', nameZh: 'Cloudflare Workers AI', buyUrl: 'https://dash.cloudflare.com/', pricingUrl: 'https://developers.cloudflare.com/workers-ai/platform/pricing/' },
  ollama: { kind: 'aggregator', nameZh: 'Ollama', buyUrl: 'https://ollama.com/' },
  'ollama-cloud': { kind: 'aggregator', nameZh: 'Ollama Cloud', buyUrl: 'https://ollama.com/cloud', pricingUrl: 'https://ollama.com/pricing' },
  opencode: { kind: 'aggregator', nameZh: 'OpenCode Zen', buyUrl: 'https://opencode.ai/auth', pricingUrl: 'https://opencode.ai/docs/zen' },
  'opencode-go': { kind: 'aggregator', nameZh: 'OpenCode Go', buyUrl: 'https://opencode.ai/auth' },
  venice: { kind: 'aggregator', nameZh: 'Venice AI', buyUrl: 'https://venice.ai/settings/api', pricingUrl: 'https://docs.venice.ai/models/overview' },
  synthetic: { kind: 'aggregator', nameZh: 'Synthetic', buyUrl: 'https://synthetic.new/pricing' },
  requesty: { kind: 'aggregator', nameZh: 'Requesty', buyUrl: 'https://app.requesty.ai/api-keys', pricingUrl: 'https://requesty.ai/models' },
  kilo: { kind: 'aggregator', nameZh: 'Kilo Code Gateway', buyUrl: 'https://kilocode.ai/' },
  '302ai': { kind: 'aggregator', nameZh: '302.AI', buyUrl: 'https://302.ai/' },
  aihubmix: { kind: 'aggregator', nameZh: 'AIHubMix', buyUrl: 'https://aihubmix.com/' },
  ofox: { kind: 'aggregator', nameZh: 'Ofox AI', buyUrl: 'https://ofox.ai/' },
  qiniu: { kind: 'aggregator', nameZh: '七牛云 AI', buyUrl: 'https://portal.qiniu.com/ai-inference/api-key', pricingUrl: 'https://developer.qiniu.com/aitokenapi/12884/token-api-price' },
  jiekou: { kind: 'aggregator', nameZh: 'Jiekou.AI', buyUrl: 'https://jiekou.ai/' },
  iflowcn: { kind: 'aggregator', nameZh: '心流 iFlow', buyUrl: 'https://platform.iflow.cn/' },
  zenmux: { kind: 'aggregator', nameZh: 'ZenMux', buyUrl: 'https://zenmux.ai/' },
  'alibaba-coding-plan-cn-3p': { kind: 'aggregator', nameZh: '阿里云编程套餐', buyUrl: 'https://bailian.console.aliyun.com/' },
  // 上游这个 provider 的 name 字段字面就是 "NaN"，只能靠这张表把它说回人话。
  // 它的报价全是 0（套餐/额度制），单价不可比，见 derive.ts 的 isPlanPrice。
  nan: { kind: 'aggregator', nameZh: 'nan.builders', buyUrl: 'https://nan.builders/docs/models' },
};

/** 渠道注册表总表：上游 provider id → 展示信息。 */
export const CHANNELS: Record<string, ChannelInfo> = {
  ...OFFICIAL_CHANNELS,
  ...THIRD_PARTY_CHANNELS,
};

export function channelKindOf(providerId: string, fallback: ChannelKind = 'aggregator'): ChannelKind {
  return CHANNELS[providerId]?.kind ?? fallback;
}

export function isOfficial(providerId: string): boolean {
  return OFFICIAL_CHANNELS[providerId] != null;
}

/**
 * 上游 provider 名称的兜底。
 *
 * models.dev 里有一家聚合站，id 是 `nan`、name 字段**字面就是 "NaN"**
 * （域名 nan.builders）。直接渲染出来，表格里就会出现
 * 「第三方 | NaN | $0 | $0」——读者会以为这是本站的渲染 bug，
 * 而这恰恰是最不该出现的一种误解：它让真数据看起来像坏数据。
 *
 * 这里做两件事，顺序很重要：
 *   1. 表里有中文名的用中文名（这是人工维护的一张表，见上）
 *   2. 名称是空串或 NaN/null/undefined 这类「计算机说的词」时，**不要显示它**，
 *      改用 provider id 本身。id 至少是人起的、指向真实存在的服务。
 *
 * 之所以不写死一个 `nan → 'nan.builders'` 的特例：这类脏数据以后还会出现，
 * 兜底要针对「形状」而不是针对「那一条」。表里补中文名才是正解，
 * 兜底只负责让页面在任何情况下都不出现机器词。
 */
const COMPUTER_WORDS = /^(nan|undefined|null|nil|n\/?a|-{1,}|\?+)$/i;

export function providerDisplayName(providerId: string, upstreamName?: string | null): string {
  const known = CHANNELS[providerId]?.nameZh;
  if (known) return known;
  const raw = (upstreamName ?? '').trim();
  if (raw && !COMPUTER_WORDS.test(raw)) return raw;
  // 兜底用 id，但把连字符换成人看得顺眼的写法，避免出现「nan」这种全小写标识
  return providerId
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(' ');
}
