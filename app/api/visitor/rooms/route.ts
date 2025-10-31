import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to create CORS headers
function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Vary': 'Origin',
  };
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(origin),
  });
}

/**
 * Initialize or get existing room for visitor
 * POST /api/visitor/rooms
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const body = await request.json();
    const { widget_id, visitor_id, visitor_name, visitor_email, page_url, page_title } = body;

    if (!widget_id) {
      return NextResponse.json(
        { error: 'widget_id is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    if (!visitor_id) {
      return NextResponse.json(
        { error: 'visitor_id is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = await createClient();

    // Check if visitor is banned
    const { data: visitor, error: visitorError } = await supabase
      .from('visitors')
      .select('banned, ban_reason')
      .eq('visitor_id', visitor_id)
      .single();

    if (!visitorError && visitor?.banned) {
      return NextResponse.json(
        {
          error: 'Visitor is banned',
          banned: true,
          reason: visitor.ban_reason || 'No reason provided',
        },
        { status: 403, headers: corsHeaders }
      );
    }

    // Try to find existing open room for this widget and visitor
    const { data: existingRooms, error: fetchError } = await supabase
      .from('rooms')
      .select('*')
      .eq('widget_id', widget_id)
      .eq('visitor_id', visitor_id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError) {
      console.error('[Visitor Rooms API] Error fetching existing rooms:', fetchError);
      return NextResponse.json(
        { error: 'Failed to check existing room' },
        { status: 500, headers: corsHeaders }
      );
    }

    // If found open room, update it with latest info if needed
    if (existingRooms && existingRooms.length > 0) {
      const existingRoom = existingRooms[0];
      
      // Update room info if provided and different
      const needsUpdate = 
        (visitor_name && existingRoom.visitor_name !== visitor_name) ||
        (visitor_email && existingRoom.visitor_email !== visitor_email) ||
        (page_url && existingRoom.page_url !== page_url) ||
        (page_title && existingRoom.page_title !== page_title);

      if (needsUpdate) {
        console.log('[Visitor Rooms API] Updating existing room with new info');
        const { error: updateError } = await supabase
          .from('rooms')
          .update({
            visitor_name: visitor_name || existingRoom.visitor_name,
            visitor_email: visitor_email || existingRoom.visitor_email,
            page_url: page_url || existingRoom.page_url,
            page_title: page_title || existingRoom.page_title,
            last_activity: new Date().toISOString(),
          })
          .eq('id', existingRoom.id);

        if (updateError) {
          console.error('[Visitor Rooms API] Error updating room:', updateError);
          // Don't fail, just return the existing room
        }
      }

      return NextResponse.json(
        { room: existingRoom },
        { headers: corsHeaders }
      );
    }

    // No open room found - create new room
    console.log('[Visitor Rooms API] Creating new room for visitor:', visitor_id);
    
    const { data: newRoom, error: createError } = await supabase
      .from('rooms')
      .insert({
        widget_id: widget_id,
        visitor_id: visitor_id,
        visitor_name: visitor_name || null,
        visitor_email: visitor_email || null,
        page_url: page_url || null,
        page_title: page_title || null,
        status: 'open',
        last_activity: new Date().toISOString(),
      })
      .select()
      .single();

    if (createError) {
      console.error('[Visitor Rooms API] Error creating room:', createError);
      return NextResponse.json(
        { error: 'Failed to create room' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { room: newRoom },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Visitor Rooms API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

