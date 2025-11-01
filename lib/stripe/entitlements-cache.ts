/**
 * In-memory cache for user entitlements
 * To avoid repeated heavy Stripe/Supabase queries on every navigation
 */

interface CachedEntitlements {
  plan: 'free' | 'pro';
  userId: string;
  timestamp: number;
}

const CACHE_TTL = 60 * 1000; // 1 minute
const cache = new Map<string, CachedEntitlements>();

/**
 * Get cached entitlements if valid
 */
export function getCachedEntitlements(userId: string): 'free' | 'pro' | null {
  const cached = cache.get(userId);
  
  if (!cached) {
    return null;
  }

  // Check if cache is still valid
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    cache.delete(userId);
    return null;
  }

  return cached.plan;
}

/**
 * Set cached entitlements
 */
export function setCachedEntitlements(userId: string, plan: 'free' | 'pro'): void {
  cache.set(userId, {
    plan,
    userId,
    timestamp: Date.now(),
  });
}

/**
 * Clear cached entitlements for a user (e.g., after upgrade/downgrade)
 */
export function clearCachedEntitlements(userId: string): void {
  cache.delete(userId);
}

/**
 * Clear all cached entitlements
 */
export function clearAllCachedEntitlements(): void {
  cache.clear();
}

