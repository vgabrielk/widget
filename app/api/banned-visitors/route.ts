import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Get all banned visitors for the authenticated user's widgets
 * GET /api/banned-visitors?from=0&to=19
 */
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

    // Get pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const from = parseInt(searchParams.get('from') || '0', 10);
    const to = parseInt(searchParams.get('to') || '19', 10);
    const pageSize = to - from + 1;

    // Get all user's widgets
    const { data: widgets, error: widgetsError } = await supabase
      .from('widgets')
      .select('id, name')
      .eq('user_id', user.id);

    if (widgetsError) {
      console.error('[Banned Visitors API] Error fetching widgets:', widgetsError);
      return NextResponse.json(
        { error: 'Failed to fetch widgets' },
        { status: 500 }
      );
    }

    const widgetIds = widgets?.map(w => w.id) || [];

    if (widgetIds.length === 0) {
      return NextResponse.json({
        data: [],
        visitors: [],
        count: 0,
      });
    }

    // Use service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    const adminSupabase = supabaseServiceKey
      ? createSupabaseClient(supabaseUrl, supabaseServiceKey, {
          auth: { persistSession: false }
        })
      : supabase;

    // Get all rooms for user's widgets to find visitor_ids
    const { data: rooms, error: roomsError } = await adminSupabase
      .from('rooms')
      .select('visitor_id, widget_id')
      .in('widget_id', widgetIds)
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
        data: [],
        visitors: [],
        count: 0,
      });
    }

    // Get total count of banned visitors
    const { count: totalCount, error: countError } = await adminSupabase
      .from('visitors')
      .select('*', { count: 'exact', head: true })
      .in('visitor_id', visitorIds)
      .eq('banned', true);

    if (countError) {
      console.error('[Banned Visitors API] Error counting banned visitors:', countError);
    }

    // Get banned visitors with pagination
    const { data: bannedVisitors, error: visitorsError } = await adminSupabase
      .from('visitors')
      .select('*')
      .in('visitor_id', visitorIds)
      .eq('banned', true)
      .order('banned_at', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (visitorsError) {
      console.error('[Banned Visitors API] Error fetching banned visitors:', visitorsError);
      return NextResponse.json(
        { error: 'Failed to fetch banned visitors' },
        { status: 500 }
      );
    }

    // Map visitors to include widget information
    const visitorsWithWidgets = (bannedVisitors || []).map(visitor => {
      const visitorRooms = rooms?.filter(r => r.visitor_id === visitor.visitor_id) || [];
      const widgetIdsForVisitor = [...new Set(visitorRooms.map(r => r.widget_id))];
      const widget = widgets?.find(w => widgetIdsForVisitor.includes(w.id));

      return {
        ...visitor,
        widget_name: widget?.name || 'Widget Desconhecido',
        widget_id: widget?.id || widgetIdsForVisitor[0] || null,
      };
    });

    return NextResponse.json({
      data: visitorsWithWidgets, // For useInfiniteQueryApi compatibility
      visitors: visitorsWithWidgets, // Keep for backward compatibility
      count: totalCount || visitorsWithWidgets.length,
    });
  } catch (error: any) {
    console.error('[Banned Visitors API] Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

