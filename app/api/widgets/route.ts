import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/widgets - Get all widgets for authenticated user
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

    // Load widgets for the user
    const { data: widgets, error } = await supabase
      .from('widgets')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error loading widgets:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ widgets: widgets || [] });
  } catch (error: any) {
    console.error('Error in widgets API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/widgets - Create new widget
export async function POST(request: NextRequest) {
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

    // Check user entitlements to verify they can create widgets
    const { getUserEntitlements } = await import('@/lib/stripe/entitlements');
    const entitlements = await getUserEntitlements(user.id);

    // Get current widget count
    const { data: existingWidgets } = await supabase
      .from('widgets')
      .select('id')
      .eq('user_id', user.id);

    const widgetCount = existingWidgets?.length || 0;

    // Free plan: allow only 1 widget
    // Pro plan: unlimited widgets
    if (entitlements.isFree && widgetCount >= 1) {
      return NextResponse.json(
        { 
          error: 'Limite de widgets atingido',
          message: 'O plano gratuito permite apenas 1 widget. Faça upgrade para criar mais widgets.',
          requiresUpgrade: true
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, brand_color, position, welcome_message } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json(
        { error: 'Widget name is required' },
        { status: 400 }
      );
    }

    // Create widget
    const { data: widget, error } = await supabase
      .from('widgets')
      .insert({
        user_id: user.id,
        name: name.trim(),
        brand_color: brand_color || '#10f500',
        position: position || 'bottom-right',
        welcome_message: welcome_message || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating widget:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ widget }, { status: 201 });
  } catch (error: any) {
    console.error('Error in widgets API:', error);
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

