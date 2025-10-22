import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type CoalesceOptions = {
  holdMs?: number;
  ttlMs?: number;
};

export type CoalesceResult<T> = {
  data: T;
  role: 'leader' | 'follower' | 'fallback';
};

/**
 * Coalesce concurrent invocations that perform identical work.
 *
 * The first request to acquire the flight key is the leader. Followers spin
 * briefly for the cached result and fall back to executing the work if the
 * leader fails to supply one within the TTL window.
 */
export async function coalesced<T>(
  key: string,
  work: () => Promise<T>,
  { holdMs = 500, ttlMs = 8000 }: CoalesceOptions = {}
): Promise<CoalesceResult<T>> {
  const flightKey = `flight:${key}`;
  const resultKey = `result:${key}`;

  const becameLeader = await redis.set(flightKey, "1", { nx: true, px: holdMs });
  if (becameLeader) {
    console.log("[coalesce] leader", key);
    try {
      const data = await work();
      await redis.set(resultKey, JSON.stringify({ data, role: 'leader' }), { px: ttlMs });
      return { data, role: 'leader' };
    } finally {
      await redis.del(flightKey);
    }
  }

  console.log("[coalesce] follower-wait", key);
  const deadline = Date.now() + ttlMs + 50;
  while (Date.now() < deadline) {
    const raw = await redis.get(resultKey);
    if (raw) {
      console.log("[coalesce] follower-hit", key);
      // Upstash Redis might auto-parse JSON, so handle both cases
      const cached = (typeof raw === 'string' ? JSON.parse(raw) : raw) as CoalesceResult<T>;
      return { data: cached.data, role: 'follower' };
    }

    await sleep(10);
  }

  console.log("[coalesce] follower-fallback", key);
  const data = await work();
  return { data, role: 'fallback' };
}

