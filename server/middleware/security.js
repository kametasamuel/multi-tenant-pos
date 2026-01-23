const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// In-memory store for rate limit tracking (use Redis in production for clustering)
const rateLimitStore = {
  tenants: new Map(), // tenantId -> { count, resetTime }
  ips: new Map(),     // ip -> { count, resetTime, blocked }
  suspicious: new Map() // ip -> { score, lastUpdate }
};

// Suspicious activity patterns (only check URL and query params, not body to avoid false positives on passwords)
const SUSPICIOUS_PATTERNS = {
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION)\b.*\b(FROM|INTO|WHERE|SET)\b)/i,
  XSS_ATTEMPT: /<script\b|javascript:/i,
  PATH_TRAVERSAL: /\.\.\//
};

// General API rate limiter
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strict rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 attempts per minute
  message: { error: 'Too many login attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Very strict rate limiter for signup
const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 signups per hour per IP
  message: { error: 'Too many signup attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// API rate limiter for data export endpoints
const apiExportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 exports per hour
  message: { error: 'Export rate limit exceeded. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Super admin operations rate limiter
const adminOperationsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 operations per minute
  message: { error: 'Too many admin operations, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Tenant-aware rate limiter middleware factory
const createTenantRateLimiter = (options = {}) => {
  const {
    windowMs = 60 * 1000,  // 1 minute default
    maxRequests = 100,      // 100 requests default
    message = 'Rate limit exceeded'
  } = options;

  return (req, res, next) => {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return next();

    const now = Date.now();
    const key = tenantId;
    const tenantData = rateLimitStore.tenants.get(key);

    if (!tenantData || now > tenantData.resetTime) {
      rateLimitStore.tenants.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (tenantData.count >= maxRequests) {
      return res.status(429).json({
        error: message,
        retryAfter: Math.ceil((tenantData.resetTime - now) / 1000)
      });
    }

    tenantData.count++;
    return next();
  };
};

// DDoS protection middleware
const ddosProtection = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const WINDOW_MS = 10 * 1000; // 10 seconds
  const MAX_BURST = 50; // Max 50 requests in 10 seconds
  const BLOCK_DURATION = 5 * 60 * 1000; // 5 minutes block

  let ipData = rateLimitStore.ips.get(ip);

  if (!ipData) {
    ipData = { count: 1, resetTime: now + WINDOW_MS, blocked: false, blockedUntil: 0 };
    rateLimitStore.ips.set(ip, ipData);
    return next();
  }

  // Check if IP is blocked
  if (ipData.blocked && now < ipData.blockedUntil) {
    return res.status(429).json({
      error: 'Too many requests. You have been temporarily blocked.',
      retryAfter: Math.ceil((ipData.blockedUntil - now) / 1000)
    });
  }

  // Reset block if time has passed
  if (ipData.blocked && now >= ipData.blockedUntil) {
    ipData.blocked = false;
    ipData.count = 1;
    ipData.resetTime = now + WINDOW_MS;
  }

  // Reset window if expired
  if (now > ipData.resetTime) {
    ipData.count = 1;
    ipData.resetTime = now + WINDOW_MS;
    return next();
  }

  ipData.count++;

  // Block if burst limit exceeded
  if (ipData.count > MAX_BURST) {
    ipData.blocked = true;
    ipData.blockedUntil = now + BLOCK_DURATION;
    console.warn(`[SECURITY] IP ${ip} blocked for suspicious burst activity`);
    return res.status(429).json({
      error: 'Unusual traffic detected. You have been temporarily blocked.',
      retryAfter: BLOCK_DURATION / 1000
    });
  }

  return next();
};

// Suspicious activity detection middleware
const detectSuspiciousActivity = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();

  // Get suspicious score for this IP
  let suspiciousData = rateLimitStore.suspicious.get(ip) || { score: 0, lastUpdate: now };

  // Decay score over time (reset every hour)
  if (now - suspiciousData.lastUpdate > 60 * 60 * 1000) {
    suspiciousData.score = 0;
  }

  // Check URL and query params only (not body to avoid false positives on passwords)
  const checkTarget = req.url + JSON.stringify(req.query || {});

  for (const [patternName, pattern] of Object.entries(SUSPICIOUS_PATTERNS)) {
    if (pattern.test(checkTarget)) {
      suspiciousData.score += 10;
      console.warn(`[SECURITY] Suspicious ${patternName} detected from IP ${ip}: ${checkTarget.substring(0, 100)}`);
    }
  }

  // Check for unusual headers
  if (!req.headers['user-agent']) {
    suspiciousData.score += 5;
  }

  suspiciousData.lastUpdate = now;
  rateLimitStore.suspicious.set(ip, suspiciousData);

  // Block if score too high
  if (suspiciousData.score >= 30) {
    console.error(`[SECURITY] Blocking IP ${ip} due to high suspicious activity score: ${suspiciousData.score}`);
    return res.status(403).json({ error: 'Request blocked due to suspicious activity' });
  }

  next();
};

// Cleanup old rate limit entries (run periodically)
const cleanupRateLimitStore = () => {
  const now = Date.now();

  for (const [key, data] of rateLimitStore.tenants.entries()) {
    if (now > data.resetTime + 60000) {
      rateLimitStore.tenants.delete(key);
    }
  }

  for (const [key, data] of rateLimitStore.ips.entries()) {
    if (!data.blocked && now > data.resetTime + 60000) {
      rateLimitStore.ips.delete(key);
    }
  }

  for (const [key, data] of rateLimitStore.suspicious.entries()) {
    if (now - data.lastUpdate > 2 * 60 * 60 * 1000) { // 2 hours
      rateLimitStore.suspicious.delete(key);
    }
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);

// Configure helmet for security headers
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false // Allow loading images
});

// Sanitize input to prevent XSS
const sanitizeInput = (obj) => {
  if (typeof obj === 'string') {
    // Remove potentially dangerous characters but allow common ones
    return obj
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '');
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeInput);
  }
  if (obj && typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      sanitized[key] = sanitizeInput(obj[key]);
    }
    return sanitized;
  }
  return obj;
};

// Middleware to sanitize request body
const sanitizeBody = (req, res, next) => {
  if (req.body) {
    req.body = sanitizeInput(req.body);
  }
  next();
};

// Centralized error handler
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Don't leak error details in production
  const isDev = process.env.NODE_ENV !== 'production';

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      details: isDev ? err.message : undefined
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.status(500).json({
    error: 'Internal server error',
    details: isDev ? err.message : undefined
  });
};

module.exports = {
  generalLimiter,
  loginLimiter,
  signupLimiter,
  apiExportLimiter,
  adminOperationsLimiter,
  createTenantRateLimiter,
  ddosProtection,
  detectSuspiciousActivity,
  helmetConfig,
  sanitizeBody,
  errorHandler
};
