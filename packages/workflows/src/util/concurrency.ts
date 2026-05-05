// generic concurrency utilities
async function runConcurrent<T, R>({
  items,
  worker,
  concurrency,
}: {
  items: T[];
  worker: (item: T, index: number) => Promise<R>;
  concurrency: number;
}): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const current = nextIndex++;
      if (current >= items.length) break;

      try {
        results[current] = await worker(items[current], current);
      } catch (err) {
        // let worker decide how to encode errors
        throw err;
      }
    }
  }

  const workers = Array.from({ length: concurrency }, runWorker);
  await Promise.all(workers);

  return results;
}
