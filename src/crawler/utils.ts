/** 按 key 去重，保留首次出现项。 */
export function deduplicate<T, K extends string | number>(
  items: T[],
  key: (item: T) => K,
): T[] {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/**
 * D1 单查询绑定参数上限为 100：多行插入必须按「每行列数」切分。
 * （曾因 UserSnapshot 一次插 17 行 × 13 列 = 221 参数导致抓取整批失败。）
 */
export function chunkRows<T extends Record<string, unknown>>(
  rows: T[],
  limit = 90,
): T[][] {
  if (!rows.length) return [];
  const columns = Math.max(1, Object.keys(rows[0] ?? {}).length);
  const size = Math.max(1, Math.floor(limit / columns));
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}
