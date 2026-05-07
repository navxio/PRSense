// self implemented concurrency function
export async function runConcurrent<T, R>({
  items,
  concurrency,
  worker,
}: {
  items: T[];
  concurrency: number;
  worker: (item: T) => Promise<R>;
}): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = new Array(items.length);

  let next = 0;

  async function runner() {
    while (true) {
      const current = next++;

      if (current >= items.length) {
        break;
      }

      const item = items[current];
      if (item === undefined) break;

      results[current] = await worker(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner()),
  );

  return results;
}
