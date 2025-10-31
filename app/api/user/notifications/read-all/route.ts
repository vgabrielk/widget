import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/user/notifications/read-all - Mark all notifications as read
export async function PATCH(request: NextRequest) {
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
      return NextResponse.json({ success: true });
    }

    const widgetIds = widgets.map(w => w.id);

    // Mark all messages in these widgets as read by setting unread_count to 0
    const { error: updateError } = await supabase
      .from('rooms')
      .update({ unread_count: 0 })
      .in('widget_id', widgetIds)
      .gt('unread_count', 0);

    if (updateError) {
      console.error('Error marking notifications as read:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in mark all as read API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

