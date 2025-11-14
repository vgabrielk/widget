import { unstable_cache } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Widget } from '@/lib/types/saas';

const fetchWidgets = async (userId: string): Promise<Widget[]> => {
  const supabase = await createClient();
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

export function getUserWidgets(userId: string) {
  return unstable_cache(
    () => fetchWidgets(userId),
    ['widgets', userId],
    {
      revalidate: 30,
      tags: [`widgets:${userId}`],
    }
  )();
}


