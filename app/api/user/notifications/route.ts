import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/user/notifications - Get user notifications (unread rooms)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user's widgets
    const { data: widgets, error: widgetsError } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id);

    if (widgetsError) {
      console.error('Error loading widgets:', widgetsError);
      return NextResponse.json(
        { error: widgetsError.message },
        { status: 500 }
      );
    }

    if (!widgets || widgets.length === 0) {
      return NextResponse.json({
        notifications: [],
        unreadCount: 0,
      });
    }

    const widgetIds = widgets.map(w => w.id);

    // Get unread messages count from rooms
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('id, widget_id, unread_count, visitor_name, last_message_at, last_message_preview, widgets!inner(name)')
      .in('widget_id', widgetIds)
      .gt('unread_count', 0)
      .order('last_message_at', { ascending: false })
      .limit(10);

    if (roomsError) {
      console.error('Error loading rooms:', roomsError);
      return NextResponse.json(
        { error: roomsError.message },
        { status: 500 }
      );
    }

    // Convert rooms to notifications
    const notifications = (rooms || []).map((room: any) => ({
      id: room.id,
      type: 'new_message' as const,
      title: `Nova mensagem de ${room.visitor_name || 'Visitante'}`,
      message: room.last_message_preview || 'Mensagem recebida',
      room_id: room.id,
      widget_id: room.widget_id,
      is_read: false,
      created_at: room.last_message_at,
    }));

    // Calculate total unread
    const unreadCount = (rooms || []).reduce(
      (sum: number, room: any) => sum + (room.unread_count || 0),
      0
    );

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error: any) {
    console.error('Error in notifications API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

