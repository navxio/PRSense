type DeliveryEntry = {
  id: string;
  timestamp: number;
};

export function createDeliveryRegistry(ttlMs = 60 * 60 * 1000) {
  const deliveries = new Map<string, DeliveryEntry>();

  function cleanup() {
    const now = Date.now();
    for (const [key, entry] of deliveries) {
      if (now - entry.timestamp > ttlMs) {
        deliveries.delete(key);
      }
    }
  }

  return {
    has(id: string): boolean {
      cleanup();
      return deliveries.has(id);
    },

    register(id: string): void {
      deliveries.set(id, {
        id,
        timestamp: Date.now(),
      });
    },
  };
}
