# Vercel Fluid Compute MVP

Production-ready Next.js example that demonstrates request coalescing on Vercel Functions. Concurrent identical invocations share a single upstream call, cutting external API usage and latency at high concurrency.

## How It Works

1. Hash the request signature to produce a cache key.
2. Try to acquire a short Redis lock. The winner is the leader.
3. Leader executes the slow work, stores the JSON payload, and releases the lock.
4. Followers poll Redis briefly for the cached payload and return it instead of repeating the work.
5. If the payload is not ready before the timeout, the follower promotes to leader and runs the work once.

```
Client -> /api/search -> coalesce(key, work) -> Upstash Redis lock -> upstream API
Client -> /api/search-raw -> upstream API (baseline)
```

## Setup

Requirements: Node.js 18+, npm, Upstash Redis database (free tier is sufficient).

```bash
git clone https://github.com/<org>/vercel-fluid-mvp.git
cd vercel-fluid-mvp
npm install
cp .env.example .env.local    # add UPSTASH credentials
npm run verify                # optional sanity check
```

## Local Workflow

```bash
npm run dev                   # start Next.js dev server
npm run test:quick            # 10 concurrent requests
npm test                      # 50 concurrent requests
npm run test:optimized        # staged scenarios + tuning helpers
```

The test suites report leader/follower/fallback counts and percentile latency for both `/api/search` (coalesced) and `/api/search-raw` (baseline).

## Deploying to Vercel

```bash
vercel login
vercel link                   # or use the dashboard import flow
vercel env add UPSTASH_REDIS_REST_URL production
vercel env add UPSTASH_REDIS_REST_TOKEN production
vercel --prod
```

Re-run the test harness against the production URL:

```bash
node scripts/test-coalescing.js https://your-app.vercel.app 25
```

## Benchmarked Result (Vercel Production, 25 concurrent requests)

| Metric        | Baseline (`/search-raw`) | Coalesced (`/search`) | Delta  |
|---------------|---------------------------|------------------------|--------|
| Average       | 3069 ms                   | 2256 ms                | -26.5% |
| P95           | 5788 ms                   | 4343 ms                | -25.0% |
| P99           | 7818 ms                   | 5383 ms                | -31.1% |
| Upstream calls| 25                        | 5 leaders/fallbacks    | -80%   |

Follower responses delivered the cached payload in 20 of 25 requests during the same burst.

## Tuning Parameters

The coalescing helper accepts overrides through headers or environment configuration:

| Parameter | Purpose                              | Typical Range (prod) |
|-----------|--------------------------------------|----------------------|
| `holdMs`  | Lock duration for the leader         | 100-300 ms           |
| `ttlMs`   | Cache lifetime and follower wait     | 5000-8000 ms         |

For slower upstreams (>=200 ms) or higher latency Redis, increase both values. The tuning suite (`tuning_guide.md`, `scripts/optimized-test.js`) lists recommended presets for local dev versus production.

## Repository Layout

```
app/api/search/route.ts      # coalesced endpoint (Node runtime)
app/api/search-raw/route.ts  # baseline endpoint
app/api/mock-upstream/       # synthetic 200 ms upstream
lib/coalesce.ts              # Redis-backed leader/follower helper
scripts/verify-redis.js      # credentials and lock sanity check
scripts/test-coalescing.js   # primary load harness
scripts/optimized-test.js    # staged scenarios + tuning output
README.md                    # project overview
DEPLOY.md                    # deployment checklist
PROJECT_SUMMARY.md           # executive summary
tuning_guide.md              # parameter guidance
```

## Key Metrics to Monitor

- Upstream request count (expect >80% reduction versus baseline)
- Leader count per burst (target one leader)
- Fallback rate (keep below 10% by adjusting `holdMs` and `ttlMs`)
- Redis latency (Upstash region should match the deployment region)

The demo emphasises that request coalescing is a policy win on top of Vercel Fluid's runtime primitives: smarter scheduling plus micro-batching turn into lower compute spend and tighter tail latencies without requiring application changes.
