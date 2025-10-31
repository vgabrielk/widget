import { createClient } from '@/lib/supabase/server';
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

    // Get current profile to check for existing avatar
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .maybeSingle();

    // Delete old avatar if exists
    if (currentProfile?.avatar_url) {
      try {
        // Extract path from URL if it's a full URL, or use as-is if it's already a path
        let avatarPath = currentProfile.avatar_url;
        
        // If it's a full URL, extract just the path part
        if (avatarPath.includes('/avatars/')) {
          avatarPath = avatarPath.split('/avatars/')[1];
        } else if (avatarPath.includes('avatars/')) {
          avatarPath = avatarPath.split('avatars/')[1];
        }
        
        // Remove old avatar (should be in format: user-id/avatar-xxx.ext)
        await supabase.storage
          .from('avatars')
          .remove([avatarPath]);
      } catch (err) {
        console.warn('Failed to delete old avatar:', err);
        // Continue even if deletion fails
      }
    }

    // Generate unique filename in user folder (required by RLS policy)
    // Structure: avatars/{user-id}/avatar-{timestamp}.{ext}
    const fileExt = file.name.split('.').pop();
    const fileName = `avatar-${Date.now()}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError);
      return NextResponse.json(
        { error: uploadError.message || 'Failed to upload avatar' },
        { status: 500 }
      );
    }

    // Update profile with new avatar path (just the path, not full URL)
    // The path is stored in format: user-id/avatar-xxx.ext
    const { data: profile, error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: filePath })
      .eq('id', user.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating profile with avatar:', updateError);
      // Try to clean up uploaded file
      await supabase.storage.from('avatars').remove([filePath]);
      return NextResponse.json(
        { error: updateError.message || 'Failed to update profile' },
        { status: 500 }
      );
    }

    // Get public URL for response
    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(filePath);

    // Generate signed URL for response (or use public URL if bucket is public)
    let avatarUrl = publicUrlData.publicUrl;
    try {
      const { data: signedUrlData } = await supabase.storage
        .from('avatars')
        .createSignedUrl(filePath, 3600); // 1 hour expiry

      if (signedUrlData?.signedUrl) {
        avatarUrl = signedUrlData.signedUrl;
      }
    } catch (storageError) {
      console.warn('Error generating signed URL for avatar:', storageError);
      // Continue with public URL (bucket is public anyway)
    }

    return NextResponse.json({
      avatar_url: avatarUrl,
      profile: {
        ...profile,
        avatar_url: avatarUrl,
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

