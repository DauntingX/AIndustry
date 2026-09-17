import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, REPORT_PATH, SNAPSHOT_PATH } from './config.ts';
import { fetchModelsDev } from './sources/modelsdev.ts';
import { fetchEpoch } from './sources/epoch.ts';
import { fetchLiveBench } from './sources/livebench.ts';
import { buildSnapshot, readPrevious } from './merge.ts';
import { validate } from './validate.ts';

/**
 * 同步管线的入口。整条链路是：
 *
 *   抓取 → 归一化 → 按「厂商 + 规范名」合并 → 合理性闸门 → 原子写入
 *
 * 设计目标只有一句话：**上线之后不需要任何人管它**。
 * 上游挂掉、改字段、限流，网站都不会坏——最坏的情况是这一版不写入，
 * 页面继续显示上一版的好数据，同时开一条 issue 留痕。
 */
async function main() {
  const started = Date.now();
  console.log('▸ 开始同步上游数据');

  // 三个源并行抓取：它们互不依赖，串行只会白白拉长耗时
  const [modelsDev, epoch, livebench] = await Promise.all([
    fetchModelsDev(),
    fetchEpoch(),
    fetchLiveBench(),
  ]);

  console.log(`  models.dev  ${modelsDev.ok ? `✓ ${modelsDev.models.length} 款模型` : `✗ ${modelsDev.error}`}`);
  console.log(`  epoch.ai    ${epoch.ok ? `✓ ${epoch.entries.length} 条记录 / ${epoch.benchmarks.length} 个榜单` : `✗ ${epoch.error}`}`);
  console.log(`  livebench   ${livebench.ok ? `✓ release ${livebench.release} · ${livebench.entryCount} 款模型` : `✗ ${livebench.error}`}`);

  if (!modelsDev.ok) {
    // 骨架源彻底拿不到时直接退出：只有分数没有规格的快照对网站毫无价值
    fail('models.dev 是名册的骨架源，它失败时无法产出有意义的快照');
    return;
  }

  const previous = readPrevious();
  const { snapshot, report } = buildSnapshot(modelsDev, epoch, livebench, previous);

  console.log('\n▸ 合并结果');
  console.log(`  模型 ${snapshot.stats.models} 款（ECI ${snapshot.stats.withEci} · LiveBench ${snapshot.stats.withLivebench} · 有价 ${snapshot.stats.withPrice}）`);
  console.log(`  厂商 ${snapshot.vendors.length} 家 · 渠道 ${snapshot.stats.channels} 个 · 报价 ${snapshot.stats.offers} 条`);
  console.log(`  匹配：Epoch ${report.matched.epoch} 款 · LiveBench ${report.matched.livebench} 款 · 从 Epoch 补录 ${report.addedFromEpoch.length} 款`);

  const { accepted, failures, warnings } = validate(snapshot, previous);

  const fullReport = {
    generatedAt: snapshot.generatedAt,
    accepted,
    durationMs: Date.now() - started,
    counts: snapshot.stats,
    sources: snapshot.sources,
    livebenchRelease: snapshot.livebenchRelease,
    matching: report,
    failures,
    warnings,
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(fullReport, null, 2), 'utf8');

  if (!accepted) {
    console.error('\n✗ 合理性闸门拦截，拒绝写入快照，保留上一版：');
    for (const f of failures) console.error(`   - ${f}`);
    fail('闸门拦截');
    return;
  }

  if (warnings.length > 0) {
    console.log('\n⚠ 告警：');
    for (const w of warnings) console.log(`   - ${w}`);
  }

  // 原子写入：先写临时文件再 rename，避免构建进程读到写了一半的 JSON
  const tmp = path.join(DATA_DIR, '.snapshot.json.tmp');
  fs.writeFileSync(tmp, JSON.stringify(snapshot), 'utf8');
  fs.renameSync(tmp, SNAPSHOT_PATH);

  const size = (fs.statSync(SNAPSHOT_PATH).size / 1024).toFixed(0);
  console.log(`\n✓ 已写入 data/snapshot.json（${size} KB）· 耗时 ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

function fail(msg: string) {
  console.error(`\n✗ ${msg}`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('✗ 管线异常终止：', err);
  process.exitCode = 1;
});
