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
 * Update room information
 * PATCH /api/visitor/rooms/[roomId]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { roomId } = await params;
    const body = await request.json();
    const { visitor_id, visitor_name, visitor_email } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
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
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      console.error('[Visitor Update Room API] Room not found:', roomError);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify visitor owns the room
    if (room.visitor_id !== visitor_id) {
      console.error('[Visitor Update Room API] Unauthorized access to room');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Build update object
    const updateData: any = {};
    if (visitor_name) {
      updateData.visitor_name = visitor_name;
    }
    if (visitor_email !== undefined) {
      updateData.visitor_email = visitor_email;
    }

    // Update room
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update(updateData)
      .eq('id', roomId)
      .select()
      .single();

    if (updateError) {
      console.error('[Visitor Update Room API] Error updating room:', updateError);
      return NextResponse.json(
        { error: 'Failed to update room' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { room: updatedRoom },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Visitor Update Room API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

