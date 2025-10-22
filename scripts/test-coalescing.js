#!/usr/bin/env node

/**
 * Test script to verify request coalescing is working
 * Runs concurrent requests and measures the difference
 */

const http = require('http');
const https = require('https');

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(color, ...args) {
  console.log(color, ...args, COLORS.reset);
}

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const endTime = Date.now();
        const latency = endTime - startTime;
        try {
          const json = JSON.parse(data);
          resolve({ json, latency, status: res.statusCode, rawData: data });
        } catch (e) {
          resolve({ json: null, latency, status: res.statusCode, error: e.message, rawData: data });
        }
      });
    }).on('error', (err) => {
      const endTime = Date.now();
      reject({ error: err.message, latency: endTime - startTime });
    });
  });
}

async function testConcurrentRequests(url, concurrency, label) {
  log(COLORS.bright + COLORS.blue, `\n${'='.repeat(60)}`);
  log(COLORS.bright + COLORS.blue, `Testing: ${label}`);
  log(COLORS.bright + COLORS.blue, `URL: ${url}`);
  log(COLORS.bright + COLORS.blue, `Concurrency: ${concurrency}`);
  log(COLORS.bright + COLORS.blue, '='.repeat(60));

  const startTime = Date.now();
  const promises = Array(concurrency).fill(null).map(() => makeRequest(url));
  
  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    
    const latencies = results.map(r => r.latency);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const minLatency = Math.min(...latencies);
    const maxLatency = Math.max(...latencies);
    
    // Calculate percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)];
    const p95 = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];
    
    const successCount = results.filter(r => r.status === 200).length;
    const failureCount = results.length - successCount;
    
    log(COLORS.green, '\n✓ Results:');
    console.log(`  Total test time: ${totalTime}ms`);
    console.log(`  Requests completed: ${results.length}`);
    console.log(`  Success rate: ${successCount}/${results.length}`);
    
    if (failureCount > 0) {
      log(COLORS.red, `\n  ⚠️  ${failureCount} requests failed!`);
      const errorSample = results.find(r => r.status !== 200);
      if (errorSample) {
        console.log(`  Status code: ${errorSample.status}`);
        if (errorSample.rawData) {
          console.log(`  Error message:\n${errorSample.rawData.substring(0, 500)}`);
        }
      }
    }
    
    log(COLORS.cyan, '\n  Latency Statistics:');
    console.log(`    Min:     ${minLatency}ms`);
    console.log(`    Max:     ${maxLatency}ms`);
    console.log(`    Average: ${avgLatency.toFixed(2)}ms`);
    console.log(`    P50:     ${p50}ms`);
    console.log(`    P95:     ${p95}ms`);
    console.log(`    P99:     ${p99}ms`);
    
    // Check for leader/follower behavior in coalesced responses
    const sources = results.map(r => r.json?.data?.source).filter(Boolean);
    if (sources.length > 0) {
      const uniqueSources = [...new Set(sources)];
      log(COLORS.yellow, '\n  Response Sources:');
      uniqueSources.forEach(source => {
        const count = sources.filter(s => s === source).length;
        console.log(`    ${source}: ${count}`);
      });
    }
    
    return {
      totalTime,
      avgLatency,
      minLatency,
      maxLatency,
      p50,
      p95,
      p99,
      results
    };
  } catch (error) {
    log(COLORS.red, '\n✗ Error:', error);
    throw error;
  }
}

async function compareEndpoints(baseUrl, concurrency = 50) {
  log(COLORS.bright, '\n' + '█'.repeat(60));
  log(COLORS.bright, '  VERCEL FLUID MVP - COALESCING TEST');
  log(COLORS.bright, '█'.repeat(60));
  
  const query = 'vercel';
  const rawUrl = `${baseUrl}/api/search-raw?q=${query}`;
  const coalescedUrl = `${baseUrl}/api/search?q=${query}`;
  
  // Test baseline first
  const rawResults = await testConcurrentRequests(rawUrl, concurrency, 'Baseline (No Coalescing)');
  
  // Wait a bit between tests
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Test coalesced
  const coalescedResults = await testConcurrentRequests(coalescedUrl, concurrency, 'Coalesced (Optimized)');
  
  // Comparison
  log(COLORS.bright + COLORS.green, '\n' + '='.repeat(60));
  log(COLORS.bright + COLORS.green, '  COMPARISON SUMMARY');
  log(COLORS.bright + COLORS.green, '='.repeat(60));
  
  const improvements = {
    avgLatency: ((rawResults.avgLatency - coalescedResults.avgLatency) / rawResults.avgLatency * 100).toFixed(2),
    p95: ((rawResults.p95 - coalescedResults.p95) / rawResults.p95 * 100).toFixed(2),
    p99: ((rawResults.p99 - coalescedResults.p99) / rawResults.p99 * 100).toFixed(2),
  };
  
  console.log('\n  Average Latency:');
  console.log(`    Raw:       ${rawResults.avgLatency.toFixed(2)}ms`);
  console.log(`    Coalesced: ${coalescedResults.avgLatency.toFixed(2)}ms`);
  console.log(`    ${improvements.avgLatency > 0 ? '↓' : '↑'} Improvement: ${Math.abs(improvements.avgLatency)}%`);
  
  console.log('\n  P95 Latency:');
  console.log(`    Raw:       ${rawResults.p95}ms`);
  console.log(`    Coalesced: ${coalescedResults.p95}ms`);
  console.log(`    ${improvements.p95 > 0 ? '↓' : '↑'} Improvement: ${Math.abs(improvements.p95)}%`);
  
  console.log('\n  P99 Latency:');
  console.log(`    Raw:       ${rawResults.p99}ms`);
  console.log(`    Coalesced: ${coalescedResults.p99}ms`);
  console.log(`    ${improvements.p99 > 0 ? '↓' : '↑'} Improvement: ${Math.abs(improvements.p99)}%`);
  
  log(COLORS.bright, '\n' + '█'.repeat(60) + '\n');
  
  return { rawResults, coalescedResults, improvements };
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const baseUrl = args[0] || 'http://localhost:3000';
  const concurrency = parseInt(args[1]) || 50;
  
  compareEndpoints(baseUrl, concurrency)
    .then(() => {
      log(COLORS.green, '✓ Testing completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      log(COLORS.red, '✗ Testing failed:', error.message);
      process.exit(1);
    });
}

module.exports = { compareEndpoints, testConcurrentRequests };
