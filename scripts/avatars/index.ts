import fs from 'node:fs';
import path from 'node:path';
import { ROOT, SNAPSHOT_PATH } from '../sync/config.ts';
import { motifOf } from './motifs.ts';
import { drawAvatar, AVATAR_SIZE, type AvatarTraits } from './draw.ts';
import { vendorProfile } from '../../src/content/vendors.ts';
import { AVATAR_OVERRIDES } from '../../src/content/avatar-overrides.ts';
import type { Snapshot, ModelRecord } from '../../src/lib/types.ts';

/**
 * 由快照确定性生成全站 Q 版形象。
 *
 * 产物不进仓库，理由和精灵图一样：它可再生产。
 * 素材（data/snapshot.json + 厂商母题表 + 绘制逻辑）都在仓库里，
 * 图形由构建时的 prebuild 钩子现画。好处是**产物必然与数据一致**——
 * 排名一变，皇冠当场换人，不会出现「页面数据更新了但形象还是上一版」的脱节。
 */

const OUT_DIR = path.join(ROOT, 'public', 'avatars');

function readSnapshot(): Snapshot {
  if (!fs.existsSync(SNAPSHOT_PATH)) {
    throw new Error('data/snapshot.json 不存在，请先跑 npm run sync');
  }
  return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8')) as Snapshot;
}

/** 算出每个模型该带哪些状态配饰。规则都在数据里，没有人工判断。 */
function deriveTraits(snapshot: Snapshot): Map<string, AvatarTraits> {
  const scored = snapshot.models
    .filter((m) => m.epoch?.eci != null)
    .sort((a, b) => (b.epoch!.eci ?? 0) - (a.epoch!.eci ?? 0));
  const rankOf = new Map<string, number>();
  scored.forEach((m, i) => rankOf.set(m.key, i + 1));

  // 「便宜」取全场有价模型里输入价最低的 25%，用分位而不是绝对阈值——
  // 价格整体在往下降，写死一个美元数两年后就会全部顶格。
  const priced = snapshot.models
    .map((m) => m.pricing.input)
    .filter((v): v is number => v != null && v > 0)
    .sort((a, b) => a - b);
  const cheapCut = priced.length > 0 ? priced[Math.floor(priced.length * 0.25)] : 0;

  const out = new Map<string, AvatarTraits>();
  for (const m of snapshot.models) {
    out.set(m.key, {
      rank: rankOf.get(m.key) ?? null,
      reasoning: m.capabilities.reasoning === true || (m.epoch?.eci ?? 0) > 0 && /reason|thinking|o3|o4|r1/i.test(m.name),
      vision: m.modalities.input.includes('image'),
      toolCall: m.capabilities.toolCall === true,
      openWeights: m.openWeights === true,
      contextWindow: m.contextWindow,
      cheap: m.pricing.input != null && m.pricing.input > 0 && m.pricing.input <= cheapCut,
      widely: m.channelCount >= 5,
    });
  }
  return out;
}

function main() {
  const snapshot = readSnapshot();
  const traitsByKey = deriveTraits(snapshot);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const manifest: Record<string, { file: string | null; override: string | null; motif: string; accent: string }> = {};
  let drawn = 0;
  let overridden = 0;

  for (const model of snapshot.models) {
    const vendor = vendorProfile(model.vendorId, model.vendorName);
    const override = AVATAR_OVERRIDES[model.key] ?? AVATAR_OVERRIDES[model.slug] ?? null;
    if (override) {
      // 有官方/授权的外链形象时优先用它。仓库存的是地址而不是图片本体，
      // 既避免把别人的美术资产搬进仓库，也让换图不需要改代码。
      overridden += 1;
      manifest[model.slug] = { file: null, override, motif: vendor.motif, accent: vendor.accent };
      continue;
    }
    const svg = drawAvatar({
      slug: model.slug,
      name: model.name,
      motif: motifOf(vendor.motif),
      accent: vendor.accent,
      traits: traitsByKey.get(model.key)!,
    });
    fs.writeFileSync(path.join(OUT_DIR, `${model.slug}.svg`), svg, 'utf8');
    manifest[model.slug] = { file: `/avatars/${model.slug}.svg`, override: null, motif: vendor.motif, accent: vendor.accent };
    drawn += 1;
  }

  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest), 'utf8');
  const bytes = fs
    .readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.svg'))
    .reduce((a, f) => a + fs.statSync(path.join(OUT_DIR, f)).size, 0);
  console.log(
    `✓ 生成 ${drawn} 张 Q 版形象（外链覆盖 ${overridden} 张）· ` +
      `${AVATAR_SIZE.width}×${AVATAR_SIZE.height} · 合计 ${(bytes / 1024).toFixed(0)} KB · 输出 public/avatars/`,
  );
}

main();
