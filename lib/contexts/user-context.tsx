'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
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

  // Fetch profile from database via API route
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const res = await fetch('/api/user/profile', {
        credentials: 'include', // CRITICAL: Include cookies for auth
        cache: 'no-store',
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch profile: ${res.statusText}`);
      }

      const data = await res.json();
      return data.profile as UserProfile | null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      throw err;
    }
  }, []);

  // Refresh profile (bypasses cache)
  const refreshProfile = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    setError(null);

    try {
      const profileData = await fetchProfile(user.id);
      if (profileData) {
        setProfile(profileData);
        saveToCache(profileData);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to refresh profile');
    } finally {
      setLoading(false);
    }
  }, [user, fetchProfile, saveToCache]);

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
      setProfile(updatedProfile);
      saveToCache(updatedProfile);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw new Error(err.message || 'Failed to update profile');
    }
  }, [user, saveToCache]);

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
  }, [user, saveToCache]);

  // Initialize user and profile
  useEffect(() => {
    const initializeUser = async () => {
      try {
        // Get current user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          setUser(null);
          setProfile(null);
          setLoading(false);
          clearCache();
          return;
        }

        setUser(currentUser);

        // Try to load from cache first
        const cachedProfile = loadFromCache();
        if (cachedProfile && cachedProfile.id === currentUser.id) {
          setProfile(cachedProfile);
          setLoading(false);
          
          // Fetch fresh data in background
          fetchProfile(currentUser.id)
            .then((freshProfile) => {
              if (freshProfile) {
                setProfile(freshProfile);
                saveToCache(freshProfile);
              }
            })
            .catch(console.error);
        } else {
          // No cache, fetch from database via API
          const profileData = await fetchProfile(currentUser.id);
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
        const profileData = await fetchProfile(session.user.id);
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
  }, [supabase, loadFromCache, saveToCache, clearCache, fetchProfile]);

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

