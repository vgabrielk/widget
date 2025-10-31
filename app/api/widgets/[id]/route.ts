import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const startTime = Date.now();
  try {
    console.log('📥 [API] Widget GET request started');
    const supabase = await createClient();
    const { id: widgetId } = await params;

    console.log('📥 [API] Widget ID:', widgetId);

    if (!widgetId) {
      console.error('❌ [API] Widget ID is missing');
      return NextResponse.json(
        { error: 'Widget ID is required' },
        { status: 400 }
      );
    }

    // Check authentication
    console.log('🔐 [API] Checking authentication...');
    const authStart = Date.now();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log(`🔐 [API] Auth check took ${Date.now() - authStart}ms`, { hasUser: !!user, hasError: !!authError });
    
    if (authError || !user) {
      console.error('❌ [API] Authentication failed:', authError?.message);
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Load widget
    console.log('📦 [API] Loading widget from database...');
    const dbStart = Date.now();
    const { data, error } = await supabase
      .from('widgets')
      .select('*')
      .eq('id', widgetId)
      .single();
    console.log(`📦 [API] Database query took ${Date.now() - dbStart}ms`, { hasData: !!data, hasError: !!error });

    if (error) {
      console.error('❌ [API] Error loading widget:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    if (!data) {
      console.error('❌ [API] Widget not found:', widgetId);
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (data.user_id !== user.id) {
      console.error('❌ [API] Forbidden: User does not own widget', { userId: user.id, widgetUserId: data.user_id });
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`✅ [API] Widget loaded successfully in ${totalTime}ms:`, data.name || data.id);
    return NextResponse.json(data);
  } catch (error: any) {
    const totalTime = Date.now() - startTime;
    console.error(`❌ [API] Error in widget API after ${totalTime}ms:`, error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/widgets/[id] - Update widget
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id: widgetId } = await params;

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

    // Parse request body
    const updates = await request.json();

    // Verify widget exists and user owns it
    const { data: existingWidget, error: fetchError } = await supabase
      .from('widgets')
      .select('user_id')
      .eq('id', widgetId)
      .single();

    if (fetchError || !existingWidget) {
      return NextResponse.json(
        { error: 'Widget not found' },
        { status: 404 }
      );
    }

    if (existingWidget.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Validate updates (only allow certain fields)
    const allowedFields = ['name', 'brand_color', 'position', 'welcome_message', 'is_active', 'icon_name', 'company_name', 'domains'];
    const filteredUpdates: Record<string, any> = {};
    
    for (const field of allowedFields) {
      if (field in updates) {
        filteredUpdates[field] = updates[field];
      }
    }

    // Update widget
    const { data: widget, error: updateError } = await supabase
      .from('widgets')
      .update(filteredUpdates)
      .eq('id', widgetId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating widget:', updateError);
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ widget });
  } catch (error: any) {
    console.error('Error in widget API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
