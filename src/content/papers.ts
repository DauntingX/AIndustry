/**
 * 关键性文章库。
 *
 * **为什么每篇都要写「因此新增的能力」**：一串论文标题对读者毫无用处。
 * 有价值的是那句因果——「因为 MLA 把 KV 缓存压到了原来的几十分之一，
 * 所以这一代模型的推理成本才降得下来」。所以这里每一条都强制带 `unlocks`，
 * 界面上也只展示这句话，标题和链接退到次要位置。
 *
 * **链接政策**：只收录两类地址，两类都不靠猜——
 *   1. arXiv 摘要页。编号经 arXiv 官方 API 批量核对过标题，且 arXiv 的 abs 链接是永久的。
 *   2. 官方发布页 / 官方仓库。全部实测可达（200）后才写进来。
 * 查不到可靠出处的条目宁可不收：这个站的底线是「不编」。
 */

export interface Paper {
  id: string;
  /** 论文或技术报告的标题，原文 */
  title: string;
  /** 中文副标题，说明它干了什么 */
  titleZh: string;
  /** 出品方 */
  org: string;
  year: number;
  url: string;
  /** 一句话：**这款模型因此多出来的能力是什么** */
  unlocks: string;
  /** 适用哪些厂商；'*' 表示通用基础工作，所有厂商的详情页都会列 */
  appliesTo: string[];
  /** 归属的模型家族关键词（小写），用于和具体型号对上 */
  families?: string[];
  kind: 'paper' | 'report' | 'release';
}

export const PAPERS: Paper[] = [
  // ── 通用基础 ────────────────────────────────────────────────
  {
    id: 'transformer',
    title: 'Attention Is All You Need',
    titleZh: '注意力就是全部所需',
    org: 'Google Brain / Google Research',
    year: 2017,
    url: 'https://arxiv.org/abs/1706.03762',
    unlocks: '用自注意力替掉循环结构，训练可以整条序列并行展开——这是「把模型做大」第一次变得现实的那个前提。',
    appliesTo: ['*'],
  },
  {
    id: 'scaling-laws',
    title: 'Scaling Laws for Neural Language Models',
    titleZh: '语言模型的缩放定律',
    org: 'OpenAI',
    year: 2020,
    url: 'https://arxiv.org/abs/2001.08361',
    unlocks: '把「加大算力和数据就能变强」从经验直觉变成了可外推的幂律曲线，模型的规模开始能被提前规划。',
    appliesTo: ['openai', 'anthropic', 'google', 'xai', 'meta', 'deepseek', 'alibaba'],
  },
  {
    id: 'chinchilla',
    title: 'Training Compute-Optimal Large Language Models',
    titleZh: '训练算力最优的大语言模型（Chinchilla）',
    org: 'DeepMind',
    year: 2022,
    url: 'https://arxiv.org/abs/2203.15556',
    unlocks: '指出当时的大模型普遍「参数太多、数据太少」，按比例补数据比继续堆参数更划算——同等算力下能力直接上一个台阶。',
    appliesTo: ['google', 'meta', 'mistral', 'alibaba', 'deepseek'],
  },
  {
    id: 'instructgpt',
    title: 'Training language models to follow instructions with human feedback',
    titleZh: '用人类反馈训练语言模型遵循指令（InstructGPT）',
    org: 'OpenAI',
    year: 2022,
    url: 'https://arxiv.org/abs/2203.02155',
    unlocks: 'RLHF 让模型从「续写文本」变成「照要求办事」，这是对话式产品能成立的分界线。',
    appliesTo: ['*'],
  },
  {
    id: 'cot',
    title: 'Chain-of-Thought Prompting Elicits Reasoning in Large Language Models',
    titleZh: '思维链提示激发大模型的推理能力',
    org: 'Google Research',
    year: 2022,
    url: 'https://arxiv.org/abs/2201.11903',
    unlocks: '让模型把中间步骤写出来，数学与逻辑题的准确率出现跳变——「推理」从涌现现象变成了可复现的技术。',
    appliesTo: ['*'],
  },
  {
    id: 'self-consistency',
    title: 'Self-Consistency Improves Chain of Thought Reasoning in Language Models',
    titleZh: '自洽性采样提升思维链推理',
    org: 'Google Research',
    year: 2022,
    url: 'https://arxiv.org/abs/2203.11171',
    unlocks: '同一题多采几条推理链再投票，用推理期的算力直接换分数——这是后来「思考预算」这条产品线的源头。',
    appliesTo: ['*'],
  },
  {
    id: 'react',
    title: 'ReAct: Synergizing Reasoning and Acting in Language Models',
    titleZh: 'ReAct：让推理与行动交织',
    org: 'Princeton / Google',
    year: 2022,
    url: 'https://arxiv.org/abs/2210.03629',
    unlocks: '把「想一步」和「调一次工具」交替进行，模型第一次能在推理过程中读外部结果并改变计划。',
    appliesTo: ['*'],
  },
  {
    id: 'toolformer',
    title: 'Toolformer: Language Models Can Teach Themselves to Use Tools',
    titleZh: 'Toolformer：模型自己学会用工具',
    org: 'Meta AI',
    year: 2023,
    url: 'https://arxiv.org/abs/2302.04761',
    unlocks: '用自监督标注出「该在哪一步调哪个 API」，工具调用不再依赖人工写死流程。',
    appliesTo: ['meta', 'openai', 'anthropic', 'google', 'alibaba', '*'],
  },
  {
    id: 'dpo',
    title: 'Direct Preference Optimization: Your Language Model is Secretly a Reward Model',
    titleZh: '直接偏好优化（DPO）',
    org: 'Stanford University',
    year: 2023,
    url: 'https://arxiv.org/abs/2305.18290',
    unlocks: '把 RLHF 里那个难训的奖励模型整个去掉，用一步监督式损失完成对齐——偏好微调从此人人都做得起。',
    appliesTo: ['*'],
  },
  {
    id: 'constitutional-ai',
    title: 'Constitutional AI: Harmlessness from AI Feedback',
    titleZh: '宪法式 AI：用 AI 反馈实现无害',
    org: 'Anthropic',
    year: 2022,
    url: 'https://arxiv.org/abs/2212.08073',
    unlocks: '把安全标准写成一份可读的原则清单，让模型按原则自我批评与修正，人工标注量下降一个数量级。',
    appliesTo: ['anthropic'],
  },
  {
    id: 'lora',
    title: 'LoRA: Low-Rank Adaptation of Large Language Models',
    titleZh: 'LoRA：大模型的低秩适配',
    org: 'Microsoft',
    year: 2021,
    url: 'https://arxiv.org/abs/2106.09685',
    unlocks: '把微调压缩成训练不到 1% 的参数，几十张卡就能把一个通用基座改造成行业模型。',
    appliesTo: ['microsoft', '*'],
  },
  {
    id: 'flashattention',
    title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
    titleZh: 'FlashAttention：IO 感知的快速精确注意力',
    org: 'Stanford University',
    year: 2022,
    url: 'https://arxiv.org/abs/2205.14135',
    unlocks: '把注意力的显存占用从平方级压下来，长上下文从「理论上可以」变成「训练得动」。',
    appliesTo: ['*'],
  },
  {
    id: 'paged-attention',
    title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention',
    titleZh: 'PagedAttention：把 KV 缓存像虚拟内存一样分页（vLLM）',
    org: 'UC Berkeley',
    year: 2023,
    url: 'https://arxiv.org/abs/2309.06180',
    unlocks: '服务端的显存浪费被削掉一大半，同一张卡能同时服务几倍的请求——这是 API 价格持续下探的工程底座之一。',
    appliesTo: ['*'],
  },
  {
    id: 'mamba',
    title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
    titleZh: 'Mamba：选择性状态空间的线性时间序列建模',
    org: 'Carnegie Mellon / Princeton',
    year: 2023,
    url: 'https://arxiv.org/abs/2312.00752',
    unlocks: '给出了一条把序列建模从平方复杂度降到线性复杂度的路线，长序列的推理成本不再随长度爆炸。',
    appliesTo: ['ai21', 'liquid', 'nvidia'],
  },
  {
    id: 'rag',
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    titleZh: '检索增强生成（RAG）',
    org: 'Facebook AI Research',
    year: 2020,
    url: 'https://arxiv.org/abs/2005.11401',
    unlocks: '把参数化记忆换成可检索的外部索引，模型的时效性和可溯源性第一次能被工程手段控制。',
    appliesTo: ['cohere', 'perplexity', '*'],
  },

  // ── 各家技术报告 ────────────────────────────────────────────
  {
    id: 'gpt4-report',
    title: 'GPT-4 Technical Report',
    titleZh: 'GPT-4 技术报告',
    org: 'OpenAI',
    year: 2023,
    url: 'https://arxiv.org/abs/2303.08774',
    unlocks: '图像输入与文本输出统一在一个模型里，同时把「可预测的规模化」写成了工程方法——多模态从此是旗舰的默认配置。',
    appliesTo: ['openai'],
  },
  {
    id: 'humaneval',
    title: 'Evaluating Large Language Models Trained on Code',
    titleZh: 'Codex：在代码上训练语言模型及其评测（HumanEval）',
    org: 'OpenAI',
    year: 2021,
    url: 'https://arxiv.org/abs/2107.03374',
    unlocks: '不仅证明了代码能力可以被训练出来，还给出了第一套被广泛复用的评测集——「模型会不会写代码」从此可以量化比较。',
    appliesTo: ['openai', 'deepseek', 'alibaba', 'poolside', '*'],
  },
  {
    id: 'swe-bench',
    title: 'SWE-bench: Can Language Models Resolve Real-World GitHub Issues?',
    titleZh: 'SWE-bench：模型能修真实仓库的 issue 吗',
    org: 'Princeton University',
    year: 2023,
    url: 'https://arxiv.org/abs/2310.06770',
    unlocks: '把评测从「写完一个函数」升级成「在几十万行的仓库里定位并改对」，代理式编程这才有了可信的衡量尺。',
    appliesTo: ['*'],
  },
  {
    id: 'claude-3',
    title: 'Introducing the next generation of Claude',
    titleZh: 'Claude 3 家族发布',
    org: 'Anthropic',
    year: 2024,
    url: 'https://www.anthropic.com/news/claude-3-family',
    unlocks: '用 Opus / Sonnet / Haiku 三档同时发布的方式，把「能力」和「成本」拆成两道可独立选择的轴。',
    appliesTo: ['anthropic'],
    kind: 'release',
  },
  {
    id: 'claude-3-7',
    title: 'Claude 3.7 Sonnet',
    titleZh: 'Claude 3.7 Sonnet 与扩展思考',
    org: 'Anthropic',
    year: 2025,
    url: 'https://www.anthropic.com/news/claude-3-7-sonnet',
    unlocks: '把「思考多久」做成可由调用方控制的参数，推理深度第一次成为按次计费的商品。',
    appliesTo: ['anthropic'],
    kind: 'release',
  },
  {
    id: 'gemini-1-5',
    title: 'Gemini 1.5: Unlocking multimodal understanding across millions of tokens of context',
    titleZh: 'Gemini 1.5：跨百万 token 的多模态理解',
    org: 'Google DeepMind',
    year: 2024,
    url: 'https://arxiv.org/abs/2403.05530',
    unlocks: '稀疏专家架构配上超长上下文，整本书、整段视频可以一次性喂进去——「上下文」从几千 token 涨到百万量级。',
    appliesTo: ['google'],
  },
  {
    id: 'llama-2',
    title: 'Llama 2: Open Foundation and Fine-Tuned Chat Models',
    titleZh: 'Llama 2：开放基座与对齐后的对话模型',
    org: 'Meta AI',
    year: 2023,
    url: 'https://arxiv.org/abs/2307.09288',
    unlocks: '把可商用的开放权重对话模型摆到台面上，还附带了完整的安全对齐做法——开源阵营自此有了能对标闭源的底座。',
    appliesTo: ['meta'],
  },
  {
    id: 'llama-3-herd',
    title: 'The Llama 3 Herd of Models',
    titleZh: 'Llama 3 模型群',
    org: 'Meta AI',
    year: 2024,
    url: 'https://arxiv.org/abs/2407.21783',
    unlocks: '用一份公开的数据配比与训练配方把 405B 参数推到同级最好，并验证了「数据质量比数据数量更决定上限」。',
    appliesTo: ['meta'],
  },
  {
    id: 'mistral-7b',
    title: 'Mistral 7B',
    titleZh: 'Mistral 7B',
    org: 'Mistral AI',
    year: 2023,
    url: 'https://arxiv.org/abs/2310.06825',
    unlocks: '用分组查询注意力与滑动窗口注意力，让 7B 的小模型在多数任务上超过比自己大一倍的对手。',
    appliesTo: ['mistral'],
  },
  {
    id: 'mixtral',
    title: 'Mixtral of Experts',
    titleZh: 'Mixtral 稀疏专家',
    org: 'Mistral AI',
    year: 2024,
    url: 'https://arxiv.org/abs/2401.04088',
    unlocks: '每个 token 只激活一小部分专家，把「大模型的能力」和「小模型的推理成本」第一次捏到了一起。',
    appliesTo: ['mistral', 'alibaba', 'deepseek', 'google'],
  },
  {
    id: 'deepseek-v2',
    title: 'DeepSeek-V2: A Strong, Economical, and Efficient Mixture-of-Experts Language Model',
    titleZh: 'DeepSeek-V2：强、经济、高效的混合专家模型',
    org: 'DeepSeek',
    year: 2024,
    url: 'https://arxiv.org/abs/2405.04434',
    unlocks: '多头潜在注意力（MLA）把 KV 缓存压缩到原来的几十分之一，同等效果下推理显存和成本直接掉一个量级。',
    appliesTo: ['deepseek'],
  },
  {
    id: 'deepseek-v3',
    title: 'DeepSeek-V3 Technical Report',
    titleZh: 'DeepSeek-V3 技术报告',
    org: 'DeepSeek',
    year: 2024,
    url: 'https://arxiv.org/abs/2412.19437',
    unlocks: '无辅助损失的专家负载均衡加 FP8 混合精度训练，把前沿模型的训练成本压到了此前预期的零头。',
    appliesTo: ['deepseek'],
  },
  {
    id: 'deepseek-r1',
    title: 'DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning',
    titleZh: 'DeepSeek-R1：用强化学习激发推理能力',
    org: 'DeepSeek',
    year: 2025,
    url: 'https://arxiv.org/abs/2501.12948',
    unlocks: '纯强化学习就能让模型自己长出长思维链与自我检查，并且这套推理能力被开源了出来——闭源推理模型的技术壁垒当场消失。',
    appliesTo: ['deepseek'],
  },
  {
    id: 'deepseek-r1-release',
    title: 'DeepSeek-R1 发布公告',
    titleZh: 'DeepSeek-R1 正式发布',
    org: 'DeepSeek',
    year: 2025,
    url: 'https://api-docs.deepseek.com/news/news250120',
    unlocks: '推理模型第一次以开放权重 + 极低 API 定价同时提供，行业对「前沿能力要花多少钱」的预期被重置。',
    appliesTo: ['deepseek'],
    kind: 'release',
  },
  {
    id: 'qwen2-5',
    title: 'Qwen2.5 Technical Report',
    titleZh: 'Qwen2.5 技术报告',
    org: 'Alibaba Qwen',
    year: 2024,
    url: 'https://arxiv.org/abs/2412.15115',
    unlocks: '把 18T token 的预训练数据与结构化输出、长上下文一起做进开源模型，中英双语的开源基座质量上了一个台阶。',
    appliesTo: ['alibaba'],
  },
  {
    id: 'qwen2-vl',
    title: "Qwen2-VL: Enhancing Vision-Language Model's Perception of the World at Any Resolution",
    titleZh: 'Qwen2-VL：任意分辨率的视觉语言模型',
    org: 'Alibaba Qwen',
    year: 2024,
    url: 'https://arxiv.org/abs/2409.12191',
    unlocks: '动态分辨率加多模态旋转位置编码，图片不再被强行压缩成固定尺寸，视频也能按帧率自适应读取。',
    appliesTo: ['alibaba'],
  },
  {
    id: 'qwen3',
    title: 'Qwen3 Technical Report',
    titleZh: 'Qwen3 技术报告',
    org: 'Alibaba Qwen',
    year: 2025,
    url: 'https://arxiv.org/abs/2505.09388',
    unlocks: '一个权重里同时装思考与非思考两种模式，推理开销可以由调用方按场景切换——不必再为快和强维护两套模型。',
    appliesTo: ['alibaba'],
  },
  {
    id: 'qwen2-5-release',
    title: 'Qwen2.5 发布说明',
    titleZh: 'Qwen2.5 系列发布',
    org: 'Alibaba Qwen',
    year: 2024,
    url: 'https://qwenlm.github.io/blog/qwen2.5/',
    unlocks: '把 0.5B 到 72B 的尺寸梯度一次性铺开，量化版与长上下文版同批放出——开源模型第一次有了完整的产品线感。',
    appliesTo: ['alibaba'],
    kind: 'release',
  },
  {
    id: 'glm-130b',
    title: 'GLM-130B: An Open Bilingual Pre-trained Model',
    titleZh: 'GLM-130B：双语开源预训练模型',
    org: 'Tsinghua / Zhipu AI',
    year: 2022,
    url: 'https://arxiv.org/abs/2210.02414',
    unlocks: '证明中英双语基座在千亿规模上可以靠自研训练跑通，并且权重完全开放——中文开源大模型这条线由此起步。',
    appliesTo: ['zhipuai'],
  },
  {
    id: 'yi',
    title: 'Yi: Open Foundation Models by 01.AI',
    titleZh: 'Yi：零一万物的开放基座模型',
    org: '01.AI',
    year: 2024,
    url: 'https://arxiv.org/abs/2403.04652',
    unlocks: '用一条 6B 到 34B 的完整配方，说明数据质量与训练顺序能在较小参数上换到更高的能力密度。',
    appliesTo: ['01-ai'],
  },
];

/** 取和某个厂商相关的文章，通用条目排在后面。 */
export function papersFor(vendorId: string): Paper[] {
  const specific = PAPERS.filter((p) => p.appliesTo.includes(vendorId));
  const general = PAPERS.filter((p) => p.appliesTo.includes('*') && !p.appliesTo.includes(vendorId));
  return [...specific, ...general];
}
