import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: widgetId } = await params;
    
    // Get pagination parameters from query string
    const { searchParams } = new URL(request.url);
    const from = parseInt(searchParams.get('from') || '0', 10);
    const to = parseInt(searchParams.get('to') || '19', 10);

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

    // Get total count, stats, and paginated data
    const [countResult, openCountResult, closedCountResult, unreadCountResult, dataResult] = await Promise.all([
      supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('widget_id', widgetId),
      supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('widget_id', widgetId)
        .eq('status', 'open'),
      supabase
        .from('rooms')
        .select('*', { count: 'exact', head: true })
        .eq('widget_id', widgetId)
        .eq('status', 'closed'),
      supabase
        .from('rooms')
        .select('unread_count')
        .eq('widget_id', widgetId),
      supabase
        .from('rooms')
        .select('*')
        .eq('widget_id', widgetId)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
        .range(from, to)
    ]);

    if (dataResult.error) {
      console.error('Error loading rooms:', dataResult.error);
      return NextResponse.json(
        { error: dataResult.error.message },
        { status: 500 }
      );
    }

    // Calculate total unread messages
    const totalUnread = (unreadCountResult.data || []).reduce(
      (sum, room) => sum + (room.unread_count || 0),
      0
    );

    return NextResponse.json({ 
      rooms: dataResult.data || [],
      count: countResult.count || 0,
      stats: {
        open: openCountResult.count || 0,
        closed: closedCountResult.count || 0,
        unread: totalUnread,
      }
    });
  } catch (error: any) {
    console.error('Error in rooms API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

