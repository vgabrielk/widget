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

  // Fetch profile from database
  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      return data as UserProfile | null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      throw err;
    }
  }, [supabase]);

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

  // Update profile
  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user) throw new Error('No user logged in');

    try {
      // First, check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!existingProfile) {
        // Profile doesn't exist, create it
        const { data, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email || '',
            ...updates,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newProfile = data as UserProfile;
        setProfile(newProfile);
        saveToCache(newProfile);
        return;
      }

      // Profile exists, update it
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      const updatedProfile = data as UserProfile;
      setProfile(updatedProfile);
      saveToCache(updatedProfile);
    } catch (err: any) {
      console.error('Error updating profile:', err);
      throw new Error(err.message || 'Failed to update profile');
    }
  }, [user, supabase, saveToCache]);

  // Upload avatar
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

      // Delete old avatar if exists
      if (profile?.avatar_url) {
        try {
          await supabase.storage.from('avatars').remove([profile.avatar_url]);
        } catch (err) {
          console.warn('Failed to delete old avatar:', err);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      await updateProfile({ avatar_url: publicUrl });

      return publicUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Failed to upload avatar');
    }
  }, [user, profile, supabase, updateProfile]);

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
          // No cache, fetch from database
          const profileData = await fetchProfile(currentUser.id);
          if (profileData) {
            setProfile(profileData);
            saveToCache(profileData);
          } else {
            // Profile doesn't exist, create it
            try {
              const { data: newProfile, error: insertError } = await supabase
                .from('profiles')
                .insert({
                  id: currentUser.id,
                  email: currentUser.email || '',
                })
                .select()
                .single();

              if (!insertError && newProfile) {
                setProfile(newProfile as UserProfile);
                saveToCache(newProfile as UserProfile);
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
          // Create profile if doesn't exist
          try {
            const { data: newProfile, error: insertError } = await supabase
              .from('profiles')
              .insert({
                id: session.user.id,
                email: session.user.email || '',
              })
              .select()
              .single();

            if (!insertError && newProfile) {
              setProfile(newProfile as UserProfile);
              saveToCache(newProfile as UserProfile);
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

