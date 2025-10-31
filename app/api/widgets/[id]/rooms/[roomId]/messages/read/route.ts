import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/widgets/[id]/rooms/[roomId]/messages/read - Mark all unread messages in room as read
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
      .select('id, widget_id')
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

    // Mark all unread messages from visitors as read (agent viewing visitor messages)
    const { error: updateError } = await supabase
      .from('messages')
      .update({ 
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('room_id', roomId)
      .eq('sender_type', 'visitor')
      .eq('is_read', false);

    if (updateError) {
      console.error('Error marking messages as read:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    // Update room unread_count to 0
    // The trigger should handle this, but we'll update it explicitly to ensure consistency
    const { error: roomUpdateError } = await supabase
      .from('rooms')
      .update({ unread_count: 0 })
      .eq('id', roomId);

    if (roomUpdateError) {
      console.error('Error updating room unread_count:', roomUpdateError);
      // Don't fail the request if this fails, as the trigger might handle it
    }

    return NextResponse.json({ 
      success: true,
      message: 'All messages marked as read'
    });
  } catch (error: any) {
    console.error('Error in mark all messages as read API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

