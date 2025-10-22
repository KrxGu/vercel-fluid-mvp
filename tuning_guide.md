# Tuning Guide

Request coalescing relies on two time-based parameters. Adjust them per workload to balance latency, follower hit rate, and upstream cost.

## Parameters

| Parameter | Definition | Guidance |
|-----------|------------|----------|
| `holdMs`  | Duration of the Redis lock granted to the leader | Set above the typical upstream latency. If followers promote to leader too often, increase this value. |
| `ttlMs`   | Cache lifetime and follower wait window | Keep at least 10x `holdMs`. Raise it when followers time out and fall back to work themselves. |

Both values can be overridden via `x-hold-ms` and `x-ttl-ms` headers or environment variables (`HOLD_MS`, `TTL_MS`).

## Recommended Defaults

| Environment        | `holdMs` | `ttlMs` |
|--------------------|----------|---------|
| Local development  | 500-1000 ms | 8000-15000 ms |
| Vercel production  | 100-300 ms  | 5000-8000 ms  |
| Slow upstream (>=500 ms) | 1500-2000 ms | 12000-18000 ms |

## Reading Test Output

- **Leader count**: Target one per burst. Multiple leaders indicate `holdMs` is too low or requests are not sharing the same cache key.
- **Follower hit rate**: Aim for >=85%. Lower values suggest the cache is expiring too quickly (`ttlMs` too low) or Redis latency is high.
- **Fallback rate**: Keep below 10%. Persistent fallbacks usually mean the leader cannot complete work before the TTL expires.

## Troubleshooting

| Symptom | Likely Cause | Adjustment |
|---------|--------------|------------|
| Many leaders per burst | Lock expires before work finishes | Increase `holdMs` |
| Followers fall back often | Cached result missing when polled | Increase `ttlMs`, confirm Redis latency |
| High overall latency | Local dev or free-tier Redis overhead | Test with production deployment; shorten poll interval only if Redis latency is stable |
| Cache misses for similar requests | Signature mismatch | Ensure query normalization before hashing |

Use `scripts/optimized-test.js` to run staged workloads (10, 25, and 20 requests with custom headers) and observe the role distribution before and after tuning.
