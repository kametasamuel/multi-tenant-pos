/**
 * Redis Cache Utility
 *
 * Provides caching layer for frequently accessed data.
 * Falls back gracefully if Redis is unavailable.
 *
 * Environment variables:
 *   REDIS_URL - Redis connection URL (default: redis://localhost:6379)
 *   CACHE_ENABLED - Set to 'false' to disable caching (default: true)
 */

const Redis = require('ioredis');

// Configuration
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false';

// Default TTLs (in seconds)
const TTL = {
  PRODUCTS: 300,       // 5 minutes - frequently read by cashiers
  CATEGORIES: 600,     // 10 minutes - rarely changes
  TENANT: 600,         // 10 minutes - business settings
  USER_SESSION: 3600,  // 1 hour
  DASHBOARD: 60,       // 1 minute - dashboards need fresh data
};

let redis = null;
let isConnected = false;

// Initialize Redis connection
function initRedis() {
  if (!CACHE_ENABLED) {
    console.log('Cache: Disabled by configuration');
    return;
  }

  try {
    redis = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      console.log('Cache: Redis connected');
      isConnected = true;
    });

    redis.on('error', (err) => {
      console.error('Cache: Redis error -', err.message);
      isConnected = false;
    });

    redis.on('close', () => {
      console.log('Cache: Redis connection closed');
      isConnected = false;
    });

    // Attempt connection
    redis.connect().catch((err) => {
      console.log('Cache: Redis unavailable, running without cache');
      isConnected = false;
    });

  } catch (error) {
    console.log('Cache: Failed to initialize Redis -', error.message);
  }
}

// Generate cache key with tenant isolation
function key(tenantId, type, ...parts) {
  return `pos:${tenantId}:${type}:${parts.join(':')}`;
}

// Get value from cache
async function get(cacheKey) {
  if (!isConnected || !redis) return null;

  try {
    const value = await redis.get(cacheKey);
    if (value) {
      return JSON.parse(value);
    }
    return null;
  } catch (error) {
    console.error('Cache get error:', error.message);
    return null;
  }
}

// Set value in cache
async function set(cacheKey, value, ttlSeconds = 300) {
  if (!isConnected || !redis) return false;

  try {
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error('Cache set error:', error.message);
    return false;
  }
}

// Delete from cache
async function del(cacheKey) {
  if (!isConnected || !redis) return false;

  try {
    await redis.del(cacheKey);
    return true;
  } catch (error) {
    console.error('Cache del error:', error.message);
    return false;
  }
}

// Delete by pattern (use carefully)
async function delPattern(pattern) {
  if (!isConnected || !redis) return false;

  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    return true;
  } catch (error) {
    console.error('Cache delPattern error:', error.message);
    return false;
  }
}

// Invalidate all cache for a tenant
async function invalidateTenant(tenantId) {
  return delPattern(`pos:${tenantId}:*`);
}

// Invalidate products cache for a tenant
async function invalidateProducts(tenantId, branchId = null) {
  if (branchId) {
    return del(key(tenantId, 'products', branchId));
  }
  return delPattern(`pos:${tenantId}:products:*`);
}

// Invalidate categories cache for a tenant
async function invalidateCategories(tenantId) {
  return del(key(tenantId, 'categories', 'all'));
}

// Cache-through helper: get from cache or fetch and cache
async function getOrSet(cacheKey, fetchFn, ttlSeconds = 300) {
  // Try cache first
  const cached = await get(cacheKey);
  if (cached !== null) {
    return { data: cached, fromCache: true };
  }

  // Fetch fresh data
  const data = await fetchFn();

  // Cache the result (non-blocking)
  set(cacheKey, data, ttlSeconds).catch(() => {});

  return { data, fromCache: false };
}

// Health check
async function healthCheck() {
  if (!isConnected || !redis) {
    return { status: 'disconnected', enabled: CACHE_ENABLED };
  }

  try {
    const start = Date.now();
    await redis.ping();
    const latency = Date.now() - start;
    return { status: 'healthy', latency, enabled: true };
  } catch (error) {
    return { status: 'error', error: error.message, enabled: true };
  }
}

// Initialize on module load
initRedis();

module.exports = {
  key,
  get,
  set,
  del,
  delPattern,
  getOrSet,
  invalidateTenant,
  invalidateProducts,
  invalidateCategories,
  healthCheck,
  TTL,
  isConnected: () => isConnected
};
