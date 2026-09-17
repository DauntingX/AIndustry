/**
 * 厂商档案。
 *
 * 这是全站唯一依赖人类常识的地方：机器读得出某家对哪款模型报价多少，
 * 读不出「DeepSeek 应该被画成一头鲸」、「月之暗面应该用月亮色」。
 *
 * 处理方式是**查表而不是逻辑**：表里有的厂商用专属形象，没有的自动落到
 * `wanderer`（神秘旅人）兜底——由厂商 id 的稳定哈希决定配色，由总部国家推导区域。
 * 任何情况下都不会失败、不会白屏、不会阻塞同步管线。
 */

export interface VendorProfile {
  id: string;
  /** 中文名，缺失时界面直接显示英文原名（比机器瞎翻更专业） */
  nameZh: string;
  nameEn: string;
  /** ISO 3166-1 alpha-2 */
  country: string;
  region: 'cn' | 'overseas';
  /** 形象母题 id，见 scripts/avatars/motifs.ts */
  motif: string;
  /** 主色，十六进制 */
  accent: string;
  homepage: string;
  pricingUrl?: string;
  /** 一句话定位，用于厂商页副标题 */
  blurb: string;
}

export const VENDORS: VendorProfile[] = [
  {
    id: 'openai', nameZh: 'OpenAI', nameEn: 'OpenAI', country: 'US', region: 'overseas',
    motif: 'knot', accent: '#10a37f', homepage: 'https://openai.com',
    pricingUrl: 'https://platform.openai.com/docs/pricing',
    blurb: '把「对话式 AI」变成产品品类的那一家，也是推理模型范式的主要推动者。',
  },
  {
    id: 'anthropic', nameZh: 'Anthropic', nameEn: 'Anthropic', country: 'US', region: 'overseas',
    motif: 'sunburst', accent: '#d97757', homepage: 'https://www.anthropic.com',
    pricingUrl: 'https://www.anthropic.com/pricing#api',
    blurb: '以「宪法式 AI」路线立身，长期把长上下文与代码代理能力当作主攻方向。',
  },
  {
    id: 'google', nameZh: '谷歌 DeepMind', nameEn: 'Google DeepMind', country: 'US', region: 'overseas',
    motif: 'gem', accent: '#4285f4', homepage: 'https://deepmind.google',
    pricingUrl: 'https://ai.google.dev/gemini-api/docs/pricing',
    blurb: '唯一同时在自研芯片、超长上下文与多模态原生三条线上都有实质产出的一家。',
  },
  {
    id: 'deepseek', nameZh: '深度求索', nameEn: 'DeepSeek', country: 'CN', region: 'cn',
    motif: 'whale', accent: '#4d6bfe', homepage: 'https://www.deepseek.com',
    pricingUrl: 'https://api-docs.deepseek.com/quick_start/pricing',
    blurb: '用极低的训练成本把开源权重推理模型推到第一梯队，重构了行业对算力门槛的预期。',
  },
  {
    id: 'alibaba', nameZh: '阿里通义', nameEn: 'Alibaba Qwen', country: 'CN', region: 'cn',
    motif: 'cloud', accent: '#ff6a00', homepage: 'https://qwen.ai',
    pricingUrl: 'https://help.aliyun.com/zh/model-studio/models',
    blurb: '开源模型数量与下载量长期全球第一，是「开放权重」这条路上最坚定的投入者。',
  },
  {
    id: 'zhipuai', nameZh: '智谱 AI', nameEn: 'Zhipu AI', country: 'CN', region: 'cn',
    motif: 'lantern', accent: '#3859ff', homepage: 'https://www.zhipuai.cn',
    pricingUrl: 'https://open.bigmodel.cn/pricing',
    blurb: '国内最早做通用大模型的一批，GLM 系列在开源与私有化交付上都很活跃。',
  },
  {
    id: 'moonshotai', nameZh: '月之暗面', nameEn: 'Moonshot AI', country: 'CN', region: 'cn',
    motif: 'moon', accent: '#1f2937', homepage: 'https://www.moonshot.cn',
    pricingUrl: 'https://platform.moonshot.cn/docs/pricing/chat',
    blurb: '长上下文起家，Kimi 系列把超长文本处理做成了面向大众的定型产品。',
  },
  {
    id: 'minimax', nameZh: 'MiniMax', nameEn: 'MiniMax', country: 'CN', region: 'cn',
    motif: 'prism', accent: '#f43f5e', homepage: 'https://www.minimax.io',
    pricingUrl: 'https://platform.minimaxi.com/document/price',
    blurb: '文本、语音、视频三条线并行的多模态公司，开源系列用极低激活参数量换效率。',
  },
  {
    id: 'bytedance', nameZh: '字节跳动', nameEn: 'ByteDance', country: 'CN', region: 'cn',
    motif: 'spark', accent: '#325ab4', homepage: 'https://www.volcengine.com/product/ark',
    pricingUrl: 'https://www.volcengine.com/docs/82379/1099320',
    blurb: '豆包系列背靠巨大的自有流量场景，是国内把模型能力直接铺进消费级产品的一家。',
  },
  {
    id: 'tencent', nameZh: '腾讯混元', nameEn: 'Tencent Hunyuan', country: 'CN', region: 'cn',
    motif: 'wave', accent: '#12b7f5', homepage: 'https://hunyuan.tencent.com',
    blurb: '把模型能力优先接进自有社交与办公生态，开源版本多集中在中小尺寸。',
  },
  {
    id: 'baidu', nameZh: '百度文心', nameEn: 'Baidu ERNIE', country: 'CN', region: 'cn',
    motif: 'bear', accent: '#2932e1', homepage: 'https://yiyan.baidu.com',
    blurb: '国内最早一批对外发布大模型的公司，文心系列在检索增强与知识问答上积累深。',
  },
  {
    id: 'stepfun', nameZh: '阶跃星辰', nameEn: 'StepFun', country: 'CN', region: 'cn',
    motif: 'staircase', accent: '#2563eb', homepage: 'https://www.stepfun.com',
    blurb: '多模态能力投入较早，Step 系列在语音与视觉上做了不少端到端尝试。',
  },
  {
    id: 'xfyun', nameZh: '科大讯飞', nameEn: 'iFlytek', country: 'CN', region: 'cn',
    motif: 'podium', accent: '#0a7d3c', homepage: 'https://xinghuo.xfyun.cn',
    blurb: '语音起家，星火系列把模型能力往教育、办公等强行业场景里推。',
  },
  {
    id: '01-ai', nameZh: '零一万物', nameEn: '01.AI', country: 'CN', region: 'cn',
    motif: 'gate', accent: '#00b96b', homepage: 'https://www.01.ai',
    blurb: '以「高效小模型」为切入点，在同等效果下把推理成本作为主要优化目标。',
  },
  {
    id: 'xiaomi', nameZh: '小米', nameEn: 'Xiaomi', country: 'CN', region: 'cn',
    motif: 'arch', accent: '#ff6900', homepage: 'https://platform.xiaomimimo.com',
    blurb: '把模型能力押在端侧与人车家场景，MiMo 系列强调小体量与设备侧部署。',
  },
  {
    id: 'bailing', nameZh: '蚂蚁百灵', nameEn: 'Ant Ling', country: 'CN', region: 'cn',
    motif: 'antler', accent: '#1677ff', homepage: 'https://ling.tbox.cn',
    blurb: '倾向把推理与工具调用能力做成可规模化的基础件。',
  },
  {
    id: 'longcat', nameZh: '美团龙猫', nameEn: 'Meituan LongCat', country: 'CN', region: 'cn',
    motif: 'cat', accent: '#ffc300', homepage: 'https://longcat.chat',
    blurb: '把模型能力直接接到本地生活场景的调度与决策链路上。',
  },
  {
    id: 'sensenova', nameZh: '商汤日日新', nameEn: 'SenseNova', country: 'CN', region: 'cn',
    motif: 'eye', accent: '#00a0e9', homepage: 'https://www.sensenova.cn',
    blurb: '视觉起家的多模态路线，模型与自建算力捆绑对外提供。',
  },
  {
    id: 'xai', nameZh: 'xAI', nameEn: 'xAI', country: 'US', region: 'overseas',
    motif: 'comet', accent: '#111827', homepage: 'https://x.ai',
    pricingUrl: 'https://docs.x.ai/docs/models',
    blurb: '以极短时间自建超算集群把 Grok 推到前沿，同时把实时信息接入当作差异点。',
  },
  {
    id: 'meta', nameZh: 'Meta', nameEn: 'Meta', country: 'US', region: 'overseas',
    motif: 'infinity', accent: '#0866ff', homepage: 'https://ai.meta.com',
    blurb: 'Llama 系列曾以一己之力把开放权重推成行业默认选项，路线近年几经调整。',
  },
  {
    id: 'mistral', nameZh: 'Mistral AI', nameEn: 'Mistral AI', country: 'FR', region: 'overseas',
    motif: 'flame', accent: '#ff7000', homepage: 'https://mistral.ai',
    pricingUrl: 'https://mistral.ai/pricing',
    blurb: '欧洲最重要的模型公司，擅长用稀疏专家架构把成本压到同级最低。',
  },
  {
    id: 'cohere', nameZh: 'Cohere', nameEn: 'Cohere', country: 'CA', region: 'overseas',
    motif: 'coral', accent: '#39c5bb', homepage: 'https://cohere.com',
    pricingUrl: 'https://cohere.com/pricing',
    blurb: '主打企业检索与私有化部署，RAG 与重排序工具链是它的看家本事。',
  },
  {
    id: 'ai21', nameZh: 'AI21 Labs', nameEn: 'AI21 Labs', country: 'IL', region: 'overseas',
    motif: 'pillar', accent: '#e05252', homepage: 'https://www.ai21.com',
    blurb: '以混合专家与状态空间结合的架构探索长上下文效率。',
  },
  {
    id: 'amazon', nameZh: '亚马逊', nameEn: 'Amazon', country: 'US', region: 'overseas',
    motif: 'box', accent: '#ff9900', homepage: 'https://aws.amazon.com/bedrock/',
    pricingUrl: 'https://aws.amazon.com/bedrock/pricing/',
    blurb: 'Nova 系列主打性价比与和云服务的深度绑定，同时是最大的模型转售方之一。',
  },
  {
    id: 'microsoft', nameZh: '微软', nameEn: 'Microsoft', country: 'US', region: 'overseas',
    motif: 'window', accent: '#0078d4', homepage: 'https://azure.microsoft.com/products/ai-foundry',
    blurb: 'Phi 系列用「教科书级数据」证明小模型也能有强推理，主要服务端侧与低成本场景。',
  },
  {
    id: 'nvidia', nameZh: '英伟达', nameEn: 'NVIDIA', country: 'US', region: 'overseas',
    motif: 'chip', accent: '#76b900', homepage: 'https://build.nvidia.com',
    blurb: '既是算力供给方，也开源 Nemotron 系列来验证自家训练与推理栈。',
  },
  {
    id: 'ibm', nameZh: 'IBM', nameEn: 'IBM', country: 'US', region: 'overseas',
    motif: 'blue', accent: '#0f62fe', homepage: 'https://www.ibm.com/products/watsonx-ai',
    blurb: '主打面向受监管行业的企业级模型，强调可溯源与治理。',
  },
  {
    id: 'allenai', nameZh: 'Ai2', nameEn: 'Allen Institute for AI', country: 'US', region: 'overseas',
    motif: 'lanternfish', accent: '#f0554c', homepage: 'https://allenai.org',
    blurb: '非营利研究机构，把完全开放的数据与权重当作公开科学的一部分。',
  },
  {
    id: 'liquid', nameZh: 'Liquid AI', nameEn: 'Liquid AI', country: 'US', region: 'overseas',
    motif: 'droplet', accent: '#00a3a3', homepage: 'https://www.liquid.ai',
    blurb: '从液体神经网络理论出发，做非 Transformer 的高效架构。',
  },
  {
    id: 'reka', nameZh: 'Reka AI', nameEn: 'Reka AI', country: 'US', region: 'overseas',
    motif: 'feather', accent: '#7c3aed', homepage: 'https://www.reka.ai',
    blurb: '从零自研多模态架构，主打小体量与端到端视频理解。',
  },
  {
    id: 'thinkingmachines', nameZh: 'Thinking Machines', nameEn: 'Thinking Machines Lab', country: 'US', region: 'overseas',
    motif: 'orbit', accent: '#000000', homepage: 'https://thinkingmachines.ai',
    blurb: '聚焦模型与人类协作的接口，把「可定制性」当作核心产品主张。',
  },
  {
    id: 'poolside', nameZh: 'Poolside', nameEn: 'Poolside', country: 'US', region: 'overseas',
    motif: 'waveform', accent: '#0ea5e9', homepage: 'https://poolside.ai',
    blurb: '只做代码与软件工程这一个域，把代理式编程当作唯一战场。',
  },
  {
    id: 'perplexity', nameZh: 'Perplexity', nameEn: 'Perplexity', country: 'US', region: 'overseas',
    motif: 'compass', accent: '#20808d', homepage: 'https://www.perplexity.ai',
    blurb: '把检索与生成缝成一件产品，模型层主要围绕检索增强做优化。',
  },
  {
    id: 'upstage', nameZh: 'Upstage', nameEn: 'Upstage', country: 'KR', region: 'overseas',
    motif: 'sail', accent: '#f97316', homepage: 'https://www.upstage.ai',
    blurb: '韩国代表性的模型公司，Solar 系列以数据配比和轻量化见长。',
  },
  {
    id: 'sarvam', nameZh: 'Sarvam AI', nameEn: 'Sarvam AI', country: 'IN', region: 'overseas',
    motif: 'lotus', accent: '#f59e0b', homepage: 'https://www.sarvam.ai',
    blurb: '面向印度多语言场景自建模型，把十亿级用户的语种覆盖当作切入点。',
  },
  {
    id: 'inception', nameZh: 'Inception Labs', nameEn: 'Inception Labs', country: 'US', region: 'overseas',
    motif: 'lightning', accent: '#ec4899', homepage: 'https://www.inceptionlabs.ai',
    blurb: '押注扩散式文本生成，把并行解码当作压低延迟的路线。',
  },
  {
    id: 'sakana', nameZh: 'Sakana AI', nameEn: 'Sakana AI', country: 'JP', region: 'overseas',
    motif: 'school', accent: '#0ea5e9', homepage: 'https://sakana.ai',
    blurb: '研究导向，用进化算法与模型合并探索不靠堆算力的路线。',
  },
];

export const VENDOR_BY_ID = new Map(VENDORS.map((v) => [v.id, v]));

/** 查不到的厂商不报错，返回一个能让界面正常渲染的兜底档案。 */
export function vendorProfile(id: string, fallbackName?: string): VendorProfile {
  const found = VENDOR_BY_ID.get(id);
  if (found) return found;
  const region = CJK_VENDORS.has(id) ? 'cn' : 'overseas';
  return {
    id,
    nameZh: fallbackName ?? id,
    nameEn: fallbackName ?? id,
    country: 'XX',
    region,
    motif: 'wanderer',
    accent: hashAccent(id),
    homepage: '',
    blurb: '尚未收录专属档案的厂商，界面上以神秘旅人的兜底形象出现。',
  };
}

/** 已知的中国大陆厂商集合，仅用于给未收录档案的厂商判区域。 */
export const CJK_VENDORS = new Set([
  'baidu', 'xiaomi', 'bailing', 'longcat', 'sensenova', 'xfyun', '01-ai', 'stepfun',
  'bytedance', 'tencent', 'alibaba', 'zhipuai', 'moonshotai', 'minimax', 'deepseek',
]);

/** 由厂商 id 稳定推导一个配色，保证「同一个厂商每次都是同一个颜色」。 */
function hashAccent(id: string): string {
  let h = 2166136261;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const hue = Math.abs(h) % 360;
  return hslToHex(hue, 62, 52);
}

function hslToHex(h: number, s: number, l: number): string {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * c).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** 区域的中文说法。键沿用「东西大陆」是为了和快照里的既有字段对齐。 */
export const REGION_LABEL: Record<'cn' | 'overseas', string> = {
  cn: '国内厂商',
  overseas: '国外厂商',
};
