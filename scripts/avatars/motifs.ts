/**
 * 形象母题：把厂商的品牌意象翻译成一组可绘制的五官/配饰零件。
 *
 * 为什么不给每家画一张定稿插画：站点要靠自动化跑下去，而**插画不可自动化**。
 * 全站有四百多款模型、二十多家厂商，还会持续增加；
 * 一旦形象是手绘的位图，每来一家新厂商就要有人画一张——零维护的承诺当场失效。
 *
 * 所以这里的做法是：母题**描述**，生成器**绘制**。
 * 加一家厂商只需要在这里加一行描述，图形由脚本确定性地画出来，
 * 同样的数据永远产出同样的形象，且任意分辨率都不糊。
 *
 * 配色由厂商档案的 accent 决定，形状由下面的零件组合决定。
 * 零件只有十八种耳朵、八种帽饰、六种小跟班，但组合出来的辨识度足够——
 * 戴月牙的月之暗面不会跟顶着鲸鱼鳍的 DeepSeek 认混。
 */

export type EarShape =
  | 'fin' | 'ray' | 'crystal' | 'puff' | 'horn' | 'leaf' | 'crescent' | 'prism'
  | 'antenna' | 'cat' | 'bear' | 'drop' | 'feather' | 'flame' | 'coral' | 'engine'
  | 'wave' | 'none';

export type HatShape =
  | 'sun' | 'lantern' | 'ring' | 'visor' | 'crown' | 'helmet' | 'hood'
  | 'goggles' | 'staircase' | 'arch' | 'gate' | 'none';

export type PetShape =
  | 'whale' | 'cloud' | 'star' | 'chip' | 'fish' | 'droplet' | 'orbit' | 'leaf' | 'none';

export interface MotifSpec {
  /** 中文名，用于无障碍描述 */
  label: string;
  ears: EarShape;
  hat?: HatShape;
  pet?: PetShape;
  /** 额外的面部细节 */
  face?: 'visor-line' | 'spark' | 'none';
}

export const MOTIFS: Record<string, MotifSpec> = {
  knot: { label: '绳结', ears: 'crystal', hat: 'ring', pet: 'orbit', face: 'spark' },
  sunburst: { label: '日轮', ears: 'ray', hat: 'sun', pet: 'star' },
  gem: { label: '宝石', ears: 'crystal', hat: 'ring', pet: 'star' },
  whale: { label: '鲸', ears: 'fin', pet: 'whale' },
  cloud: { label: '云', ears: 'puff', pet: 'cloud' },
  lantern: { label: '灯笼', ears: 'crystal', hat: 'lantern', pet: 'star' },
  moon: { label: '月牙', ears: 'crescent', pet: 'star' },
  prism: { label: '棱镜', ears: 'prism', hat: 'visor', pet: 'droplet' },
  spark: { label: '电火花', ears: 'antenna', pet: 'star', face: 'spark' },
  wave: { label: '潮汐', ears: 'wave', pet: 'fish' },
  bear: { label: '熊', ears: 'bear', pet: 'cloud' },
  staircase: { label: '阶梯', ears: 'crystal', hat: 'staircase', pet: 'star' },
  podium: { label: '讲台', ears: 'leaf', hat: 'gate', pet: 'leaf' },
  gate: { label: '门', ears: 'crystal', hat: 'gate', pet: 'leaf' },
  arch: { label: '拱门', ears: 'antenna', hat: 'arch', pet: 'chip' },
  antler: { label: '鹿角', ears: 'horn', pet: 'leaf' },
  cat: { label: '猫', ears: 'cat', pet: 'fish' },
  eye: { label: '慧眼', ears: 'leaf', hat: 'goggles', pet: 'star', face: 'spark' },
  comet: { label: '彗星', ears: 'flame', hat: 'helmet', pet: 'orbit' },
  infinity: { label: '无限', ears: 'puff', hat: 'ring', pet: 'orbit' },
  flame: { label: '火焰', ears: 'flame', pet: 'star' },
  coral: { label: '珊瑚', ears: 'coral', pet: 'fish' },
  pillar: { label: '石柱', ears: 'crystal', hat: 'arch', pet: 'none' },
  box: { label: '包裹', ears: 'puff', hat: 'crown', pet: 'chip' },
  window: { label: '窗', ears: 'crystal', hat: 'visor', pet: 'chip' },
  chip: { label: '芯片', ears: 'antenna', hat: 'visor', pet: 'chip' },
  blue: { label: '深蓝', ears: 'crystal', hat: 'goggles', pet: 'chip' },
  lanternfish: { label: '灯笼鱼', ears: 'fin', hat: 'lantern', pet: 'fish' },
  droplet: { label: '水滴', ears: 'drop', pet: 'droplet' },
  feather: { label: '羽毛', ears: 'feather', pet: 'none' },
  orbit: { label: '轨道', ears: 'antenna', hat: 'ring', pet: 'orbit' },
  waveform: { label: '声波', ears: 'wave', hat: 'visor', pet: 'none' },
  compass: { label: '罗盘', ears: 'crystal', hat: 'goggles', pet: 'star' },
  sail: { label: '帆', ears: 'leaf', hat: 'gate', pet: 'fish' },
  lotus: { label: '莲花', ears: 'leaf', hat: 'sun', pet: 'leaf' },
  lightning: { label: '闪电', ears: 'antenna', hat: 'visor', pet: 'star', face: 'spark' },
  school: { label: '鱼群', ears: 'fin', pet: 'fish' },
  wanderer: { label: '神秘旅人', ears: 'none', hat: 'hood', pet: 'none' },
};

export function motifOf(id: string): MotifSpec {
  return MOTIFS[id] ?? MOTIFS.wanderer;
}
