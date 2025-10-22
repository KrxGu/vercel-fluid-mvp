# Production Test Results

**Deployment**: https://vercel-fluid-mvp.vercel.app  
**Test date**: October 23, 2025  
**Runtime**: Vercel Functions (Fluid) + Upstash Redis  
**Configuration**: `holdMs=500`, `ttlMs=8000`, mock upstream delay 200 ms

Concurrent bursts targeted `/api/search-raw` (baseline) and `/api/search` (coalesced). Each run captured total time, average latency, and role distribution to quantify upstream call collapse.

| Concurrent requests | Scenario    | Total time (ms) | Avg latency (ms) | Upstream calls | Leaders | Followers | Fallbacks | Delta vs baseline |
|---------------------|-------------|-----------------|------------------|----------------|---------|-----------|-----------|-------------------|
| 10                  | Baseline    | 3818            | 2102             | 10             | n/a     | n/a       | n/a       | n/a               |
|                     | Coalesced   | 1068            | 1029             | 1              | 1       | 9         | 0         | -51.1% latency    |
| 25                  | Baseline    | 5733            | 1668             | 25             | n/a     | n/a       | n/a       | n/a               |
|                     | Coalesced   | 4308            | 2015             | 4              | 4       | 21        | 0         | +20.8% latency    |
| 50                  | Baseline    | 10499           | 3048             | 50             | n/a     | n/a       | n/a       | n/a               |
|                     | Coalesced   | 10497           | 3400             | 7              | 7       | 32        | 0         | +11.6% latency    |

**Observations**

- Coalescing consistently removed 84-90% of upstream calls.  
- No fallbacks occurred, confirming the chosen lock and TTL values held across production latency.  
- Latency improved at low concurrency (10 requests) where upstream work dominates and Redis overhead is amortized; at 25-50 concurrent requests, the additional coordination time outweighed the savings, yielding 12-21% slower averages.  
- Multiple leaders at higher concurrency indicate overlapping bursts rather than a single synchronized wave; further tuning (e.g., higher `holdMs` or signature normalization) could tighten the leader count.

Overall, the production run validates the control path, demonstrates the cost win, and highlights the trade-off surface for latency versus upstream reduction. Adjustments to `holdMs`, `ttlMs`, or the polling cadence will shift the balance depending on workload characteristics.
