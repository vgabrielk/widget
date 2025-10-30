import { createClient } from '@/lib/supabase/server';
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

    // Delete user's avatar from storage if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single();

    if (profile?.avatar_url) {
      try {
        // Extract path from full URL if needed
        const avatarPath = profile.avatar_url.includes('/avatars/')
          ? profile.avatar_url.split('/avatars/')[1]
          : profile.avatar_url;
        
        await supabase.storage
          .from('avatars')
          .remove([avatarPath]);
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
    // Note: This requires admin privileges, so we'll use the service role
    const supabaseAdmin = await createClient();
    
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id
    );

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

