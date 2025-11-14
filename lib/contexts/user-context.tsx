'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { User } from '@supabase/supabase-js';
import { UserProfile } from '@/lib/types/profile';

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

      return cachedProfile;
    } catch (err) {
      console.error('Error loading cache:', err);
      return null;
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback((profileData: UserProfile) => {
    if (typeof window === 'undefined') return;
    
    try {
      const cacheData: CachedProfile = {
        profile: profileData,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch (err) {
      console.error('Error saving cache:', err);
    }
  }, []);

  // Clear cache
  const clearCache = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(CACHE_KEY);
  }, []);

  // Extract file path from signed URL (remove token to compare actual file)
  const getAvatarFilePath = useCallback((avatarUrl: string | null): string | null => {
    if (!avatarUrl) return null;
    // Signed URLs have format: https://...?token=...
    // Extract the part before ?token=
    const urlParts = avatarUrl.split('?token=');
    return urlParts[0] || avatarUrl;
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
      if (profileData) {
        // Compare with current profile to avoid unnecessary updates
        const currentProfile = profile; // Capture at call time
        const currentAvatarPath = getAvatarFilePath(currentProfile?.avatar_url || null);
        const newAvatarPath = getAvatarFilePath(profileData.avatar_url);
        
        const profileChanged = 
          !currentProfile ||
          currentProfile.full_name !== profileData.full_name ||
          currentProfile.company_name !== profileData.company_name ||
          currentAvatarPath !== newAvatarPath;
        
        if (profileChanged) {
          setProfile(profileData);
          saveToCache(profileData);
        } else {
          // Only signed URL changed, update cache but not state
          const updatedProfile = { ...currentProfile, avatar_url: profileData.avatar_url };
          saveToCache(updatedProfile);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  }, [user, fetchProfile, saveToCache, getAvatarFilePath]); // Removed profile from deps

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
      const updatedProfile = data.profile as UserProfile;
      
      // Compare avatar file path to see if it actually changed
      setProfile((currentProfile) => {
        if (!currentProfile) {
          saveToCache(updatedProfile);
          return updatedProfile;
        }
        
        const currentAvatarPath = getAvatarFilePath(currentProfile.avatar_url || null);
        const newAvatarPath = getAvatarFilePath(updatedProfile.avatar_url);
        
        // Only update state if avatar file actually changed or other fields changed
        const shouldUpdate = 
          currentProfile.full_name !== updatedProfile.full_name ||
          currentProfile.company_name !== updatedProfile.company_name ||
          currentAvatarPath !== newAvatarPath;
        
        if (shouldUpdate) {
          saveToCache(updatedProfile);
          return updatedProfile;
        } else {
          // Only token changed, update cache but not state
          saveToCache({ ...currentProfile, avatar_url: updatedProfile.avatar_url });
          return currentProfile;
        }
      });
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw new Error(err.message || 'Failed to update profile');
    }
  }, [user, saveToCache, getAvatarFilePath]); // Removed profile from deps

  // Upload avatar via API route
  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
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
      const avatarUrl = data.avatar_url as string;
      const updatedProfile = data.profile as UserProfile;

      // Always update on avatar upload (new file uploaded)
      setProfile(updatedProfile);
      saveToCache(updatedProfile);

      return avatarUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload avatar');
    }
  }, [user, saveToCache]); // Removed profile and getAvatarFilePath from deps

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
      setProfile(initialProfile);
      saveToCache(initialProfile);
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

        setProfile(profileData);
        saveToCache(profileData);
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
  }, [initialUser, initialProfile, loadFromCache, saveToCache, fetchProfile]);

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

