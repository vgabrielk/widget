import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/user/rooms - Get all rooms from all user's widgets
export async function GET(request: Request) {
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

    // First, get user's widget IDs
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

    const widgetIds = widgets?.map(w => w.id) || [];

    if (widgetIds.length === 0) {
      return NextResponse.json({ rooms: [] });
    }

    // Load rooms from all user's widgets with widget info
    const { data: rooms, error: roomsError } = await supabase
      .from('rooms')
      .select('*, widgets!inner(name, brand_color)')
      .in('widget_id', widgetIds)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (roomsError) {
      console.error('Error loading rooms:', roomsError);
      return NextResponse.json(
        { error: roomsError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ rooms: rooms || [] });
  } catch (error: any) {
    console.error('Error in user rooms API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

