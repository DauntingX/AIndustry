/**
 * 跨源模型匹配。
 *
 * 三个上游对同一款模型的写法各不相同，而且**每年都在变**：
 * Epoch 会把 `qwen3.8-max-0902_xhigh` 写成一条独立记录，LiveBench 把评测配置
 * 拼进模型名（`claude-opus-4-7-xhigh-effort`），models.dev 用干净的 id。
 *
 * 匹配策略是「逐级放宽」而不是一步到位，且**只在候选唯一时才认**：
 * 合错了会让两款模型的价格和分数串在一起，比多出一条漏匹配的记录严重得多。
 */

/** 逐级放宽候选键：从最严格到最宽松，第一个命中就用。 */
export function loosenKeys(key: string): string[] {
  const out: string[] = [key];
  let cur = key;
  // 去掉尾部的纯数字段（日期戳 0902 / 260428）最多两级
  for (let i = 0; i < 2; i += 1) {
    const next = cur.replace(/[-.]\d{2,4}$/, '');
    if (next === cur || next.length < 3) break;
    cur = next;
    out.push(cur);
  }
  // 再去掉尾部的短数字版本段（-3.1 → -3），只在长度足够时才做
  const noMinor = cur.replace(/\.\d+$/, '');
  if (noMinor !== cur && noMinor.length >= 4) out.push(noMinor);
  return out;
}

export class MatchIndex<T> {
  private readonly map = new Map<string, T[]>();

  /**
   * 除了键本身，**还把放宽后的形式一并登记为索引键**。
   *
   * 这一步是双向匹配的关键：只放宽被查的键时，
   * 名册里的 `deepseek-v4-pro` 永远查不到 Epoch 的 `deepseek-v4-pro-0813`，
   * 于是同一款模型会同时以「有分数没价格」和「有价格没分数」两条记录出现在站上。
   * 反向也登记之后，两边任意一侧带日期后缀都能合到一起。
   */
  add(key: string, value: T) {
    if (!key) return;
    for (const k of loosenKeys(key)) {
      const list = this.map.get(k);
      if (list) {
        if (!list.includes(value)) list.push(value);
      } else {
        this.map.set(k, [value]);
      }
    }
  }

  /** 逐级放宽查找。返回候选数组（可能为空、可能多个）。 */
  lookup(key: string): T[] {
    for (const candidate of loosenKeys(key)) {
      const hit = this.map.get(candidate);
      if (hit && hit.length > 0) return hit;
    }
    return [];
  }

  /** 只在候选唯一时返回，否则返回 null（宁可漏，不可错合）。 */
  unique(key: string): T | null {
    const hits = this.lookup(key);
    return hits.length === 1 ? hits[0] : null;
  }

  get size() {
    return this.map.size;
  }

  keys(): string[] {
    return [...this.map.keys()];
  }
}

/** 统计匹配情况，用于同步报告——静默的漏匹配比报错更危险。 */
export function matchStats(total: number, matched: number) {
  return { total, matched, missed: total - matched, rate: total === 0 ? 1 : matched / total };
}
