import fs from 'node:fs';
import path from 'node:path';
import type { Snapshot } from './types.ts';

/**
 * 快照加载器。
 *
 * 前端**只读仓库里的静态快照**，运行时不请求任何上游、不持有任何密钥。
 * 上游挂掉时页面照常显示上一次的好数据，永远不会白屏——
 * 这是选择静态快照而不是运行时拉取的首要理由。
 */
let cached: Snapshot | null = null;

export function loadSnapshot(): Snapshot {
  if (cached) return cached;
  const file = path.join(process.cwd(), 'data', 'snapshot.json');
  if (!fs.existsSync(file)) {
    throw new Error('data/snapshot.json 不存在。请先运行 npm run sync 生成快照。');
  }
  cached = JSON.parse(fs.readFileSync(file, 'utf8')) as Snapshot;
  return cached;
}

export function tryLoadSnapshot(): Snapshot | null {
  try {
    return loadSnapshot();
  } catch {
    return null;
  }
}
