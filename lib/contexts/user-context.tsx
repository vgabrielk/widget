'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { User } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  full_name: string | null;
  company_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

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

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const fetchingProfileRef = useRef(false);
  const initializedRef = useRef(false);

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
  const fetchProfile = useCallback(async (userId: string, forceFresh = false): Promise<UserProfile | null> => {
    // Prevent multiple simultaneous fetches
    if (fetchingProfileRef.current && !forceFresh) {
      return null;
    }
    
    fetchingProfileRef.current = true;
    
    try {
      const res = await fetch('/api/user/profile', {
        credentials: 'include', // CRITICAL: Include cookies for auth
        cache: forceFresh ? 'no-store' : 'default',
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

  // Refresh profile (bypasses cache)
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const profileData = await fetchProfile(user.id, true);
      if (profileData) {
        // Compare with current profile to avoid unnecessary updates
        const currentAvatarPath = getAvatarFilePath(profile?.avatar_url || null);
        const newAvatarPath = getAvatarFilePath(profileData.avatar_url);
        
        const profileChanged = 
          profile?.full_name !== profileData.full_name ||
          profile?.company_name !== profileData.company_name ||
          currentAvatarPath !== newAvatarPath;
        
        if (profileChanged || !profile) {
          setProfile(profileData);
          saveToCache(profileData);
        } else {
          // Only signed URL changed, update cache but not state
          const updatedProfile = { ...profile, avatar_url: profileData.avatar_url };
          saveToCache(updatedProfile);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  }, [user, profile, fetchProfile, saveToCache, getAvatarFilePath]);

  // Update profile via API route
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
      const currentAvatarPath = getAvatarFilePath(profile?.avatar_url || null);
      const newAvatarPath = getAvatarFilePath(updatedProfile.avatar_url);
      
      // Only update state if avatar file actually changed or other fields changed
      const shouldUpdate = 
        !profile ||
        profile.full_name !== updatedProfile.full_name ||
        profile.company_name !== updatedProfile.company_name ||
        currentAvatarPath !== newAvatarPath;
      
      if (shouldUpdate) {
        setProfile(updatedProfile);
      }
      saveToCache(updatedProfile);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw new Error(err.message || 'Failed to update profile');
    }
  }, [user, profile, saveToCache, getAvatarFilePath]);

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

      // Update local state
      setProfile(updatedProfile);
      saveToCache(updatedProfile);

      return avatarUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload avatar');
    }
  }, [user, profile, saveToCache, getAvatarFilePath]);

  // Initialize user and profile
  useEffect(() => {
    // Prevent multiple initializations
    if (initializedRef.current) return;
    initializedRef.current = true;
    
    const initializeUser = async () => {
      try {
        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          clearCache();
          initializedRef.current = false;
          return;
        }

        setUser(currentUser);

        // Try to load from cache first
        const cachedProfile = loadFromCache();
        if (cachedProfile && cachedProfile.id === currentUser.id) {
          setProfile(cachedProfile);
          setLoading(false);
          
          // Fetch fresh data in background ONLY if cache is older than 1 minute
          const cachedData = typeof window !== 'undefined' ? localStorage.getItem(CACHE_KEY) : null;
          const cacheTimestamp = cachedData ? JSON.parse(cachedData).timestamp : 0;
          const cacheAge = Date.now() - cacheTimestamp;
          const CACHE_REFRESH_INTERVAL = 60 * 1000; // 1 minute
          
          if (cacheAge > CACHE_REFRESH_INTERVAL) {
            fetchProfile(currentUser.id, true)
              .then((freshProfile) => {
                if (freshProfile) {
                  // Compare only the file path (without token) to see if avatar actually changed
                  const cachedAvatarPath = getAvatarFilePath(cachedProfile.avatar_url);
                  const freshAvatarPath = getAvatarFilePath(freshProfile.avatar_url);
                  
                  // Also check if any other profile fields changed
                  const profileChanged = 
                    cachedProfile.full_name !== freshProfile.full_name ||
                    cachedProfile.company_name !== freshProfile.company_name ||
                    cachedAvatarPath !== freshAvatarPath;
                  
                  if (profileChanged) {
                    // Only update if something actually changed
                    setProfile(freshProfile);
                    saveToCache(freshProfile);
                  } else {
                    // Profile didn't change, just update the signed URL in cache (refresh token)
                    // but don't trigger a state update to avoid image reload
                    const updatedProfile = { ...cachedProfile, avatar_url: freshProfile.avatar_url };
                    saveToCache(updatedProfile);
                  }
                }
              })
              .catch(console.error);
          }
        } else {
          // No cache, fetch from database via API
          const profileData = await fetchProfile(currentUser.id, true);
          if (profileData) {
            setProfile(profileData);
            saveToCache(profileData);
          } else {
            // Profile doesn't exist, create it via API
            try {
              const createRes = await fetch('/api/user/profile', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                  email: currentUser.email || '',
                }),
              });

              if (createRes.ok) {
                const createData = await createRes.json();
                if (createData.profile) {
                  setProfile(createData.profile as UserProfile);
                  saveToCache(createData.profile as UserProfile);
                }
              }
            } catch (err) {
              console.error('Error creating profile:', err);
            }
          }
          setLoading(false);
        }
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
        initializedRef.current = false;
      }
    };

    initializeUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        clearCache();
      } else if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        initializedRef.current = false;
        const profileData = await fetchProfile(session.user.id, true);
        if (profileData) {
          setProfile(profileData);
          saveToCache(profileData);
        } else {
          // Create profile if doesn't exist via API
          try {
            const createRes = await fetch('/api/user/profile', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              credentials: 'include',
              body: JSON.stringify({
                email: session.user.email || '',
              }),
            });

            if (createRes.ok) {
              const createData = await createRes.json();
              if (createData.profile) {
                setProfile(createData.profile as UserProfile);
                saveToCache(createData.profile as UserProfile);
              }
            }
          } catch (err) {
            console.error('Error creating profile on sign in:', err);
          }
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadFromCache, saveToCache, clearCache, fetchProfile, getAvatarFilePath]);

  const value: UserContextType = {
    user,
    profile,
    loading,
    error,
    refreshProfile,
    updateProfile,
    uploadAvatar,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

