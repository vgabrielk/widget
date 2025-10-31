import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: widgetId, roomId } = await params;

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget ID is required' },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // First verify room belongs to widget
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, widget_id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      console.error('Room not found:', roomError);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Verify room belongs to widget
    if (room.widget_id !== widgetId) {
      return NextResponse.json(
        { error: 'Room does not belong to this widget' },
        { status: 403 }
      );
    }

    // Load messages
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .limit(200);

    if (messagesError) {
      console.error('Error loading messages:', messagesError);
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ messages: messages || [] });
  } catch (error: any) {
    console.error('Error in messages API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: widgetId, roomId } = await params;

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget ID is required' },
        { status: 400 }
      );
    }

    if (!roomId) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { content, sender_name, sender_avatar, message_type = 'text' } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      );
    }

    // First verify room belongs to widget
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, widget_id, status')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      console.error('Room not found:', roomError);
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Verify room belongs to widget
    if (room.widget_id !== widgetId) {
      return NextResponse.json(
        { error: 'Room does not belong to this widget' },
        { status: 403 }
      );
    }

    // Check if room is closed (if trying to send regular message)
    if (room.status === 'closed' && message_type !== 'system') {
      return NextResponse.json(
        { error: 'Cannot send message to closed conversation' },
        { status: 400 }
      );
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        sender_type: 'agent',
        sender_id: user.id,
        sender_name: sender_name || user.email?.split('@')[0] || 'Suporte',
        sender_avatar: sender_avatar || null,
        content: content.trim(),
        message_type,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting message:', insertError);
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    // Update room last_message_at and preview (only for non-system messages)
    if (message_type !== 'system') {
      const { error: updateError } = await supabase
        .from('rooms')
        .update({
          last_message_at: new Date().toISOString(),
          last_message_preview: content.trim().substring(0, 100),
        })
        .eq('id', roomId);

      if (updateError) {
        console.error('Error updating room:', updateError);
        // Don't fail the request if room update fails
      }
    }

    return NextResponse.json({ message });
  } catch (error: any) {
    console.error('Error in POST messages API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
