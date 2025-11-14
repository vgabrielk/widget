import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/types/profile';

const getServerClient = cache(async () => {
  return createClient();
});

const getUserFromSession = cache(async (): Promise<User | null> => {
  const supabase = await getServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error('[auth] Failed to load user from session', error);
    return null;
  }

  return user ?? null;
});

export async function getSessionUser() {
  return getUserFromSession();
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/auth/login');
  }
  return user;
}

const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
  const supabase = await getServerClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth] Failed to load user profile', error);
    return null;
  }

  return (data as UserProfile) || null;
};

export function getUserProfile(userId: string) {
  return unstable_cache(
    async () => {
      return fetchProfile(userId);
    },
    ['user-profile', userId],
    {
      revalidate: 60,
      tags: [`profile:${userId}`],
    }
  )();
}

export async function getUserWithProfile() {
  const user = await requireUser();
  const profile = await getUserProfile(user.id);

  return {
    user,
    profile,
  };
}


