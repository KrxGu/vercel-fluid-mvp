# Deployment Guide

## Pre-deployment Checklist

- `lib/coalesce.ts` locks and releases correctly under load.
- `/api/search` and `/api/search-raw` return expected payloads locally.
- `.env.local` contains working Upstash credentials (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`).
- `npm run verify` passes and clears the flight keys.
- Test harness reports an acceptable fallback rate (<10%) on your target workload.

## Deploying to Vercel

1. Push the repository to GitHub or another Git provider.
2. Import the project on [vercel.com/new](https://vercel.com/new) and select the Next.js preset.
3. Add environment variables in Project Settings > Environment Variables:

   ```
   UPSTASH_REDIS_REST_URL = https://<your-instance>.upstash.io
   UPSTASH_REDIS_REST_TOKEN = <token>
   HOLD_MS (optional override)
   TTL_MS (optional override)
   ```

4. Trigger a production deployment:

   ```bash
   vercel --prod
   ```

## Post-deployment Validation

```bash
export PROD_URL="https://your-app.vercel.app"

node scripts/test-coalescing.js $PROD_URL 25
curl "$PROD_URL/api/search-raw?q=test"
curl "$PROD_URL/api/search?q=test"
```

Review Vercel function logs to confirm roughly one leader per burst and a follower hit rate above 80%.

## Metrics to Watch

- Upstream call count (Vercel function logs and Upstash metrics)
- Tail latency vs baseline (p95, p99)
- Fallback rate (should remain below 10%)
- Redis latency (Upstash dashboard; keep <10 ms by aligning regions)

## Troubleshooting

- **Build failure**: Inspect the deployment logs in Vercel; run `npm run build` locally to reproduce.
- **High fallback rate**: Increase `HOLD_MS` and `TTL_MS`, or verify that all requests share the same cache key.
- **High latency**: Ensure the Upstash database is in the same region as the Vercel deployment; upgrade from the free tier if you exceed command limits.

With these steps complete, the project is ready for continuous deployment via Git push or the Vercel CLI.
