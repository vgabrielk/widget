import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Helper function to create CORS headers
function getCorsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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
 * Get messages for a room
 * GET /api/visitor/rooms/[roomId]/messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { roomId } = await params;

    if (!roomId) {
      return NextResponse.json(
        { error: 'roomId is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    const supabase = await createClient();

    // Load messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('[Visitor Messages API] Error loading messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to load messages' },
        { status: 500, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { messages: messages || [] },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Visitor Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * Send a message from visitor
 * POST /api/visitor/rooms/[roomId]/messages
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const origin = request.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    const { roomId } = await params;
    const body = await request.json();
    const { 
      visitor_id, 
      visitor_name, 
      content, 
      image_url, 
      image_name, 
      message_type = 'text' 
    } = body;

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

    // Validate that we have either content or image_url
    if (!content && !image_url) {
      return NextResponse.json(
        { error: 'Either content or image_url is required' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate message_type
    if (!['text', 'image'].includes(message_type)) {
      return NextResponse.json(
        { error: 'Invalid message_type' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Verify room exists and belongs to visitor
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, visitor_id, status')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      console.error('[Visitor Messages API] Room not found:', roomError);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404, headers: corsHeaders }
      );
    }

    // Verify visitor owns the room
    if (room.visitor_id !== visitor_id) {
      console.error('[Visitor Messages API] Unauthorized access to room');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403, headers: corsHeaders }
      );
    }

    // Check if room is closed
    if (room.status === 'closed') {
      return NextResponse.json(
        { error: 'Cannot send message to closed conversation' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Insert message
    const messageData: any = {
      room_id: roomId,
      sender_type: 'visitor',
      sender_id: visitor_id,
      sender_name: visitor_name || 'Visitante',
      message_type,
    };

    if (content) {
      messageData.content = content.trim();
    }
    if (image_url) {
      messageData.image_url = image_url;
    }
    if (image_name) {
      messageData.image_name = image_name;
    }

    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert(messageData)
      .select()
      .single();

    if (insertError) {
      console.error('[Visitor Messages API] Error inserting message:', insertError);
      return NextResponse.json(
        { error: 'Failed to send message' },
        { status: 500, headers: corsHeaders }
      );
    }

    // Update room last_activity and last_message_at
    const { error: updateError } = await supabase
      .from('rooms')
      .update({
        last_activity: new Date().toISOString(),
        last_message_at: new Date().toISOString(),
        last_message_preview: content ? content.trim().substring(0, 100) : '📷 Imagem',
      })
      .eq('id', roomId);

    if (updateError) {
      console.error('[Visitor Messages API] Error updating room:', updateError);
      // Don't fail the request if room update fails
    }

    return NextResponse.json(
      { message },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error('[Visitor Messages API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders }
    );
  }
}

