#!/usr/bin/env node

const BASE_URL = 'https://vercel-fluid-mvp.vercel.app';

async function testEndpoint(endpoint, concurrency, query = 'test') {
  console.log(`\n🧪 Testing ${endpoint} with ${concurrency} concurrent requests...\n`);
  
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
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log(`📊 Results:`);
  console.log(`   Total Time: ${totalTime}ms`);
  console.log(`   Avg Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`   Min/Max: ${minLatency}ms / ${maxLatency}ms`);
  console.log(`\n👥 Role Distribution:`);
  Object.entries(roleCounts).forEach(([role, count]) => {
    const percentage = ((count / concurrency) * 100).toFixed(1);
    console.log(`   ${role}: ${count} (${percentage}%)`);
  });

  return { roleCounts, totalTime, avgLatency };
}

async function runTests() {
  console.log('🚀 Testing Vercel Production Deployment');
  console.log('=' .repeat(50));

  // Test baseline (no coalescing)
  const baseline = await testEndpoint('/api/search-raw', 25);

  // Test coalesced endpoint
  const coalesced = await testEndpoint('/api/search', 25);

  // Calculate improvements
  console.log('\n📈 Performance Comparison:');
  console.log('=' .repeat(50));
  
  const leaders = coalesced.roleCounts.leader || 0;
  const followers = coalesced.roleCounts['follower-hit'] || 0;
  const fallbacks = coalesced.roleCounts['follower-miss'] || 0;
  const upstreamCalls = leaders + fallbacks;
  const upstreamReduction = ((1 - upstreamCalls / 25) * 100).toFixed(1);
  
  console.log(`Upstream Calls: 25 → ${upstreamCalls} (${upstreamReduction}% reduction)`);
  console.log(`Cache Hit Rate: ${followers}/25 (${((followers/25) * 100).toFixed(1)}%)`);
  
  const latencyImprovement = ((baseline.avgLatency - coalesced.avgLatency) / baseline.avgLatency * 100).toFixed(1);
  if (latencyImprovement > 0) {
    console.log(`Latency Improvement: ${latencyImprovement}% faster`);
  } else {
    console.log(`Latency Change: ${Math.abs(latencyImprovement)}% slower (expected with Redis overhead)`);
  }

  console.log('\n✅ Production test complete!');
}

runTests().catch(console.error);
