#!/usr/bin/env node

/**
 * Optimized testing scenarios for different environments
 */

const { testConcurrentRequests, compareEndpoints } = require('./test-coalescing.js');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, COLORS.reset);
}

async function runOptimizedTests() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  
  log(COLORS.bright + COLORS.blue, '\n' + '█'.repeat(70));
  log(COLORS.bright + COLORS.blue, '  OPTIMIZED COALESCING TEST SUITE');
  log(COLORS.bright + COLORS.blue, '█'.repeat(70) + '\n');

  log(COLORS.cyan, '📋 Test Configuration:');
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  Default holdMs: 500ms (lock duration)`);
  console.log(`  Default ttlMs: 8000ms (cache TTL)`);
  console.log('');

  // Test 1: Low concurrency (realistic production scenario)
  log(COLORS.bright + COLORS.yellow, '\n🧪 Test 1: Low Concurrency (Production-like)');
  log(COLORS.yellow, '   Expected: High follower hit rate, low fallbacks\n');
  
  const test1Raw = await testConcurrentRequests(
    `${baseUrl}/api/search-raw?q=test1`,
    10,
    'Baseline - 10 concurrent'
  );
  
  await new Promise(r => setTimeout(r, 1000));
  
  const test1Coalesced = await testConcurrentRequests(
    `${baseUrl}/api/search?q=test1`,
    10,
    'Coalesced - 10 concurrent'
  );
  
  showComparison(test1Raw, test1Coalesced, 'Test 1');
  
  // Test 2: Medium concurrency
  log(COLORS.bright + COLORS.yellow, '\n🧪 Test 2: Medium Concurrency');
  log(COLORS.yellow, '   Expected: Good hit rate with new defaults\n');
  
  await new Promise(r => setTimeout(r, 1000));
  
  const test2Raw = await testConcurrentRequests(
    `${baseUrl}/api/search-raw?q=test2`,
    25,
    'Baseline - 25 concurrent'
  );
  
  await new Promise(r => setTimeout(r, 1000));
  
  const test2Coalesced = await testConcurrentRequests(
    `${baseUrl}/api/search?q=test2`,
    25,
    'Coalesced - 25 concurrent'
  );
  
  showComparison(test2Raw, test2Coalesced, 'Test 2');
  
  // Test 3: Extended TTL test
  log(COLORS.bright + COLORS.yellow, '\n🧪 Test 3: Extended Hold + TTL (Conservative)');
  log(COLORS.yellow, '   Custom headers: x-hold-ms: 1000, x-ttl-ms: 15000\n');
  
  await new Promise(r => setTimeout(r, 1000));
  
  const http = require('http');
  const test3Coalesced = await testWithHeaders(
    `${baseUrl}/api/search?q=test3`,
    20,
    { 'x-hold-ms': '1000', 'x-ttl-ms': '15000' }
  );
  
  log(COLORS.green, '\n✅ Extended configuration results:');
  console.log(`  Total time: ${test3Coalesced.totalTime}ms`);
  console.log(`  Avg latency: ${test3Coalesced.avgLatency.toFixed(2)}ms`);
  console.log(`  P95: ${test3Coalesced.p95}ms`);
  
  // Final summary
  log(COLORS.bright + COLORS.green, '\n' + '═'.repeat(70));
  log(COLORS.bright + COLORS.green, '  RECOMMENDATIONS');
  log(COLORS.bright + COLORS.green, '═'.repeat(70) + '\n');
  
  console.log('For local development:');
  console.log('  • Use 10-20 concurrent requests max');
  console.log('  • Set holdMs: 500-1000ms');
  console.log('  • Set ttlMs: 8000-15000ms\n');
  
  console.log('For production (Vercel):');
  console.log('  • Test with 50-100 concurrent requests');
  console.log('  • Can use shorter holdMs: 100-300ms');
  console.log('  • ttlMs: 5000-8000ms\n');
  
  console.log('To deploy and test in production:');
  console.log('  vercel --prod\n');
}

async function testWithHeaders(url, concurrency, headers) {
  const http = require('http');
  
  async function makeRequest() {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(url);
      const startTime = Date.now();
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || 80,
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: headers
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          const latency = Date.now() - startTime;
          try {
            const json = JSON.parse(data);
            resolve({ json, latency, status: res.statusCode });
          } catch (e) {
            resolve({ json: null, latency, status: res.statusCode });
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
  }
  
  const promises = Array(concurrency).fill(null).map(() => makeRequest());
  const results = await Promise.all(promises);
  
  const latencies = results.map(r => r.latency);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
  
  const sources = {};
  results.forEach(r => {
    const source = r.json?.data?.source || 'unknown';
    sources[source] = (sources[source] || 0) + 1;
  });
  
  console.log('  Sources:', sources);
  
  return {
    totalTime: Math.max(...latencies),
    avgLatency,
    p95,
    results,
    sources
  };
}

function showComparison(rawResults, coalescedResults, testName) {
  log(COLORS.cyan, `\n📊 ${testName} Comparison:`);
  
  const improvement = ((rawResults.avgLatency - coalescedResults.avgLatency) / rawResults.avgLatency * 100);
  
  console.log(`  Raw avg:       ${rawResults.avgLatency.toFixed(2)}ms`);
  console.log(`  Coalesced avg: ${coalescedResults.avgLatency.toFixed(2)}ms`);
  
  if (improvement > 0) {
    log(COLORS.green, `  ✅ Improvement: ${improvement.toFixed(2)}%`);
  } else {
    log(COLORS.yellow, `  ⚠️  Regression: ${Math.abs(improvement).toFixed(2)}%`);
  }
  
  const sources = coalescedResults.results
    .map(r => r.json?.data?.source)
    .filter(Boolean);
  
  const counts = {};
  sources.forEach(s => counts[s] = (counts[s] || 0) + 1);
  
  console.log(`  Sources:`, counts);
  
  const fallbackRate = ((counts.fallback || 0) / sources.length * 100);
  if (fallbackRate > 20) {
    log(COLORS.yellow, `  ⚠️  High fallback rate: ${fallbackRate.toFixed(1)}%`);
  } else {
    log(COLORS.green, `  ✅ Good fallback rate: ${fallbackRate.toFixed(1)}%`);
  }
}

if (require.main === module) {
  runOptimizedTests()
    .then(() => {
      log(COLORS.green, '\n✅ All tests completed!\n');
      process.exit(0);
    })
    .catch((error) => {
      log(COLORS.red, '\n✗ Testing failed:', error.message);
      process.exit(1);
    });
}
