import type { MotifSpec } from './motifs.ts';

/**
 * Q 版形象的绘制引擎。
 *
 * 三个设计决定：
 *
 * 1. **确定性**。同一个条目永远画出同一张图（配色由厂商 accent 与稳定哈希决定，
 *    不用随机数），所以它是可再生产物——可以随时删掉重新生成，也适合进 CI 对比。
 * 2. **SVG 而不是位图**。任意尺寸都不糊，首页缩略图和详情页大图共用同一份文件，
 *    一台机器的几百张图加起来不到一兆。
 * 3. **状态画在脸上，身份画在造型上**。造型只由厂商母题决定；
 *    「史上最聪明」「开源」「百万上下文」这些会变的状态走配饰层，
 *    数据一变重新生成即好看，不需要重画角色本身。
 */

export interface AvatarTraits {
  /** 综合智力排名，1 起；null 表示没有分数 */
  rank: number | null;
  /** 是否带推理模式 */
  reasoning: boolean;
  /** 是否吃图片输入 */
  vision: boolean;
  /** 是否支持工具调用 */
  toolCall: boolean;
  /** 是否开源权重 */
  openWeights: boolean;
  /** 上下文窗口（token） */
  contextWindow: number | null;
  /** 输入价格是否属于全场最便宜的那一档 */
  cheap: boolean;
  /** 是否可跳转购买的渠道数 ≥ 5，说明流通广 */
  widely: boolean;
}

export interface AvatarInput {
  slug: string;
  name: string;
  motif: MotifSpec;
  accent: string;
  traits: AvatarTraits;
}

const W = 120;
const H = 140;

// ---------- 颜色工具 ----------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** amt > 0 往白走，amt < 0 往黑走，范围 -1..1 */
function mix(hex: string, amt: number): string {
  const [r, g, b] = hexToRgb(hex);
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  const f = (c: number) => Math.round(c + (t - c) * p);
  return `#${[f(r), f(g), f(b)].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** 由 slug 稳定推导的小偏移，用来让同厂不同型号之间也有一点点差异。 */
function hashInt(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

// ---------- 绘制零件 ----------

const SKIN = '#ffe3cd';
const SKIN_SHADE = '#f5c8ad';
const INK = '#2b2a33';
const OUTLINE = '#3a3a46';

function ear(kind: string, color: string, dark: string, side: 'l' | 'r'): string {
  const dir = side === 'l' ? -1 : 1;
  const cx = 60 + dir * 26;
  // 射线是绕根部旋转的，根部必须比别的零件低一些，
  // 否则 40° 的旋转会把尖端顶出画布上沿（viewBox 从 0 开始，负数会被裁掉）。
  const cy = kind === 'ray' ? 38 : 30;
  const g = (body: string) => `<g transform="translate(${cx} ${cy})">${body}</g>`;
  switch (kind) {
    case 'fin':
      return g(`<path d="M0 6 C ${dir * 20} -2, ${dir * 22} 18, 0 20 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>`);
    case 'ray':
      return g(
        [0, 1, 2]
          .map((i) => {
            const a = (-40 + i * 40) * dir;
            return `<path d="M0 0 L ${dir * (16 + i * 5)} -${22 - i * 4} L ${dir * 9} 2 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round" transform="rotate(${a})"/>`;
          })
          .join(''),
      );
    case 'crystal':
      return g(`<path d="M0 -4 L ${dir * 11} -20 L ${dir * 19} -2 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>`);
    case 'puff':
      return g(`<circle cx="${dir * 14}" cy="-4" r="10" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/>`);
    case 'horn':
      return g(`<path d="M0 2 C ${dir * 4} -12, ${dir * 16} -18, ${dir * 22} -24 C ${dir * 14} -10, ${dir * 10} 2, 0 8 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>`);
    case 'leaf':
      return g(`<path d="M0 4 C ${dir * 8} -14, ${dir * 22} -18, ${dir * 24} -8 C ${dir * 22} 4, ${dir * 8} 8, 0 8 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>`);
    case 'crescent':
      return g(`<path d="M ${dir * 4} -18 A 13 13 0 1 0 ${dir * 4} 8 A 9 9 0 1 1 ${dir * 4} -18 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>`);
    case 'prism':
      return g(`<path d="M0 -20 L ${dir * 13} -5 L 0 6 L ${dir * -13} -5 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`);
    case 'antenna':
      return g(`<line x1="0" y1="4" x2="${dir * 8}" y2="-18" stroke="${OUTLINE}" stroke-width="2.6" stroke-linecap="round"/><circle cx="${dir * 9}" cy="-21" r="5.4" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2"/>`);
    case 'cat':
      return g(`<path d="M ${dir * 2} 6 L ${dir * 6} -20 L ${dir * 22} -2 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>`);
    case 'bear':
      return g(`<circle cx="${dir * 15}" cy="-8" r="9.5" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/><circle cx="${dir * 15}" cy="-8" r="4.4" fill="${SKIN}" opacity="0.85"/>`);
    case 'drop':
      return g(`<path d="M0 -20 C ${dir * 12} -6, ${dir * 12} 4, 0 4 C ${dir * -12} 4, ${dir * -12} -6, 0 -20 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`);
    case 'feather':
      return g(`<path d="M0 4 C ${dir * 10} -10, ${dir * 26} -14, ${dir * 20} -2 C ${dir * 14} 6, ${dir * 6} 8, 0 8 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/><line x1="0" y1="6" x2="${dir * 18}" y2="-4" stroke="${OUTLINE}" stroke-width="1.6"/>`);
    case 'flame':
      return g(`<path d="M0 6 C ${dir * 12} -4, ${dir * 4} -12, ${dir * 12} -22 C ${dir * 16} -8, ${dir * 18} 4, 0 8 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`);
    case 'coral':
      return g(
        [0, 1, 2]
          .map((i) => `<line x1="${dir * (4 + i * 4)}" y1="6" x2="${dir * (4 + i * 7)}" y2="${-14 - i * 3}" stroke="${dark}" stroke-width="5" stroke-linecap="round"/>`)
          .join(''),
      );
    case 'engine':
      return g(`<rect x="${dir * 2}" y="-18" width="${dir * 20}" height="20" rx="5" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/>`);
    case 'wave':
      return g(`<path d="M0 6 C ${dir * 10} -2, ${dir * 18} -2, ${dir * 22} -10 C ${dir * 20} 6, ${dir * 12} 12, 0 10 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`);
    default:
      return '';
  }
}

function hat(kind: string, color: string, dark: string): string {
  switch (kind) {
    case 'sun':
      return `<g transform="translate(60 26)">${[0, 45, 90, 135, 180, 225, 270, 315]
        .map((a) => `<rect x="-1.8" y="-24" width="3.6" height="8" rx="1.8" fill="${dark}" transform="rotate(${a})"/>`)
        .join('')}<circle r="11" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/></g>`;
    case 'lantern':
      return `<g transform="translate(60 18)"><line x1="0" y1="-12" x2="0" y2="-4" stroke="${OUTLINE}" stroke-width="2"/><ellipse rx="9" ry="10" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/><ellipse rx="4" ry="10" fill="${mix(color, 0.5)}" opacity="0.8"/></g>`;
    case 'ring':
      return `<ellipse cx="60" cy="16" rx="24" ry="7" fill="none" stroke="${dark}" stroke-width="3.4" opacity="0.9"/>`;
    case 'visor':
      return `<path d="M30 42 Q60 26 90 42 L88 49 Q60 38 32 49 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round" opacity="0.95"/>`;
    case 'crown':
      return `<path d="M40 18 L46 4 L54 16 L60 0 L66 16 L74 4 L80 18 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`;
    case 'helmet':
      // 只盖住额头。画成整顶头盔会压住眼睛，Q 版形象里眼睛比考据重要。
      return `<path d="M28 46 A33 30 0 0 1 92 46 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/><line x1="30" y1="46" x2="90" y2="46" stroke="${OUTLINE}" stroke-width="2.2"/>`;
    case 'hood':
      return `<path d="M24 62 A36 36 0 0 1 96 62 L96 50 A36 30 0 0 0 24 50 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.6" stroke-linejoin="round"/><ellipse cx="60" cy="54" rx="26" ry="20" fill="#1b1b25" opacity="0.4"/>`;
    case 'goggles':
      // 镜片坐在额头上（y 34–48），不能盖住 cy=58 的眼睛
      return `<g opacity="0.95"><rect x="30" y="34" width="24" height="14" rx="6" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3"/><rect x="66" y="34" width="24" height="14" rx="6" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3"/><line x1="54" y1="41" x2="66" y2="41" stroke="${OUTLINE}" stroke-width="2.3"/></g>`;
    case 'staircase':
      return `<path d="M34 26 L34 18 L46 18 L46 12 L58 12 L58 6 L78 6 L78 26 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`;
    case 'arch':
      return `<path d="M36 44 L36 20 A24 22 0 0 1 84 20 L84 44 L74 44 L74 22 A14 13 0 0 0 46 22 L46 44 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/>`;
    case 'gate':
      return `<g transform="translate(60 22)"><rect x="-24" y="-8" width="6" height="20" rx="2" fill="${color}" stroke="${OUTLINE}" stroke-width="2"/><rect x="18" y="-8" width="6" height="20" rx="2" fill="${color}" stroke="${OUTLINE}" stroke-width="2"/><path d="M-24 -8 A24 16 0 0 1 24 -8" fill="none" stroke="${OUTLINE}" stroke-width="3"/></g>`;
    default:
      return '';
  }
}

function pet(kind: string, color: string, dark: string): string {
  const t = `<g transform="translate(98 112)">`;
  switch (kind) {
    case 'whale':
      return `${t}<ellipse rx="14" ry="9.5" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/><path d="M-13 -1 C-19 -8 -19 6 -13 3 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2"/><circle cx="5" cy="-2" r="1.7" fill="${INK}"/><path d="M-2 -8 q3 -5 6 -1" fill="none" stroke="${dark}" stroke-width="2" stroke-linecap="round"/></g>`;
    case 'cloud':
      return `${t}<path d="M-14 4 a8 8 0 0 1 2 -15 a10 10 0 0 1 19 -2 a7 7 0 0 1 5 17 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/></g>`;
    case 'star':
      return `${t}<path d="M0 -12 L4 -3 L13 -3 L6 3 L8 12 L0 7 L-8 12 L-6 3 L-13 -3 L-4 -3 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/></g>`;
    case 'chip':
      return `${t}<rect x="-11" y="-11" width="22" height="22" rx="4" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/>${[-6, 0, 6].map((y) => `<line x1="-16" y1="${y}" x2="-11" y2="${y}" stroke="${OUTLINE}" stroke-width="2"/><line x1="11" y1="${y}" x2="16" y2="${y}" stroke="${OUTLINE}" stroke-width="2"/>`).join('')}</g>`;
    case 'fish':
      return `${t}<ellipse rx="13" ry="8" fill="${color}" stroke="${OUTLINE}" stroke-width="2.4"/><path d="M12 0 L20 -7 L20 7 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/><circle cx="-5" cy="-2" r="1.7" fill="${INK}"/></g>`;
    case 'droplet':
      return `${t}<path d="M0 -13 C 9 -2, 9 8, 0 8 C -9 8, -9 -2, 0 -13 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/></g>`;
    case 'orbit':
      return `${t}<ellipse rx="15" ry="6" fill="none" stroke="${dark}" stroke-width="2.4" transform="rotate(-20)"/><circle r="5.5" fill="${color}" stroke="${OUTLINE}" stroke-width="2.2"/></g>`;
    case 'leaf':
      return `${t}<path d="M-10 8 C -12 -6, 2 -14, 12 -10 C 12 2, 0 10, -10 8 Z" fill="${color}" stroke="${OUTLINE}" stroke-width="2.3" stroke-linejoin="round"/><line x1="-8" y1="6" x2="9" y2="-8" stroke="${OUTLINE}" stroke-width="1.6"/></g>`;
    default:
      return '';
  }
}

/**
 * 会随数据改变的状态配饰。
 *
 * 分成两层是有原因的：光环要在**脑袋后面**（画在脸前面会变成一道横穿腮红的线），
 * 而胸前挂坠、腰间工具带要在**身体前面**。所以返回 back / front 两段。
 */
function traits(t: AvatarTraits, color: string, dark: string): { back: string; front: string } {
  const back: string[] = [];
  const out: string[] = [];

  // 推理模式：脑后一圈思考光环 + 两颗环绕光点
  if (t.reasoning) {
    back.push(
      `<circle cx="60" cy="54" r="45" fill="none" stroke="${dark}" stroke-width="2.2" opacity="0.38" stroke-dasharray="7 6"/>`,
      `<circle cx="60" cy="9" r="3.6" fill="${color}"/>`,
      `<circle cx="14" cy="72" r="2.8" fill="${color}" opacity="0.8"/>`,
      `<circle cx="106" cy="76" r="2.4" fill="${color}" opacity="0.65"/>`,
    );
  }
  // 视觉输入：胸前一枚镜头挂坠
  if (t.vision) {
    out.push(`<g transform="translate(42 92)"><circle r="6.6" fill="${mix(color, 0.55)}" stroke="${OUTLINE}" stroke-width="2.2"/><circle r="2.6" fill="${dark}"/></g>`);
  }
  // 工具调用：腰间一条工具带
  if (t.toolCall) {
    out.push(`<rect x="36" y="104" width="48" height="6" rx="3" fill="${dark}" opacity="0.85"/><rect x="52" y="102" width="7" height="10" rx="2" fill="${mix(color, 0.6)}" stroke="${OUTLINE}" stroke-width="1.6"/>`);
  }
  // 百万上下文：抱一卷长长的图轴
  if (t.contextWindow != null && t.contextWindow >= 1_000_000) {
    out.push(`<g transform="translate(88 100) rotate(12)"><rect x="-16" y="-5" width="32" height="10" rx="3" fill="#f7ecd8" stroke="${OUTLINE}" stroke-width="2"/><line x1="-10" y1="0" x2="10" y2="0" stroke="${OUTLINE}" stroke-width="1.4" opacity="0.6"/></g>`);
  }
  // 开源权重：一枚开着的锁
  if (t.openWeights) {
    out.push(`<g transform="translate(78 92)"><rect x="-5" y="-2" width="10" height="9" rx="2" fill="${mix(color, 0.6)}" stroke="${OUTLINE}" stroke-width="2"/><path d="M-3 -2 v-4 a3 3 0 0 1 6 0" fill="none" stroke="${OUTLINE}" stroke-width="2"/></g>`);
  }
  // 便宜（全场最低四分之一价位）：头顶飘一枚硬币。放在左侧腰部高度，
  // 避开耳朵与帽饰——放在头顶会跟母题零件抢位置。
  if (t.cheap) {
    out.push(`<g transform="translate(18 74)"><circle r="7" fill="#f6c445" stroke="${OUTLINE}" stroke-width="2.2"/><text y="3" font-size="8" text-anchor="middle" fill="${OUTLINE}" font-family="monospace">$</text></g>`);
  }
  // 流通广（≥5 个渠道有售）：身边绕一圈渠道光点
  if (t.widely) {
    out.push(`<circle cx="12" cy="98" r="3" fill="${color}" opacity="0.8"/><circle cx="108" cy="94" r="3" fill="${color}" opacity="0.8"/><circle cx="6" cy="116" r="2.4" fill="${color}" opacity="0.55"/>`);
  }
  return { back: back.join(''), front: out.join('') };
}

/** 皇冠：只给 ECI 前三名。数据一变，下次生成当场换人。 */
function crown(rank: number | null): string {
  if (rank == null || rank > 3) return '';
  const gold = ['#f7c948', '#d8dee9', '#e0a06a'][rank - 1];
  return `<g transform="translate(0 2)"><path d="M40 18 L46 4 L54 16 L60 0 L66 16 L74 4 L80 18 Z" fill="${gold}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/><circle cx="60" cy="2" r="2.6" fill="#fff" opacity="0.9"/></g>`;
}

// ---------- 主绘制 ----------

export function drawAvatar(input: AvatarInput): string {
  const { accent, motif, traits: tr, slug, name } = input;
  // 主色要夹在可着色的区间里：
  //   太亮（接近白）→ 往深走，否则整张图糊成一片；
  //   太暗（接近黑）→ 往浅走，否则调出来的身体是脏灰色，看不出品牌色。
  const lum = luminance(accent);
  const accentSafe = lum > 0.86 ? mix(accent, -0.45) : lum < 0.16 ? mix(accent, 0.5) : accent;
  const tint = mix(accentSafe, 0.74);
  const mid = mix(accentSafe, 0.28);
  const dark = mix(accentSafe, -0.3);
  const h = hashInt(slug);
  // 由哈希决定的小差异：刘海偏向、腮红位置，让同厂不同型号也有个体感
  const bangShift = (h % 7) - 3;
  const blink = (h >> 3) % 2 === 0;

  const eyes = blink
    ? `<ellipse cx="48" cy="58" rx="6.4" ry="7.6" fill="${INK}"/><ellipse cx="72" cy="58" rx="6.4" ry="7.6" fill="${INK}"/>
       <circle cx="50.4" cy="55" r="2.3" fill="#fff"/><circle cx="74.4" cy="55" r="2.3" fill="#fff"/>`
    : `<ellipse cx="48" cy="58" rx="6.6" ry="8" fill="${INK}"/><ellipse cx="72" cy="58" rx="6.6" ry="8" fill="${INK}"/>
       <circle cx="50.6" cy="54.6" r="2.6" fill="#fff"/><circle cx="74.6" cy="54.6" r="2.6" fill="#fff"/>`;

  const mouth =
    (h >> 5) % 3 === 0
      ? `<path d="M54 72 q6 6 12 0" fill="none" stroke="${OUTLINE}" stroke-width="2.4" stroke-linecap="round"/>`
      : `<path d="M56 72 q4 4 8 0" fill="none" stroke="${OUTLINE}" stroke-width="2.4" stroke-linecap="round"/>`;

  const faceExtra =
    motif.face === 'spark'
      ? `<path d="M28 40 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2 Z" fill="${dark}" opacity="0.75"/>`
      : '';

  const layers = traits(tr, accentSafe, dark);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escapeXml(name)} 的 Q 版形象">
<title>${escapeXml(name)}</title>
<g>
  ${pet(motif.pet ?? 'none', tint, mid)}
  ${layers.back}
  <ellipse cx="60" cy="130" rx="32" ry="6.5" fill="#000" opacity="0.12"/>
  <rect x="48" y="112" width="9" height="16" rx="4.5" fill="${mid}" stroke="${OUTLINE}" stroke-width="2.2"/>
  <rect x="63" y="112" width="9" height="16" rx="4.5" fill="${mid}" stroke="${OUTLINE}" stroke-width="2.2"/>
  <rect x="44" y="122" width="14" height="9" rx="4" fill="${dark}" stroke="${OUTLINE}" stroke-width="2.2"/>
  <rect x="62" y="122" width="14" height="9" rx="4" fill="${dark}" stroke="${OUTLINE}" stroke-width="2.2"/>
  <path d="M36 80 q24 -8 48 0 l5 34 q-29 9 -58 0 Z" fill="${tint}" stroke="${OUTLINE}" stroke-width="2.6" stroke-linejoin="round"/>
  <rect x="24" y="84" width="10" height="26" rx="5" fill="${mid}" stroke="${OUTLINE}" stroke-width="2.4"/>
  <rect x="86" y="84" width="10" height="26" rx="5" fill="${mid}" stroke="${OUTLINE}" stroke-width="2.4"/>
  <path d="M44 79 q16 7 32 0 l-2 7 q-14 6 -28 0 Z" fill="${accentSafe}" stroke="${OUTLINE}" stroke-width="2.2" stroke-linejoin="round"/>
  ${ear(motif.ears, tint, mid, 'l')}
  ${ear(motif.ears, tint, mid, 'r')}
  <circle cx="60" cy="52" r="33" fill="${SKIN}" stroke="${OUTLINE}" stroke-width="2.8"/>
  <path d="M27 50 a33 33 0 0 1 66 0 q-14 -14 -33 -12 q-19 2 -33 12 Z" fill="${mix(accentSafe, 0.45)}" stroke="${OUTLINE}" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M${40 + bangShift} 24 q10 -8 20 -2 q-9 2 -20 2 Z" fill="${dark}" opacity="0.55"/>
  ${eyes}
  <ellipse cx="36" cy="66" rx="6" ry="3.6" fill="${accentSafe}" opacity="0.28"/>
  <ellipse cx="84" cy="66" rx="6" ry="3.6" fill="${accentSafe}" opacity="0.28"/>
  ${mouth}
  ${faceExtra}
  ${hat(motif.hat ?? 'none', tint, mid)}
  ${layers.front}
  ${crown(tr.rank)}
</g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c] as string));
}

export const AVATAR_SIZE = { width: W, height: H };
