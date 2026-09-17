import { SANITY } from './config.ts';
import type { Snapshot } from '../../src/lib/types.ts';

export interface ValidationResult {
  accepted: boolean;
  failures: string[];
  warnings: string[];
}

/**
 * 合理性闸门。
 *
 * 这道闸门的存在理由是：**上游改字段是静默的**。
 * 真实的失效模式不是报错，而是「解析器一条都没接到，覆盖率从 38% 变成 0%，
 * 页面照常渲染，只是所有排名都错了」。
 * 所以这里查的不是异常，是**形状**：总数、覆盖率、承重指标有没有突然塌掉。
 *
 * 不通过时不写入快照，上一版原封不动地保留，并以非零退出码结束——
 * 这样 GitHub Actions 会失败，失败会开 issue，「零维护」承诺失效时留下看得见的痕迹。
 */
export function validate(next: Snapshot, previous: Snapshot | null): ValidationResult {
  const failures: string[] = [];
  const warnings: string[] = [];

  // 1. 绝对底线：名册太小说明骨架源整个没拿到
  if (next.stats.models < 20) {
    failures.push(`模型总数只有 ${next.stats.models}，低于 20 的下限，骨架源多半整个失败了`);
  }
  if (next.stats.withEci === 0) {
    failures.push('没有任何模型拿到 ECI 分数——它是全站排名的唯一依据，拿不到就不能发布');
  }

  if (previous) {
    // 2. 总数骤降
    const drop = 1 - next.stats.models / Math.max(1, previous.stats.models);
    if (drop > SANITY.maxModelCountDropRatio) {
      failures.push(
        `模型总数从 ${previous.stats.models} 跌到 ${next.stats.models}（-${(drop * 100).toFixed(1)}%），超过 ${
          SANITY.maxModelCountDropRatio * 100
        }% 的阈值`,
      );
    }
    // 3. 承重指标：ECI 覆盖率相对跌掉一半以上就拦下
    const prevCoverage = previous.stats.withEci / Math.max(1, previous.stats.models);
    const nextCoverage = next.stats.withEci / Math.max(1, next.stats.models);
    if (prevCoverage > 0.1) {
      const rel = 1 - nextCoverage / prevCoverage;
      if (rel > SANITY.maxEciCoverageRelativeDrop) {
        failures.push(
          `ECI 覆盖率相对上一版跌了 ${(rel * 100).toFixed(0)}%（${(prevCoverage * 100).toFixed(1)}% → ${(
            nextCoverage * 100
          ).toFixed(1)}%），超过 50% 的阈值`,
        );
      }
    }
    // 4. 官方价格整批消失
    const prevPriced = previous.stats.withPrice / Math.max(1, previous.stats.models);
    const nextPriced = next.stats.withPrice / Math.max(1, next.stats.models);
    if (prevPriced > 0.3 && nextPriced < prevPriced * 0.5) {
      failures.push(`有价格的比例从 ${(prevPriced * 100).toFixed(0)}% 掉到 ${(nextPriced * 100).toFixed(0)}%，价格源多半改字段了`);
    }
  }

  // 5. 逐条记录的硬约束：价格不能为负，日期必须是合法的 ISO 日期
  let badPrice = 0;
  let badDate = 0;
  for (const m of next.models) {
    for (const v of [m.pricing.input, m.pricing.output, m.pricing.cacheRead]) {
      if (v != null && v < 0) badPrice += 1;
    }
    if (m.releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(m.releaseDate)) badDate += 1;
    for (const o of m.offers) {
      if (o.input != null && o.input < 0) badPrice += 1;
      if (o.output != null && o.output < 0) badPrice += 1;
    }
  }
  if (badPrice > 0) failures.push(`发现 ${badPrice} 处负数价格`);
  if (badDate > 0) warnings.push(`${badDate} 条记录的发布日期格式不合法，已按 null 处理`);

  // 6. slug 冲突是 URL 层面的硬错误
  const slugs = new Set<string>();
  let dup = 0;
  for (const m of next.models) {
    if (slugs.has(m.slug)) dup += 1;
    slugs.add(m.slug);
  }
  if (dup > 0) failures.push(`有 ${dup} 个重复的 slug，会导致两个模型抢同一个页面`);

  // 7. 覆盖率告警（不拦）
  const coverage = (k: keyof typeof next.stats) => (next.stats[k] as number) / Math.max(1, next.stats.models);
  const lbEntries = next.stats.livebenchEntries;
  const lbRate = lbEntries > 0 ? next.stats.withLivebench / lbEntries : 0;
  if (lbEntries > 0 && lbRate < 0.6) {
    warnings.push(`LiveBench 本期 ${lbEntries} 款模型里只挂上了 ${next.stats.withLivebench} 款，匹配率 ${(lbRate * 100).toFixed(0)}%，多半是上游改了模型命名`);
  }
  if (next.stats.withLivebench === 0 && previous && previous.stats.withLivebench > 0) {
    warnings.push('LiveBench 一款都没挂上，上游可能改版或临时不可用');
  }
  if (coverage('withPrice') < 0.4) warnings.push('有官方价格的比例低于 40%，价格页会比较空');

  return { accepted: failures.length === 0, failures, warnings };
}
