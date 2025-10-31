import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Get banned visitors for a widget
 * GET /api/widgets/[id]/visitors/banned
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: widgetId } = await params;
    const supabase = await createClient();

    if (!widgetId) {
      return NextResponse.json(
        { error: 'Widget ID is required' },
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

    // Get all rooms for this widget to find visitor_ids
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('visitor_id')
      .eq('widget_id', widgetId)
      .not('visitor_id', 'is', null);

    if (roomsError) {
      console.error('[Banned Visitors API] Error fetching rooms:', roomsError);
      return NextResponse.json(
        { error: 'Failed to fetch rooms' },
        { status: 500 }
      );
    }

    const visitorIds = [...new Set(rooms?.map(r => r.visitor_id) || [])];

    if (visitorIds.length === 0) {
      return NextResponse.json({
        visitors: [],
        total: 0,
      });
    }

    // Get banned visitors that have interacted with this widget
    const { data: bannedVisitors, error: visitorsError } = await supabase
      .from('visitors')
      .select('*')
      .eq('banned', true)
      .in('visitor_id', visitorIds)
      .order('banned_at', { ascending: false });

    if (visitorsError) {
      console.error('[Banned Visitors API] Error fetching banned visitors:', visitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch banned visitors' },
        { status: 500 }
      );
    }

    // Get additional stats for each visitor (room count, message count)
    const visitorsWithStats = await Promise.all(
      (bannedVisitors || []).map(async (visitor) => {
        const { data: visitorRooms } = await supabase
          .from('rooms')
          .select('id', { count: 'exact' })
          .eq('widget_id', widgetId)
          .eq('visitor_id', visitor.visitor_id);

        const { data: messages } = await supabase
          .from('messages')
          .select('id', { count: 'exact' })
          .in('room_id', visitorRooms?.map(r => r.id) || []);

        return {
          ...visitor,
          room_count: visitorRooms?.length || 0,
          message_count: messages?.length || 0,
        };
      })
    );

    return NextResponse.json({
      visitors: visitorsWithStats,
      total: visitorsWithStats.length,
    });
  } catch (error: any) {
    console.error('[Banned Visitors API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

