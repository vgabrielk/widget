import { createClient } from '@/lib/supabase/server';
import { AVATAR_BUCKET, normalizeAvatarPath } from '@/lib/utils/avatar';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

// POST /api/user/avatar - Upload user avatar
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse FormData
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a JPG, PNG, WEBP, or GIF image.' },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase service configuration for avatar upload');
    }

    const adminClient = createSupabaseAdminClient(supabaseUrl, serviceKey);

    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    const extensionFromType = (() => {
      switch (file.type) {
        case 'image/jpeg':
          return 'jpg';
        case 'image/png':
          return 'png';
        case 'image/webp':
          return 'webp';
        case 'image/gif':
          return 'gif';
        default: {
          const nameExt = file.name?.split('.').pop();
          if (!nameExt) return 'png';
          return nameExt.toLowerCase();
        }
      }
    })();

    const filePathRaw = `${user.id}/avatar-${Date.now()}.${extensionFromType}`;

    const { error: uploadError } = await adminClient.storage
      .from(AVATAR_BUCKET)
      .upload(filePathRaw, fileBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Failed to upload avatar to storage:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Failed to process avatar' },
        { status: 500 }
      );
    }

    const filePath = normalizeAvatarPath(filePathRaw);
    if (!filePath) {
      return NextResponse.json(
        { error: 'Invalid avatar path generated' },
        { status: 500 }
      );
    }

    // Get current profile to check for existing avatar
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('avatar_path')
      .eq('id', user.id)
      .maybeSingle();

    // Remove previous avatar with service role if available
    if (currentProfile?.avatar_path) {
      try {
        await adminClient.storage.from(AVATAR_BUCKET).remove([currentProfile.avatar_path]);
      } catch (err) {
        console.warn('Failed to delete old avatar via admin client:', err);
      }
    }

    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_path: filePath })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      try {
        await adminClient.storage.from(AVATAR_BUCKET).remove([filePath]);
      } catch (err) {
        console.warn('Failed to cleanup uploaded avatar after error:', err);
      }
      console.error('Error updating profile with avatar:', updateError);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      avatar_path: filePath,
      profile: {
        ...profile,
        avatar_path: filePath,
      },
    });
  } catch (error: any) {
    console.error('Error in avatar API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

