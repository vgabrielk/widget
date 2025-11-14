'use client';

import { createClient } from '@/lib/supabase/client';
import { AVATAR_BUCKET, DEFAULT_AVATAR, getAvatarCacheKey, normalizeAvatarPath } from '@/lib/utils/avatar';

const supabase = createClient();
const memoryCache: Record<string, string> = {};

const isBrowser = () => typeof window !== 'undefined';

const readFromLocalStorage = (key: string) => {
  if (!isBrowser()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.warn('[avatar-cache] Failed to read from localStorage', error);
    return null;
  }
};

const writeToLocalStorage = (key: string, value: string) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.warn('[avatar-cache] Failed to persist to localStorage', error);
  }
};

export interface AvatarCacheOptions {
  forceRefresh?: boolean;
}

export const getAvatarUrlCached = (rawPath?: string | null, options?: AvatarCacheOptions): string | null => {
  const path = normalizeAvatarPath(rawPath);
  if (!path) return null;

  const cacheKey = getAvatarCacheKey(path);
  if (!options?.forceRefresh && memoryCache[path]) {
    return memoryCache[path];
  }

  const local = !options?.forceRefresh ? readFromLocalStorage(cacheKey) : null;
  if (local) {
    memoryCache[path] = local;
    return local;
  }

  const { data, error } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (error || !data?.publicUrl) {
    console.warn('Avatar not found at path:', path);
    return null;
  }

  memoryCache[path] = data.publicUrl;
  writeToLocalStorage(cacheKey, data.publicUrl);
  return data.publicUrl;
};

export const preloadAvatarUrl = (path?: string | null) => getAvatarUrlCached(path);

export const clearAvatarCache = (path?: string) => {
  if (!path) {
    Object.keys(memoryCache).forEach((key) => delete memoryCache[key]);
    if (isBrowser()) {
      try {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith('avatar-cache-'))
          .forEach((key) => window.localStorage.removeItem(key));
      } catch (error) {
        console.warn('[avatar-cache] Failed to clear cache', error);
      }
    }
    return;
  }

  const normalized = normalizeAvatarPath(path);
  if (!normalized) return;
  delete memoryCache[normalized];
  if (isBrowser()) {
    try {
      window.localStorage.removeItem(getAvatarCacheKey(normalized));
    } catch (error) {
      console.warn('[avatar-cache] Failed to remove local entry', error);
    }
  }
};

export const getSafeAvatarSrc = (path?: string | null) => {
  return getAvatarUrlCached(path) || DEFAULT_AVATAR;
};

