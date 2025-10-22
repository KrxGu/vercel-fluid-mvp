# Quick Reference

## 🚀 Common Commands

```bash
# Development
npm install              # Install dependencies
npm run dev             # Start dev server (http://localhost:3000)

# Testing
npm run verify          # Verify Redis connection
npm run test:quick      # Quick test (10 concurrent)
npm test                # Standard test (50 concurrent)
npm run test:optimized  # Comprehensive suite

# Deployment
vercel                  # Deploy to Vercel
vercel --prod           # Deploy to production
```

## 🔑 Environment Variables

```bash
UPSTASH_REDIS_REST_URL=https://game-burro-22499.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-token>
```

## 📊 Test Endpoints

```bash
# Optimized (with coalescing)
http://localhost:3000/api/search?q=test

# Baseline (no coalescing)
http://localhost:3000/api/search-raw?q=test

# Mock upstream (200ms delay)
http://localhost:3000/api/mock-upstream?q=test&delay=200
```

## 🎛️ Configuration Headers

```bash
curl http://localhost:3000/api/search?q=test \
  -H "x-hold-ms: 1000" \
  -H "x-ttl-ms: 10000"
```

## 📈 Expected Results

### Good Performance
- ✅ 1 leader per burst
- ✅ >80% followers
- ✅ <10% fallbacks
- ✅ 85-95% upstream reduction

### Needs Tuning
- ❌ Multiple leaders → Increase `holdMs`
- ❌ High fallbacks → Increase `ttlMs`
- ❌ All fallbacks → Check Redis connection

## 🎯 Key Metrics

| Metric | Target | Method |
|--------|--------|--------|
| **Upstream Reduction** | >85% | Compare calls with/without coalescing |
| **Leader Count** | 1 per burst | Check logs for `[coalesce] leader` |
| **Follower Rate** | >80% | Count `follower-hit` responses |
| **Fallback Rate** | <10% | Count `follower-fallback` responses |

## 🐛 Quick Troubleshooting

```bash
# Redis connection issues
npm run verify

# High latency
# → Normal in local dev with free tier
# → Test in production for real metrics

# Build errors
npm run build

# Check logs
vercel logs <deployment-url>
```

## 📂 File Structure

```
vercel-fluid-mvp/
├── lib/coalesce.ts              # Core logic
├── app/api/search/route.ts      # Optimized endpoint
├── scripts/test-coalescing.js   # Main test
├── README.md                    # Full documentation
├── DEPLOY.md                    # Deployment guide
└── PROJECT_SUMMARY.md           # Executive summary
```

## 🎓 How It Works (30-second version)

1. Request arrives → Generate cache key
2. Try to acquire Redis lock (SET NX)
3. **Leader**: Got lock → Do work → Cache result
4. **Follower**: Lock taken → Poll Redis → Get cached result
5. **Result**: N requests = 1 upstream call

## 💰 Cost Savings Example

**10M requests/month with 10% duplicates:**
- Without: 10M API calls = $10,000
- With: 1M API calls = $1,000
- **Savings: $9,000/month** 💰

---

**Need help?** Check README.md for full documentation.
