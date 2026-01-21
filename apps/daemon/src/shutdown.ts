// apps/daemon/src/shutdown.ts
export function setupGracefulShutdown(opts: {
  closeHttp: () => Promise<void>;
  onShutdown?: () => Promise<void>;
}) {
  async function shutdown(signal: string) {
    console.log(`Received ${signal}, shutting down...`);

    try {
      await opts.onShutdown?.();
      await opts.closeHttp();
    } finally {
      process.exit(0);
    }
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
