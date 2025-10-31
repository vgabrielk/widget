import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to create CORS headers
function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
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
 * Mark messages as read
 * PATCH /api/visitor/messages/read
 */
export async function PATCH(request: NextRequest) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const body = await request.json();
    const { room_id, visitor_id } = body;

    if (!room_id) {
      return NextResponse.json(
        { error: 'room_id is required' },
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

    // Verify room exists and belongs to visitor
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, visitor_id')
      .eq('id', room_id)
      .single();

    if (roomError || !room) {
      console.error('[Visitor Mark Read API] Room not found:', roomError);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify visitor owns the room
    if (room.visitor_id !== visitor_id) {
      console.error('[Visitor Mark Read API] Unauthorized access to room');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Mark all admin/agent messages as read for this room
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('room_id', room_id)
      .in('sender_type', ['agent', 'admin'])
      .eq('is_read', false);

    if (updateError) {
      console.error('[Visitor Mark Read API] Error marking messages as read:', updateError);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Also update room unread_count
    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({ unread_count: 0 })
      .eq('id', room_id);

    if (roomUpdateError) {
      console.error('[Visitor Mark Read API] Error updating room unread_count:', roomUpdateError);
      // Don't fail the request if this fails
    }

    return NextResponse.json(
      { success: true },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Visitor Mark Read API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

