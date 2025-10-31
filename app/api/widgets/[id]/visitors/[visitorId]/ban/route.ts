import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Ban or unban a visitor
 * PATCH /api/widgets/[id]/visitors/[visitorId]/ban
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; visitorId: string }> }
) {
  try {
    const { id: widgetId, visitorId } = await params;
    
    // First check authentication with regular client
    const supabase = await createClient();
    
    // Check auth first
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify widget ownership
    const { data: widget, error: widgetError } = await supabase
      .from('widgets')
      .select('user_id')
      .eq('id', widgetId)
      .single();

    if (widgetError || !widget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    if (widget.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Use service role for admin operations (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    // Create admin client if service role is available, otherwise use authenticated client
    const adminSupabase = supabaseServiceKey
      ? createSupabaseClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false }
        })
      : supabase;

    if (!widgetId || !visitorId) {
      return NextResponse.json(
        { error: 'Widget ID and Visitor ID are required' },
        { status: 400 }
      );
    }

    // Get request body
    const body = await request.json();
    const { banned, ban_reason } = body;

    if (typeof banned !== 'boolean') {
      return NextResponse.json(
        { error: 'banned must be a boolean' },
        { status: 400 }
      );
    }

    // Check if visitor exists (using admin client to bypass RLS)
    const { data: existingVisitor, error: fetchError } = await adminSupabase
      .from('visitors')
      .select('*')
      .eq('visitor_id', visitorId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // Error other than "not found"
      console.error('[Ban Visitor API] Error fetching visitor:', fetchError);
      
      // Check if table doesn't exist (schema issue)
      if (fetchError.message?.includes('relation') && fetchError.message?.includes('does not exist')) {
        return NextResponse.json(
          { 
            error: 'Visitors table not found. Please run the migration: 020_create_visitors_table.sql',
            details: fetchError.message 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Failed to check visitor',
          details: fetchError.message,
          code: fetchError.code 
        },
        { status: 500 }
      );
    }

    // Update or create visitor
    if (existingVisitor) {
      // Update existing visitor
      const updateData: any = {
        banned,
        ...(banned ? { banned_at: new Date().toISOString() } : { banned_at: null }),
        ...(banned && ban_reason ? { ban_reason } : { ban_reason: null }),
      };

      const { data: updatedVisitor, error: updateError } = await adminSupabase
        .from('visitors')
        .update(updateData)
        .eq('visitor_id', visitorId)
        .select()
        .single();

      if (updateError) {
        console.error('[Ban Visitor API] Error updating visitor:', updateError);
        return NextResponse.json(
          { 
            error: 'Failed to update visitor ban status',
            details: updateError.message,
            code: updateError.code,
            hint: updateError.hint 
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ visitor: updatedVisitor });
    } else {
      // Create new visitor record with ban status
      if (!banned) {
        // Can't unban a visitor that doesn't exist
        return NextResponse.json(
          { error: 'Visitor not found' },
          { status: 404 }
        );
      }

      const { data: newVisitor, error: createError } = await adminSupabase
        .from('visitors')
        .insert({
          visitor_id: visitorId,
          banned: true,
          banned_at: new Date().toISOString(),
          ban_reason: ban_reason || null,
          first_seen_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
          total_sessions: 0,
        })
        .select()
        .single();

      if (createError) {
        console.error('[Ban Visitor API] Error creating visitor:', createError);
        
        // Check if table doesn't exist
        if (createError.message?.includes('relation') && createError.message?.includes('does not exist')) {
          return NextResponse.json(
            { 
              error: 'Visitors table not found. Please run the migration: 020_create_visitors_table.sql',
              details: createError.message 
            },
            { status: 500 }
          );
        }
        
        // Check if RLS is blocking
        if (createError.code === '42501' || createError.message?.includes('permission denied')) {
          return NextResponse.json(
            { 
              error: 'Permission denied. RLS policy may be blocking this operation.',
              details: createError.message,
              hint: 'Check RLS policies for the visitors table' 
            },
            { status: 500 }
          );
        }
        
        return NextResponse.json(
          { 
            error: 'Failed to ban visitor',
            details: createError.message,
            code: createError.code,
            hint: createError.hint 
          },
          { status: 500 }
        );
      }

      return NextResponse.json({ visitor: newVisitor });
    }
  } catch (error: any) {
    console.error('[Ban Visitor API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

