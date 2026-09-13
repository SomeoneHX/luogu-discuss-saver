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
