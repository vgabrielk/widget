import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/widgets/[id]/rooms/[roomId]/reopen - Reopen conversation
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

    // Reopen the conversation
    const { data: updatedRoom, error: updateError } = await supabase
      .from('rooms')
      .update({ status: 'open' })
      .eq('id', roomId)
      .select()
      .single();

    if (updateError) {
      console.error('Error reopening room:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ room: updatedRoom });
  } catch (error: any) {
    console.error('Error in reopen room API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

