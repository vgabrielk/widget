import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Widget } from '@/lib/types/saas';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const fetchWidgets = async (
  userId: string,
  supabase: SupabaseServerClient
): Promise<Widget[]> => {
  const { data, error } = await supabase
    .from('widgets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[widgets] Failed to load widgets', error);
    return [];
  }

  return (data as Widget[]) || [];
};

export function getUserWidgets(userId: string, supabase: SupabaseServerClient) {
  return unstable_cache(
    () => fetchWidgets(userId, supabase),
    ['widgets', userId],
    {
      revalidate: 30,
      tags: [`widgets:${userId}`],
    }
  )();
}


