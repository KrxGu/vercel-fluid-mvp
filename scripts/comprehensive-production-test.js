#!/usr/bin/env node

const BASE_URL = 'https://vercel-fluid-mvp.vercel.app';

async function testEndpoint(endpoint, concurrency, query = 'test') {
  const startTime = Date.now();
  const promises = Array.from({ length: concurrency }, () =>
    fetch(`${BASE_URL}${endpoint}?q=${query}`)
      .then(res => res.json())
      .then(data => ({
        role: data.data?.source || data.role || 'unknown',
        latency: Date.now() - startTime
      }))
      .catch(err => ({ error: err.message }))
  );

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  // Count roles
  const roleCounts = results.reduce((acc, r) => {
    const role = r.role || 'error';
    acc[role] = (acc[role] || 0) + 1;
    return acc;
  }, {});

  // Calculate stats
  const latencies = results.filter(r => !r.error).map(r => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;

  return { roleCounts, totalTime, avgLatency, concurrency };
}

async function runTests() {
  console.log('🚀 Vercel Production MVP Test Suite');
  console.log('=' .repeat(60));
  console.log(`Deployment: ${BASE_URL}\n`);

  const testCases = [
    { concurrency: 10, query: 'test-10' },
    { concurrency: 25, query: 'test-25' },
    { concurrency: 50, query: 'test-50' }
  ];

  for (const { concurrency, query } of testCases) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`📊 Test: ${concurrency} concurrent requests`);
    console.log('─'.repeat(60));

    // Test baseline
    const baseline = await testEndpoint('/api/search-raw', concurrency, query);
    console.log(`\n  Baseline (no coalescing):`);
    console.log(`    Total Time: ${baseline.totalTime}ms`);
    console.log(`    Avg Latency: ${baseline.avgLatency.toFixed(0)}ms`);

    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test coalesced
    const coalesced = await testEndpoint('/api/search', concurrency, query);
    console.log(`\n  Coalesced (with Redis):`);
    console.log(`    Total Time: ${coalesced.totalTime}ms`);
    console.log(`    Avg Latency: ${coalesced.avgLatency.toFixed(0)}ms`);

    // Calculate metrics
    const leaders = coalesced.roleCounts.leader || 0;
    const followers = (coalesced.roleCounts.follower || 0) + (coalesced.roleCounts['follower-hit'] || 0);
    const fallbacks = coalesced.roleCounts['follower-miss'] || 0;
    const upstreamCalls = leaders + fallbacks;
    const upstreamReduction = ((1 - upstreamCalls / concurrency) * 100).toFixed(1);
    const hitRate = ((followers / concurrency) * 100).toFixed(1);
    
    console.log(`\n  📈 Performance Metrics:`);
    console.log(`    Upstream Calls: ${concurrency} → ${upstreamCalls} (${upstreamReduction}% reduction)`);
    console.log(`    Leaders: ${leaders}`);
    console.log(`    Followers: ${followers} (${hitRate}% cache hit)`);
    console.log(`    Fallbacks: ${fallbacks}`);
    
    const latencyImprovement = ((baseline.avgLatency - coalesced.avgLatency) / baseline.avgLatency * 100).toFixed(1);
    if (latencyImprovement > 0) {
      console.log(`    Latency: ${latencyImprovement}% faster ✅`);
    } else {
      console.log(`    Latency: ${Math.abs(latencyImprovement)}% slower`);
    }

    // Wait before next test
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('✅ All tests complete!');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
