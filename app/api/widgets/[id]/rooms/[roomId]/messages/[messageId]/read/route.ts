import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/widgets/[id]/rooms/[roomId]/messages/[messageId]/read - Mark message as read
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; roomId: string; messageId: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: widgetId, roomId, messageId } = await params;

    if (!widgetId || !roomId || !messageId) {
      return NextResponse.json(
        { error: 'Widget ID, Room ID and Message ID are required' },
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

    // Verify message belongs to room
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .select('room_id')
      .eq('id', messageId)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { error: 'Message not found' },
        { status: 404 }
      );
    }

    if (message.room_id !== roomId) {
      return NextResponse.json(
        { error: 'Message does not belong to this room' },
        { status: 400 }
      );
    }

    // Mark message as read
    const { data: updatedMessage, error: updateError } = await supabase
      .from('messages')
      .update({ 
        is_read: true, 
        read_at: new Date().toISOString() 
      })
      .eq('id', messageId)
      .select()
      .single();

    if (updateError) {
      console.error('Error marking message as read:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: updatedMessage });
  } catch (error: any) {
    console.error('Error in mark message as read API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

