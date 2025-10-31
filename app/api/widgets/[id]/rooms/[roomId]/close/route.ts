import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/widgets/[id]/rooms/[roomId]/close - Close conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: widgetId, roomId } = await params;

    if (!widgetId || !roomId) {
      return NextResponse.json(
        { error: 'Widget ID and Room ID are required' },
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

    // Verify room belongs to widget
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('widget_id')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    if (room.widget_id !== widgetId) {
      return NextResponse.json(
        { error: 'Room does not belong to this widget' },
        { status: 400 }
      );
    }

    // 1. Find all messages with images
    const { data: messagesWithImages } = await supabase
      .from('messages')
      .select('image_url')
      .eq('room_id', roomId)
      .not('image_url', 'is', null);

    // 2. Delete images from storage
    if (messagesWithImages && messagesWithImages.length > 0) {
      const imagePaths = messagesWithImages
        .map(m => {
          const match = m.image_url?.match(/chat-images\/(.+)$/);
          return match ? match[1] : null;
        })
        .filter(Boolean) as string[];

      if (imagePaths.length > 0) {
        await supabase.storage
          .from('chat-images')
          .remove(imagePaths);
      }
    }

    // 3. Add system message
    const { data: systemMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        room_id: roomId,
        content: 'Conversa encerrada pelo suporte.',
        sender_name: 'Sistema',
        sender_type: 'agent',
        message_type: 'system',
      })
      .select()
      .single();

    // Continue even if system message fails
    if (messageError) {
      console.warn('Failed to create system message:', messageError);
    }

    // 4. Close the conversation
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update({ status: 'closed' })
      .eq('id', roomId)
      .select()
      .single();

    if (updateError) {
      console.error('Error closing room:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ room: updatedRoom });
  } catch (error: any) {
    console.error('Error in close room API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

