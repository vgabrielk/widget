import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/user/profile - Get user profile
export async function GET(request: NextRequest) {
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

    // Fetch profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // If profile doesn't exist, return null (not an error)
    if (!profile) {
      return NextResponse.json({ profile: null });
    }

    // If profile has avatar_url, generate signed URL
    if (profile.avatar_url) {
      try {
        const { data: signedUrlData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(profile.avatar_url, 3600); // 1 hour expiry

        if (signedUrlData?.signedUrl) {
          profile.avatar_url = signedUrlData.signedUrl;
        }
      } catch (storageError) {
        console.warn('Error generating signed URL for avatar:', storageError);
        // Continue without signed URL
      }
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('Error in profile API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/user/profile - Update user profile
export async function PATCH(request: NextRequest) {
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

    // Parse request body
    const updates = await request.json();

    // Validate updates (only allow certain fields)
    const allowedFields = ['full_name', 'company_name', 'avatar_url'];
    const filteredUpdates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    // Check if profile exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    let profile;

    if (!existingProfile) {
      // Profile doesn't exist, create it
      const { data, error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email || '',
          ...filteredUpdates,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error creating profile:', insertError);
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        );
      }

      profile = data;
    } else {
      // Profile exists, update it
      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(filteredUpdates)
        .eq('id', user.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating profile:', updateError);
        return NextResponse.json(
          { error: updateError.message },
          { status: 500 }
        );
      }

      profile = data;
    }

    // If profile has avatar_url, generate signed URL
    if (profile.avatar_url) {
      try {
        const { data: signedUrlData } = await supabase.storage
          .from('avatars')
          .createSignedUrl(profile.avatar_url, 3600); // 1 hour expiry

        if (signedUrlData?.signedUrl) {
          profile.avatar_url = signedUrlData.signedUrl;
        }
      } catch (storageError) {
        console.warn('Error generating signed URL for avatar:', storageError);
        // Continue without signed URL
      }
    }

    return NextResponse.json({ profile });
  } catch (error: any) {
    console.error('Error in profile API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

