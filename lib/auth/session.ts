import { unstable_cache } from 'next/cache';
import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { UserProfile } from '@/lib/types/profile';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function getUserFromSession(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (error.name !== 'AuthSessionMissingError') {
      console.error('[auth] Failed to load user from session', error);
    }
    return null;
  }

  return user ?? null;
}

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

const fetchProfile = async (
  userId: string,
  supabase: SupabaseServerClient
): Promise<UserProfile | null> => {
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

export function getUserProfile(userId: string, supabase: SupabaseServerClient) {
  return unstable_cache(
    async () => {
      return fetchProfile(userId, supabase);
    },
    ['user-profile', userId],
    {
      revalidate: 60,
      tags: [`profile:${userId}`],
    }
  )();
}

export async function getUserWithProfile() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const profile = await getUserProfile(user.id, supabase);

  return {
    user,
    profile,
  };
}


