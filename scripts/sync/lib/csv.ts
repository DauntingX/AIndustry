/**
 * 一个恰好够用的 RFC 4180 CSV 解析器。
 *
 * Epoch 与 LiveBench 的表里都有带引号、带内嵌逗号的字段（榜单名里就有逗号），
 * 直接按逗号 split 会在某一天悄悄地把一列切成两列。这三十行是廉价的保险。
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  // 去掉 BOM，否则第一列列名会变成 "\uFEFFmodel"
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\r') {
      i += 1;
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

export interface CsvTable {
  columns: string[];
  rows: Record<string, string>[];
}

/** 把 CSV 转成「列名 → 值」的对象数组，列名做 trim，空表头列丢弃。 */
export function toTable(text: string): CsvTable {
  const grid = parseCsv(text);
  if (grid.length === 0) return { columns: [], rows: [] };
  const columns = grid[0].map((c) => c.trim());
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < grid.length; i += 1) {
    const cells = grid[i];
    const rec: Record<string, string> = {};
    let any = false;
    for (let c = 0; c < columns.length; c += 1) {
      const key = columns[c];
      if (!key) continue;
      const v = (cells[c] ?? '').trim();
      if (v !== '') any = true;
      rec[key] = v;
    }
    if (any) rows.push(rec);
  }
  return { columns, rows };
}

/** 宽松的数值解析：识别 ""、"-"、"N/A"、"<0.001" 这类非数值写法。 */
export function num(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === '' || s === '-' || s === 'N/A' || s === 'n/a' || s.toLowerCase() === 'null') return null;
  const m = s.match(/^-?\d+(\.\d+)?([eE][-+]?\d+)?/);
  if (!m) return null;
  const v = Number(m[0]);
  return Number.isFinite(v) ? v : null;
}
