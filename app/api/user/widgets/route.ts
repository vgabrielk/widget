import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

// GET /api/user/widgets - Get all widget IDs for authenticated user
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

    // Load widget IDs for the user
    const { data: widgets, error } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error loading widget IDs:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      widgets: widgets || [],
      widgetIds: widgets?.map(w => w.id) || [] 
    });
  } catch (error: any) {
    console.error('Error in user widgets API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

