#!/usr/bin/env node

/**
 * Verify Redis connection and test coalescing mechanism
 */

require('dotenv').config({ path: '.env.local' });
const { Redis } = require('@upstash/redis');

const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

async function verifyRedis() {
  console.log(COLORS.blue, '\n🔍 Verifying Redis Connection...\n', COLORS.reset);
  
  try {
    // Check environment variables
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    
    if (!url || !token) {
      console.log(COLORS.red, '✗ Missing environment variables!', COLORS.reset);
      console.log('  Required variables:');
      console.log(`    UPSTASH_REDIS_REST_URL: ${url ? '✓' : '✗ Missing'}`);
      console.log(`    UPSTASH_REDIS_REST_TOKEN: ${token ? '✓' : '✗ Missing'}`);
      console.log('\nPlease create .env.local file with your Upstash credentials.');
      process.exit(1);
    }
    
    console.log(COLORS.green, '✓ Environment variables found', COLORS.reset);
    console.log(`  URL: ${url.substring(0, 30)}...`);
    console.log(`  Token: ${token.substring(0, 20)}...\n`);
    
    // Test connection
    const redis = Redis.fromEnv();
    console.log(COLORS.blue, '⏳ Testing connection...', COLORS.reset);
    
    const testKey = 'test:connection';
    const testValue = 'Hello from Fluid MVP';
    
    await redis.set(testKey, testValue, { ex: 10 });
    console.log(COLORS.green, '✓ Write test successful', COLORS.reset);
    
    const retrieved = await redis.get(testKey);
    if (retrieved === testValue) {
      console.log(COLORS.green, '✓ Read test successful', COLORS.reset);
    } else {
      console.log(COLORS.red, '✗ Read test failed', COLORS.reset);
      process.exit(1);
    }
    
    await redis.del(testKey);
    console.log(COLORS.green, '✓ Delete test successful\n', COLORS.reset);
    
    // Test coalescing keys
    console.log(COLORS.blue, '🔍 Testing coalescing mechanism...\n', COLORS.reset);
    
    const flightKey = 'flight:test:demo';
    const resultKey = 'result:test:demo';
    
    // Simulate leader acquiring lock
    const acquired = await redis.set(flightKey, '1', { nx: true, px: 1000 });
    console.log(COLORS.green, `✓ Leader lock acquired: ${acquired}`, COLORS.reset);
    
    // Store result
    await redis.set(resultKey, JSON.stringify({ test: true, timestamp: Date.now() }), { px: 5000 });
    console.log(COLORS.green, '✓ Result cached', COLORS.reset);
    
    // Simulate follower reading
    const result = await redis.get(resultKey);
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    console.log(COLORS.green, '✓ Follower retrieved result:', parsed, COLORS.reset);
    
    // Cleanup
    await redis.del(flightKey);
    await redis.del(resultKey);
    console.log(COLORS.green, '✓ Cleanup successful\n', COLORS.reset);
    
    console.log(COLORS.green, '═══════════════════════════════════════', COLORS.reset);
    console.log(COLORS.green, '✓ All Redis tests passed!', COLORS.reset);
    console.log(COLORS.green, '✓ Coalescing mechanism is ready!', COLORS.reset);
    console.log(COLORS.green, '═══════════════════════════════════════\n', COLORS.reset);
    
  } catch (error) {
    console.log(COLORS.red, '\n✗ Redis verification failed:', error.message, COLORS.reset);
    console.log('\nTroubleshooting:');
    console.log('  1. Check your Upstash credentials');
    console.log('  2. Ensure your Redis database is active');
    console.log('  3. Verify network connectivity\n');
    process.exit(1);
  }
}

verifyRedis();
