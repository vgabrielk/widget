'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '@/lib/types/profile';
import { normalizeAvatarPath } from '@/lib/utils/avatar';
import { preloadAvatarUrl, clearAvatarCache } from '@/lib/utils/avatar-client';

interface UserContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const CACHE_KEY = 'jello_user_profile';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface CachedProfile {
  profile: UserProfile;
  timestamp: number;
}

interface UserProviderProps {
  children: React.ReactNode;
  initialUser?: User | null;
  initialProfile?: UserProfile | null;
}

export function UserProvider({
  children,
  initialUser = null,
  initialProfile = null,
}: UserProviderProps) {
  const [user, setUser] = useState<User | null>(initialUser);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [loading, setLoading] = useState(Boolean(initialUser) && !initialProfile);
  const [error, setError] = useState<string | null>(null);
  const fetchingProfileRef = useRef(false);

  const normalizeProfileData = useCallback((profileData: UserProfile | null): UserProfile | null => {
    if (!profileData) return null;
    const normalized: UserProfile = {
      ...profileData,
      avatar_path: normalizeAvatarPath(profileData.avatar_path),
    };
    if (normalized.avatar_path) {
      preloadAvatarUrl(normalized.avatar_path);
    }
    return normalized;
  }, []);

  // Load from cache
  const loadFromCache = useCallback((): UserProfile | null => {
    if (typeof window === 'undefined') return null;
    
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (!cached) return null;

      const { profile: cachedProfile, timestamp }: CachedProfile = JSON.parse(cached);
      
      // Check if cache is still valid
      if (Date.now() - timestamp > CACHE_DURATION) {
        localStorage.removeItem(CACHE_KEY);
        return null;
      }

      return normalizeProfileData(cachedProfile);
    } catch (err) {
      console.error('Error loading cache:', err);
      return null;
    }
  }, [normalizeProfileData]);

  // Save to cache
  const saveToCache = useCallback((profileData: UserProfile) => {
    if (typeof window === 'undefined') return;
    const normalized = normalizeProfileData(profileData);
    if (!normalized) return;
    
    try {
      const cacheData: CachedProfile = {
        profile: normalized,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Error saving cache:', err);
    }
  }, [normalizeProfileData]);

  // Clear cache
  const clearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
    clearAvatarCache();
  }, []);


  // Fetch profile from database via API route
  const fetchProfile = useCallback(async (_userId: string, forceFresh = false): Promise<UserProfile | null> => {
    // Prevent multiple simultaneous fetches
    if (fetchingProfileRef.current && !forceFresh) {
      return null;
    }
    
    fetchingProfileRef.current = true;
    
    try {
      const res = await fetch('/api/user/profile', {
        credentials: 'include', // CRITICAL: Include cookies for auth
        cache: forceFresh ? 'no-store' : 'force-cache',
        // Add timestamp only for fresh fetches to prevent caching
        ...(forceFresh && { headers: { 'Cache-Control': 'no-cache' } }),
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch profile: ${res.statusText}`);
      }

      const data = await res.json();
      return data.profile as UserProfile | null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      throw err;
    } finally {
      fetchingProfileRef.current = false;
    }
  }, []);

  // Refresh profile (bypasses cache) - memoize to prevent recreation
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const profileData = await fetchProfile(user.id, true);
      const normalizedProfile = normalizeProfileData(profileData);
      if (normalizedProfile) {

        // Compare with current profile to avoid unnecessary updates
        const currentProfile = profile;
        const currentAvatarPath = normalizeAvatarPath(currentProfile?.avatar_path || null);
        const newAvatarPath = normalizedProfile.avatar_path;
        
        const profileChanged = 
          !currentProfile ||
          currentProfile.full_name !== normalizedProfile.full_name ||
          currentProfile.company_name !== normalizedProfile.company_name ||
          currentAvatarPath !== newAvatarPath;
        
        if (profileChanged) {
          setProfile(normalizedProfile);
          saveToCache(normalizedProfile);
        } else if (currentProfile) {
          const updatedProfile = { ...currentProfile, avatar_path: normalizedProfile.avatar_path };
          saveToCache(updatedProfile);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  }, [user, fetchProfile, saveToCache, normalizeProfileData]); // Removed profile from deps

  // Update profile via API route - memoize to prevent recreation
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // CRITICAL: Include cookies for auth
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to update profile: ${res.statusText}`);
      }

      const data = await res.json();
      const normalizedProfile = normalizeProfileData(data.profile as UserProfile);
      
      // Compare avatar file path to see if it actually changed
      setProfile((currentProfile) => {
        if (!normalizedProfile) {
          return currentProfile;
        }

        if (!currentProfile) {
          saveToCache(normalizedProfile);
          return normalizedProfile;
        }
        
        const currentAvatarPath = normalizeAvatarPath(currentProfile.avatar_path || null);
        const newAvatarPath = normalizedProfile.avatar_path;
        
        // Only update state if avatar file actually changed or other fields changed
        const shouldUpdate = 
          currentProfile.full_name !== normalizedProfile.full_name ||
          currentProfile.company_name !== normalizedProfile.company_name ||
          currentAvatarPath !== newAvatarPath;
        
        if (shouldUpdate) {
          saveToCache(normalizedProfile);
          return normalizedProfile;
        } else {
          // Only token changed, update cache but not state
          const mergedProfile = { ...currentProfile, avatar_path: normalizedProfile.avatar_path };
          saveToCache(mergedProfile);
          return currentProfile;
        }
      });
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw new Error(err.message || 'Failed to update profile');
    }
  }, [user, saveToCache, normalizeProfileData]); // Removed profile from deps

  // Upload avatar via API route
  const uploadAvatar = useCallback(async (file: File): Promise<string | null> => {
    if (!user) throw new Error('No user logged in');

    try {
      // Validate file
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        throw new Error('Invalid file type. Please upload a JPG, PNG, WEBP, or GIF image.');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new Error('File too large. Maximum size is 5MB.');
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      // Upload via API route
      const res = await fetch('/api/user/avatar', {
        method: 'POST',
        credentials: 'include', // CRITICAL: Include cookies for auth
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to upload avatar: ${res.statusText}`);
      }

      const data = await res.json();
      const avatarPath = normalizeAvatarPath(data.avatar_path);
      const normalizedProfile =
        normalizeProfileData({
          ...(data.profile as UserProfile),
          avatar_path: data.profile?.avatar_path ?? avatarPath,
        }) || null;

      // Always update on avatar upload (new file uploaded)
      if (normalizedProfile) {
        setProfile(normalizedProfile);
        saveToCache(normalizedProfile);
      }

      return normalizedProfile?.avatar_path || null;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload avatar');
    }
  }, [user, saveToCache, normalizeProfileData]);

  // Sync session coming from the server
  useEffect(() => {
    if (!initialUser) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      setError(null);
      clearCache();
      return;
    }

    setUser(initialUser);
  }, [initialUser, clearCache]);

  // Resolve initial profile data using server payload, cache or API fallback
  useEffect(() => {
    if (!initialUser) {
      return;
    }

    setError(null);

    if (initialProfile) {
      const normalized = normalizeProfileData(initialProfile);
      if (normalized) {
        setProfile(normalized);
        saveToCache(normalized);
      }
      setLoading(false);
      return;
    }

    const cachedProfile = loadFromCache();
    if (cachedProfile && cachedProfile.id === initialUser.id) {
      setProfile(cachedProfile);
      setLoading(false);
      return;
    }

    let isMounted = true;

    const resolveProfile = async () => {
      setLoading(true);
      try {
        let profileData = await fetchProfile(initialUser.id, true);

        if (!profileData && initialUser.email) {
          const createRes = await fetch('/api/user/profile', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
              email: initialUser.email,
            }),
          });

          if (createRes.ok) {
            const createData = await createRes.json();
            profileData = (createData.profile as UserProfile) || null;
          }
        }

        if (!isMounted || !profileData) return;

        const normalized = normalizeProfileData(profileData);
        if (!normalized) return;

        setProfile(normalized);
        saveToCache(normalized);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to load profile');
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    };

    resolveProfile();

    return () => {
      isMounted = false;
    };
  }, [initialUser, initialProfile, loadFromCache, saveToCache, fetchProfile, normalizeProfileData]);

  // Memoize the context value to prevent unnecessary re-renders of all consumers
  const value: UserContextType = useMemo(() => ({
    user,
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
    uploadAvatar,
  }), [user, profile, loading, error, refreshProfile, updateProfile, uploadAvatar]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

