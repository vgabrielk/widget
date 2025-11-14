import { createClient } from '@/lib/supabase/server';
import { AVATAR_BUCKET, normalizeAvatarPath } from '@/lib/utils/avatar';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function DELETE() {
  try {
    const supabase = await createClient();

    // Get authenticated user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase admin environment variables');
    }

    const supabaseAdmin = createSupabaseAdminClient(supabaseUrl, serviceKey);

    // Delete user's avatar from storage if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .single();

    if (profile?.avatar_path) {
      try {
        const avatarPath = normalizeAvatarPath(profile.avatar_path);
        if (avatarPath) {
          await supabaseAdmin.storage.from(AVATAR_BUCKET).remove([avatarPath]);
        }
      } catch (err) {
        console.error('Failed to delete avatar:', err);
      }
    }

    // Delete all user's widgets (cascade will handle rooms and messages)
    await supabase
      .from('widgets')
      .delete()
      .eq('user_id', user.id);

    // Delete user's subscription
    await supabase
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id);

    // Delete user's profile
    await supabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    // Delete user from auth (this is the final step)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete user from auth:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: 'Account deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

