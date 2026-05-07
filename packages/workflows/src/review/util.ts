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
  const results: R[] = new Array(items.length);

  let next = 0;

  async function runner() {
    while (true) {
      const current = next++;

      if (current >= items.length) {
        break;
      }

      results[current] = await worker(items[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => runner()),
  );

  return results;
}
